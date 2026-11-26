import { expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

const project = process.cwd();
const inputs = [
  "src",
  "tests",
  "package.json",
  "bun.lock",
  "mise.toml",
  "mise.lock",
  "tsconfig.json",
  "knip.json",
  ".gitignore",
  ".gitleaks.toml",
  ".oxlintrc.json",
  ".oxfmtrc.json",
  ".editorconfig",
  "_typos.toml",
  "README.md",
];
const environment = Object.fromEntries(
  ["PATH", "HOME", "MISE_DATA_DIR", "MISE_CACHE_DIR", "MISE_STATE_DIR"].map((key) => [
    key,
    process.env[key],
  ]),
);

function disposable(action: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "rill-bun-qualification-"));
  try {
    for (const file of inputs) {
      const source = join(project, file);
      if (!existsSync(source)) continue;
      cpSync(source, join(directory, file), {
        recursive: true,
        filter: (path) =>
          !lstatSync(path).isSymbolicLink() && !/^\.env(?:\.|$)/.test(basename(path)),
      });
    }
    symlinkSync(join(project, "node_modules"), join(directory, "node_modules"), "dir");
    action(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function run(directory: string, task: string) {
  const child = Bun.spawnSync(["mise", "run", task], {
    cwd: directory,
    env: { ...environment, MISE_TRUSTED_CONFIG_PATHS: directory },
    timeout: 30_000,
  });
  expect(child.signalCode, `mise run ${task} was interrupted`).toBeUndefined();
  return {
    exitCode: child.exitCode,
    output: child.stdout.toString() + child.stderr.toString(),
  };
}

test("all ordinary checks pass and each fixer converges in a disposable consumer", () => {
  disposable((directory) => {
    const snapshot = () =>
      Array.from(new Bun.Glob("**/*").scanSync({ cwd: directory, dot: true }))
        .sort()
        .map((file) => [file, readFileSync(join(directory, file)).toString("base64")]);
    const before = snapshot();
    for (const task of ["verify", "lint-fix", "format"]) {
      const result = run(directory, task);
      expect(result.exitCode, result.output).toBe(0);
      expect(snapshot(), `${task} changed consumer inputs`).toEqual(before);
    }
  });
}, 100_000);

const typeError = 'const quantity: number = "text";\nconsole.log(quantity);\n';
const negativeCases = [
  {
    name: "tsrs rejects an incompatible source assignment",
    task: "typecheck",
    file: "src/rill-qualification.ts",
    text: typeError,
    expected: "error TS2322",
  },
  {
    name: "tsrs rejects an incompatible test assignment",
    task: "typecheck",
    file: "tests/behavior/rill-qualification.test.ts",
    text: typeError,
    expected: "error TS2322",
  },
  {
    name: "tsrs rejects a browser-only global in the Bun target",
    task: "typecheck",
    file: "src/rill-qualification.ts",
    text: "console.log(document.title);\n",
    expected: "Cannot find name 'document'",
  },
  {
    name: "type-aware Oxlint rejects a floating promise",
    task: "lint",
    file: "src/rill-qualification.ts",
    text: 'async function readValue(): Promise<string> { return "value"; }\nvoid readValue();\n',
    expected: "no-floating-promises",
  },
  {
    name: "Oxlint rejects explicit any",
    task: "lint",
    file: "src/rill-qualification.ts",
    text: 'const value: any = "value";\nconsole.log(value);\n',
    expected: "no-explicit-any",
  },
  {
    name: "Oxlint rejects a broad lint suppression",
    task: "lint",
    file: "src/rill-qualification.ts",
    text: "/* oxlint-" + "disable */\nconsole.log(1);\n",
    expected: "no-abusive-eslint-disable",
  },
  {
    name: "Oxlint rejects a type-check suppression",
    task: "lint",
    file: "src/rill-qualification.ts",
    text: "// @ts-" + "ignore\nconsole.log(1);\n",
    expected: "ban-ts-comment",
  },
  {
    name: "Oxfmt rejects unformatted Markdown",
    task: "format-check",
    file: "qualification input.md",
    text: "#   Qualification\n",
    expected: "qualification input.md",
  },
  {
    name: "typos rejects a misspelling in authored text",
    task: "spelling",
    file: "qualification.md",
    text: "The " + "te" + "h example.\n",
    expected: "should be `the`",
  },
  {
    name: "Gitleaks detects and redacts a synthetic token",
    task: "scan-secrets",
    file: "qualification.env",
    text: "TOKEN=" + "gh" + "p_" + "b7V92KrLhA51EQTU9fWq7Z8c6xn4JadM3z2X" + "\n",
    expected: "github-pat",
  },
  {
    name: "OSV detects a known advisory in the Bun lock without installing the fixture",
    task: "scan-dependencies",
    file: "bun.lock",
    text: JSON.stringify({
      lockfileVersion: 2,
      configVersion: 1,
      workspaces: { "": { name: "qualification", dependencies: { lodash: "4.17.20" } } },
      packages: {
        lodash: [
          "lodash@4.17.20",
          "",
          {},
          "sha512-PlhdFcillOINfeV7Ni6oF1TAEayyZBoZ8bcshTHqOYJYlrqzRK5hagpagky5o4HfCzzd1TRkXPMFq6cKk9rGmA==",
        ],
      },
    }),
    expected: "GHSA-29mw-wpgm-hmr9",
  },
  {
    name: "OSV rejects a lockfile without packages",
    task: "scan-dependencies",
    file: "bun.lock",
    text: '{"lockfileVersion":2,"configVersion":1,"workspaces":{},"packages":{}}\n',
    expected: "No package sources found",
  },
  {
    name: "Knip rejects an unreferenced module",
    task: "unused",
    file: "src/rill-qualification.ts",
    text: 'export const marker = "unused qualification input";\n',
    expected: "Unused files",
  },
  {
    name: "verify propagates a failed behavior assertion",
    task: "verify",
    file: "tests/behavior/rill-qualification.test.ts",
    text: 'import { expect, test } from "bun:test";\n\ntest("qualification assertion", () => {\n  expect(Bun.argv.length).toBe(-1);\n});\n',
    expected: "(fail) qualification assertion",
  },
  {
    name: "the native test report rejects a conditionally skipped test",
    task: "test",
    file: "tests/behavior/rill-qualification.test.ts",
    text: 'import { expect, test } from "bun:test";\n\ntest.skipIf(true)("qualification skip", () => {\n  expect(true).toBe(true);\n});\n',
    expected: "Bun tests skipped or absent in",
  },
  {
    name: "Bun rejects focused tests even when the test import is aliased",
    task: "test",
    file: "tests/behavior/rill-qualification.test.ts",
    text: 'import { expect, test as check } from "bun:test";\n\ncheck.only("qualification focus", () => {\n  expect(true).toBe(true);\n});\n',
    expected: ".only is disabled in CI environments",
  },
];

for (const example of negativeCases) {
  test(
    example.name,
    () => {
      disposable((directory) => {
        const path = join(directory, example.file);
        writeFileSync(path, example.text);
        const result = run(directory, example.task);
        expect(result.exitCode, result.output).toBeGreaterThan(0);
        expect(result.output).toContain(example.expected);
        if (example.task === "scan-secrets") {
          expect(result.output).not.toContain(example.text.trim().slice("TOKEN=".length));
        }
        expect(readFileSync(path, "utf8"), `${relative(directory, path)} changed`).toBe(
          example.text,
        );
      });
    },
    40_000,
  );
}

test("the ordinary task fails when the behavior suite disappears", () => {
  disposable((directory) => {
    rmSync(join(directory, "tests/behavior"), { recursive: true });
    const result = run(directory, "test");
    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain("No behavior tests found");
  });
}, 40_000);

test("qualify fails if its own suite goes missing", () => {
  disposable((directory) => {
    rmSync(join(directory, "tests/tooling/qualification/profile.test.ts"));
    const result = run(directory, "qualify");
    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain(
      "Missing required test suite: tests/tooling/qualification/profile.test.ts",
    );
  });
}, 40_000);

test("the ordinary task rejects a verify contract with a missing child gate", () => {
  disposable((directory) => {
    const config = join(directory, "mise.toml");
    const original = readFileSync(config, "utf8");
    writeFileSync(config, original.replace(', "scan-dependencies"]', "]"));
    const result = run(directory, "test");
    expect(result.exitCode, result.output).toBe(1);
    expect(result.output).toContain("(fail) verify and qualify use the native profile tasks");
  });
}, 40_000);

test("standalone tsrs still sees an input omitted by Oxlint", () => {
  disposable((directory) => {
    const file = "src/rill-qualification.ts";
    const config = join(directory, ".oxlintrc.json");
    const lintConfig = readFileSync(config, "utf8");
    writeFileSync(config, lintConfig.replace("{", `{"ignorePatterns":["${file}"],`));
    writeFileSync(join(directory, file), typeError);

    const lint = run(directory, "lint");
    expect(lint.exitCode, lint.output).toBe(0);
    const typecheck = run(directory, "typecheck");
    expect(typecheck.exitCode, typecheck.output).toBeGreaterThan(0);
    expect(typecheck.output).toContain(`${file}(1,7): error TS2322`);
  });
}, 40_000);

test("type-aware lint fails when the explicitly selected tsrs backend is unavailable", () => {
  disposable((directory) => {
    const config = join(directory, "mise.toml");
    const original = readFileSync(config, "utf8");
    writeFileSync(config, original.replace("/node_modules/.bin/tsrs-lint", "/missing-tsrs-lint"));
    const result = run(directory, "lint");
    expect(result.exitCode, result.output).toBeGreaterThan(0);
    expect(result.output).toContain("OXLINT_TSGOLINT_PATH points to");
    expect(result.output).toContain("/missing-tsrs-lint");
  });
}, 40_000);
