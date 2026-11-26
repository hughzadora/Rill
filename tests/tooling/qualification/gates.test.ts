import { expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

const root = realpathSync(new URL("../../../", import.meta.url));
const installedMise = Bun.which("mise");
if (!installedMise) throw new Error("Qualification requires the installed mise executable");
const mise = installedMise;
const bun = Bun.spawnSync([mise, "where", "bun"], { cwd: root });
if (bun.exitCode !== 0) throw new Error(bun.stderr.toString());
const installs = dirname(dirname(bun.stdout.toString().trim()));

function withCheckout(
  exercise: (
    checkout: string,
    run: (task: string) => { exitCode: number | null; output: string },
  ) => void,
) {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), "rill qualification ")));
  try {
    const checkout = join(temporary, "checkout");
    const home = join(temporary, "home");
    const data = join(temporary, "mise");
    for (const directory of [checkout, home, data]) mkdirSync(directory);
    symlinkSync(installs, join(data, "installs"), "dir");
    symlinkSync(realpathSync(join(root, "node_modules")), join(checkout, "node_modules"), "dir");
    for (const input of [
      ".agents",
      ".editorconfig",
      ".gitattributes",
      ".gitignore",
      ".gitleaks.toml",
      ".oxfmtrc.json",
      ".oxlintrc.json",
      "AGENTS.md",
      "README.md",
      "bun.lock",
      "docs",
      "mise.lock",
      "mise.toml",
      "modern-ai-dlc-engineering-master-blueprint.md",
      "package.json",
      "src",
      "template",
      "tests",
      "tsconfig.json",
      "workflow",
    ]) {
      cpSync(join(root, input), join(checkout, input), {
        recursive: true,
        filter: (source) => !lstatSync(source).isSymbolicLink(),
      });
    }
    exercise(checkout, (task) => {
      const result = Bun.spawnSync([mise, "run", task], {
        cwd: checkout,
        env: {
          HOME: home,
          PATH: [dirname(mise), "/usr/bin", "/bin"].join(delimiter),
          TMPDIR: temporary,
          MISE_DATA_DIR: data,
          MISE_TRUSTED_CONFIG_PATHS: checkout,
          MISE_AUTO_INSTALL: "false",
          MISE_OFFLINE: "true",
          MISE_COLOR: "false",
        },
        timeout: 20_000,
      });
      return {
        exitCode: result.exitCode,
        output: result.stdout.toString() + result.stderr.toString(),
      };
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

const assignability = {
  contents: 'export const count: number = "text";\n',
  diagnostic: /TS2322.*Type 'string' is not assignable to type 'number'/,
};
const explicitAny = {
  contents: "export function probe(input: any): unknown {\n  return input;\n}\n",
  diagnostic: /typescript\(no-explicit-any\)/,
};
const misspelling = "te" + "h";
const behaviorSuite = "tests/behavior/template.test.ts";
const qualificationSuite = "tests/tooling/qualification/gates.test.ts";

test.each([
  {
    name: "a source assignability error",
    task: "typecheck",
    file: "src/qualification-probe.ts",
    ...assignability,
  },
  {
    name: "a test assignability error",
    task: "typecheck",
    file: "tests/tooling/qualification-probe.ts",
    ...assignability,
  },
  {
    name: "a browser global in a Bun target",
    task: "typecheck",
    file: "src/qualification-probe.ts",
    contents: "export const page = document.title;\n",
    diagnostic: /TS2584.*Cannot find name 'document'/,
  },
  {
    name: "an explicit any",
    task: "lint",
    file: "src/qualification-probe.ts",
    ...explicitAny,
  },
  {
    name: "a floating promise",
    task: "lint",
    file: "src/qualification-probe.ts",
    contents: "void Promise.reject(new Error('qualification probe'));\n",
    diagnostic: /typescript\(no-floating-promises\)/,
  },
  {
    name: "a focused test using an alias",
    task: "test",
    file: behaviorSuite,
    contents:
      '\nimport { test as trial } from "bun:test";\ntrial.only("qualification probe", () => {});\n',
    diagnostic: /Focused Bun tests in ordinary suites/,
  },
  {
    name: "misformatted Markdown in a path with spaces",
    task: "format-check",
    file: "docs/qualification probe.md",
    contents: "# Qualification\n\n* first\n* second\n",
    diagnostic: /docs\/qualification probe\.md[\s\S]*Format issues found/,
  },
  {
    name: "a failed behavior assertion",
    task: "test",
    file: behaviorSuite,
    contents: '\ntest("qualification probe", () => expect("actual").toBe("intended"));\n',
    diagnostic: /\(fail\) qualification probe/,
  },
  {
    name: "a missing task definition",
    task: "test",
    file: "mise.toml",
    replace: /\[tasks\.format\]\nrun = "bun run format"\n\n/,
    contents: "",
    diagnostic: /required mise task format/,
  },
  {
    name: "a synthetic secret",
    task: "scan-secrets",
    file: "docs/qualification-probe.txt",
    contents: `token = "${["ghp", randomBytes(18).toString("hex")].join("_")}"\n`,
    diagnostic: /leaks found: 1\b/,
  },
  {
    name: "a misspelling",
    task: "spelling",
    file: "docs/qualification-probe.md",
    contents: `# ${misspelling} probe\n`,
    diagnostic: new RegExp("`" + misspelling + "` should be `the`"),
  },
  {
    name: "a broken local link",
    task: "links",
    file: "docs/qualification-probe.md",
    contents: "[Missing file](./qualification-missing-target.md)\n",
    diagnostic: /ERROR.*qualification-missing-target\.md/,
  },
  {
    name: "a failing lint child",
    task: "check-fast",
    file: "src/qualification-probe.ts",
    ...explicitAny,
  },
])("mise $task rejects $name and passes after restoration", (fault) => {
  withCheckout((checkout, run) => {
    const path = join(checkout, fault.file);
    const original = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    const changed =
      fault.replace && original !== undefined
        ? original.replace(fault.replace, fault.contents)
        : (original ?? "") + fault.contents;
    expect(changed).not.toBe(original);
    writeFileSync(path, changed);

    const rejected = run(fault.task);
    expect(rejected.exitCode, rejected.output).toBeGreaterThan(0);
    expect(rejected.output).toMatch(fault.diagnostic);
    expect(readFileSync(path, "utf8"), `${fault.task} keeps the input bytes`).toBe(changed);

    if (original === undefined) rmSync(path);
    else writeFileSync(path, original);
    const restored = run(fault.task);
    expect(restored.exitCode, restored.output).toBe(0);
  });
});

test("mise typecheck covers TypeScript intentionally excluded from lint", () => {
  withCheckout((checkout, run) => {
    const file = "src/qualification-probe.ts";
    writeFileSync(join(checkout, file), assignability.contents + explicitAny.contents);
    const included = run("lint");
    expect(included.exitCode, included.output).toBeGreaterThan(0);
    expect(included.output).toMatch(explicitAny.diagnostic);

    writeFileSync(join(checkout, ".eslintignore"), `${file}\n`);
    const excluded = run("lint");
    expect(excluded.exitCode, excluded.output).toBe(0);
    const rejected = run("typecheck");
    expect(rejected.exitCode, rejected.output).toBeGreaterThan(0);
    expect(rejected.output).toMatch(assignability.diagnostic);

    writeFileSync(join(checkout, file), "export const count: number = 1;\n");
    const restored = run("typecheck");
    expect(restored.exitCode, restored.output).toBe(0);
  });
});

test.each([
  { file: ".oxlintrc.json", diagnostic: "required input .oxlintrc.json" },
  { file: behaviorSuite, diagnostic: `Missing required suite ${behaviorSuite}` },
])("mise test rejects a missing $file", ({ file, diagnostic }) => {
  withCheckout((checkout, run) => {
    const path = join(checkout, file);
    const saved = join(dirname(checkout), "saved");
    renameSync(path, saved);
    const rejected = run("test");
    expect(rejected.exitCode, rejected.output).toBeGreaterThan(0);
    expect(rejected.output).toContain(diagnostic);

    renameSync(saved, path);
    const restored = run("test");
    expect(restored.exitCode, restored.output).toBe(0);
  });
});

test("mise qualify rejects an absent qualification suite after ordinary tests pass", () => {
  withCheckout((checkout, run) => {
    rmSync(join(checkout, qualificationSuite));
    const ordinary = run("test");
    expect(ordinary.exitCode, ordinary.output).toBe(0);
    const rejected = run("qualify");
    expect(rejected.exitCode, rejected.output).toBeGreaterThan(0);
    expect(rejected.output).toContain(`Missing required suite ${qualificationSuite}`);
  });
});

test("mise qualify rejects a qualification suite with only skipped cases", () => {
  withCheckout((checkout, run) => {
    writeFileSync(
      join(checkout, qualificationSuite),
      'import { test } from "bun:test";\ntest.skip("qualification probe", () => {});\n',
    );
    const rejected = run("qualify");
    expect(rejected.exitCode, rejected.output).toBeGreaterThan(0);
    expect(rejected.output).toContain(
      `Required suite must execute without skips: ${qualificationSuite}`,
    );
  });
});

test("mise test rejects a present suite absent from the Bun report", () => {
  withCheckout((checkout, run) => {
    writeFileSync(join(checkout, behaviorSuite), "export {};\n");
    const rejected = run("test");
    expect(rejected.exitCode, rejected.output).toBeGreaterThan(0);
    expect(rejected.output).toContain("Unexpected Bun ordinary report suites");
  });
});
