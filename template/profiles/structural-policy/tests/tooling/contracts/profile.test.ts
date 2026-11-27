import { expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { relative } from "node:path";

const lintScript = "oxlint --type-aware --deny-warnings --disable-nested-config src tests";

test("verify and qualify use the native profile tasks", async () => {
  const mise: unknown = Bun.TOML.parse(await Bun.file("mise.toml").text());
  expect(mise).toMatchObject({
    env: { TSRS_FAST: "0", OXLINT_TSGOLINT_PATH: "{{config_root}}/node_modules/.bin/tsrs-lint" },
    tasks: {
      "format-check": { run: "mise exec -- bun run format:check" },
      lint: { run: "mise exec -- bun run lint" },
      typecheck: { run: "mise exec -- bun run typecheck" },
      "check-fast": { depends: ["format-check", "lint", "typecheck"] },
      test: { run: "mise exec -- bun run test" },
      unused: { run: "mise exec -- bun run unused" },
      spelling: { run: "mise exec -- typos" },
      "scan-secrets": { run: "mise exec -- gitleaks dir --redact=100 --verbose ." },
      "scan-dependencies": { run: "mise exec -- osv-scanner scan source --lockfile bun.lock" },
      verify: {
        depends: ["check-fast", "test", "unused", "spelling", "scan-secrets", "scan-dependencies"],
      },
      qualify: { run: "mise exec -- bun run test:qualification" },
    },
  });

  const manifest: unknown = await Bun.file("package.json").json();
  expect(manifest).toMatchObject({
    scripts: {
      "format:check": "oxfmt --check --disable-nested-config .",
      lint: lintScript,
      typecheck: "tsrs --noEmit -p tsconfig.json",
      test: "mise exec -- bun tests/tooling/run-tests.ts ordinary",
      "test:behavior": "mise exec -- bun tests/tooling/run-tests.ts behavior",
      "test:qualification": "mise exec -- bun tests/tooling/run-tests.ts qualification",
      unused: "mise exec -- node node_modules/knip/bin/knip.js",
    },
  });
  for (const path of [
    "bun.lock",
    "mise.lock",
    ".oxlintrc.json",
    ".oxfmtrc.json",
    ".gitleaks.toml",
    "_typos.toml",
    "knip.json",
  ]) {
    expect((await Bun.file(path).text()).trim(), path).not.toBe("");
  }
});

test("tsrs targets Bun and sees every TypeScript source and test input", async () => {
  const config: unknown = await Bun.file("tsconfig.json").json();
  expect(config).toMatchObject({
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022"],
      module: "Preserve",
      moduleResolution: "Bundler",
      types: ["bun"],
      strict: true,
      noEmit: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: false,
      forceConsistentCasingInFileNames: true,
      verbatimModuleSyntax: true,
    },
  });

  const cwd = realpathSync(".");
  const intended = Array.from(
    new Bun.Glob("{src,tests}/**/*.ts").scanSync({ cwd, dot: true }),
  ).sort();
  expect(intended.some((file) => file.startsWith("src/"))).toBe(true);
  const result = Bun.spawnSync([
    process.execPath,
    "run",
    "tsrs",
    "--listFilesOnly",
    "-p",
    "tsconfig.json",
  ]);
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const discovered = result.stdout
    .toString()
    .trim()
    .split("\n")
    .map((file) => relative(cwd, realpathSync(file)))
    .filter((file) => file.startsWith("src/") || file.startsWith("tests/"))
    .sort();
  expect(discovered).toEqual(intended);

  const lint = Bun.spawnSync([process.execPath, "run", "lint", "--debug=files"]);
  expect(lint.exitCode, lint.stderr.toString()).toBe(0);
  expect(lint.stdout.toString().trim().split("\n").sort()).toEqual(intended);
});
