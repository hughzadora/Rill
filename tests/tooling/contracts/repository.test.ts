import { expect, test } from "bun:test";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = realpathSync(new URL("../../../", import.meta.url));

test("mise resolves the required tasks for the repository's Bun profile", () => {
  const result = Bun.spawnSync(["mise", "tasks", "ls", "--no-global", "--json"], { cwd: root });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const tasks: unknown = JSON.parse(result.stdout.toString());
  if (!Array.isArray(tasks)) throw new Error("Expected mise task inventory");
  const commands = {
    build: "bun run build",
    format: "bun run format",
    "format-check": "bun run format:check",
    lint: "bun run lint",
    "lint-fix": "bun run lint:fix",
    typecheck: "bun run typecheck",
    test: "bun run test",
    qualify: "bun run test:qualification",
    "scan-secrets": "gitleaks dir --redact=100 .",
    "scan-history": "gitleaks git --redact=100 .",
    "scan-dependencies": "osv-scanner scan source --recursive .",
    spelling: "typos",
    knip: "bun run knip",
    "workflow-lint":
      "bun run oxlint --deny-warnings .github/scripts/require-results.js && actionlint -shellcheck shellcheck -ignore 'specifying action.*locked-setup.*ref is missing' .github/workflows/acceptance.yml && shellcheck -s bash .github/actions/locked-setup/install.sh && zizmor --offline .github/workflows/acceptance.yml .github/actions/locked-setup/action.yml",
    links:
      "lychee --offline --no-progress AGENTS.md README.md 'docs/**/*.md' 'workflow/**/*.md' '.agents/**/*.md' modern-ai-dlc-engineering-master-blueprint.md",
  };
  const compositions = {
    "check-fast": ["format-check", "lint", "typecheck"],
    verify: [
      "check-fast",
      "knip",
      "test",
      "scan-secrets",
      "scan-dependencies",
      "spelling",
      "links",
      "workflow-lint",
    ],
    qualify: ["test"],
  };
  for (const name of new Set([...Object.keys(commands), ...Object.keys(compositions)])) {
    const run = Object.entries(commands).find(([task]) => task === name)?.[1];
    const depends = Object.entries(compositions).find(([task]) => task === name)?.[1] ?? [];
    const task: unknown = tasks.find(
      (entry: unknown) =>
        typeof entry === "object" && entry !== null && "name" in entry && entry.name === name,
    );
    const uncached: unknown = expect.objectContaining({ enabled: false });
    expect(task, `required mise task ${name}`).toMatchObject({
      source: join(root, "mise.toml"),
      run: run === undefined ? [] : [run],
      depends,
      depends_post: [],
      skip_if: null,
      cache: uncached,
    });
  }
});

test("the package declares the reviewed checker and explicit suite entry points", () => {
  const manifest: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  expect(manifest).toMatchObject({
    scripts: {
      build: "bun src/template.ts",
      format: "oxfmt --write --disable-nested-config .",
      "format:check": "oxfmt --check --disable-nested-config .",
      lint: "oxlint --type-aware --deny-warnings src tests",
      "lint:fix": "oxlint --type-aware --fix src tests",
      test: "bun tests/tooling/run-suite.ts ordinary",
      "test:behavior": "bun tests/tooling/run-suite.ts behavior",
      "test:qualification": "bun tests/tooling/run-suite.ts qualification",
      typecheck: "tsrs --noEmit -p tsconfig.json",
    },
  });
  const config: unknown = Bun.TOML.parse(readFileSync(join(root, "mise.toml"), "utf8"));
  expect(config).toMatchObject({ env: { TSRS_FAST: "0" } });
});

test("the required inputs are nonempty and standalone tsrs discovers the authored TypeScript", () => {
  for (const file of [
    ".gitleaks.toml",
    ".oxfmtrc.json",
    ".oxlintrc.json",
    "AGENTS.md",
    "README.md",
    "bun.lock",
    "docs/PROJECT.md",
    "mise.lock",
    "modern-ai-dlc-engineering-master-blueprint.md",
    "src/template.ts",
    "tests/tooling/run-suite.ts",
    "tsconfig.json",
    "workflow/DELIVERY.md",
    ".agents/skills/rill/SKILL.md",
  ]) {
    const input = statSync(join(root, file), { throwIfNoEntry: false });
    expect(input?.isFile() && input.size > 0, `required input ${file}`).toBe(true);
  }
  for (const directory of ["docs", "workflow", ".agents"]) {
    const files = [...new Bun.Glob("**/*.md").scanSync({ cwd: join(root, directory) })];
    expect(files.length, `required link inputs in ${directory}`).toBeGreaterThan(0);
  }

  const config: unknown = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8"));
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
    include: ["src/**/*.ts", "tests/**/*.ts"],
  });
  const files = [...new Bun.Glob("{src,tests}/**/*.ts").scanSync({ cwd: root, dot: true })];
  const result = Bun.spawnSync(["mise", "run", "typecheck", "--listFilesOnly"], { cwd: root });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const discovered = result.stdout
    .toString()
    .split(/\r?\n/)
    .map((file) => relative(root, file))
    .filter((file) => /^(src|tests)\//.test(file));
  expect(discovered.sort()).toEqual(files.sort());
});

test("Oxfmt leaves lockfiles, generated outputs, and the supplied blueprint to their owners", () => {
  const config: unknown = JSON.parse(readFileSync(join(root, ".oxfmtrc.json"), "utf8"));
  expect(config).toMatchObject({
    ignorePatterns: [
      "**/bun.lock",
      "**/mise.lock",
      "**/node_modules/**",
      "**/dist/**",
      "**/reports/**",
      "/modern-ai-dlc-engineering-master-blueprint.md",
    ],
  });
  expect(readFileSync(join(root, ".gitignore"), "utf8").trim().split("\n").sort()).toEqual([
    ".DS_Store",
    "dist/",
    "node_modules/",
    "reports/",
  ]);
});
