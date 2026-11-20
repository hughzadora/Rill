import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "rill-quality-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const subdir of ["dist", "src", "tests"]) mkdirSync(join(dir, subdir));
  cpSync(join(projectRoot, "package.json"), join(dir, "package.json"));
  const manifestPath = join(dir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  delete manifest.devDependencies;
  writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFileSync(
    join(dir, "dist/total.js"),
    "export function total(value, surcharge) {\n  return value + surcharge;\n}\n",
  );
  writeFileSync(
    join(dir, "src/total.ts"),
    "export function total(value: number, surcharge: number) { return value + surcharge; }\n",
  );
  writeFileSync(
    join(dir, "tests/total.test.mjs"),
    [
      'import test from "node:test";',
      'import assert from "node:assert/strict";',
      'import { total } from "../dist/total.js";',
      'test("business result", () => assert.equal(total(2, 3), 5));',
      "",
    ].join("\n"),
  );
  return dir;
}

function covered(dir) {
  return spawnSync("pnpm", ["run", "test:coverage"], {
    cwd: dir,
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_TEST_CONTEXT: undefined,
      NODE_TEST_PIPE: undefined,
      NODE_V8_COVERAGE: undefined,
      PATH: `${join(projectRoot, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
    },
  });
}

test("per-file V8 coverage gate accepts actually tested business behavior", (t) => {
  const dir = fixture(t);
  const result = covered(dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /business result/);
  assert.match(result.stdout, /total\.js/);
});

test("a fake-green test script cannot conceal no source test execution", (t) => {
  const dir = fixture(t);
  const packageFile = join(dir, "package.json");
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  manifest.scripts.test = 'node -e "process.exit(0)"';
  writeFileSync(packageFile, JSON.stringify(manifest));
  writeFileSync(
    join(dir, "tests/total.test.mjs"),
    'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("fake PASS", () => assert.ok(true));\n',
  );
  const falseGreen = spawnSync("pnpm", ["test"], { cwd: dir, encoding: "utf8" });
  assert.equal(falseGreen.status, 0, falseGreen.stderr);
  const result = covered(dir);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /coverage|threshold/i);
});

test("coverage gate includes completely untested compiled source", (t) => {
  const dir = fixture(t);
  writeFileSync(
    join(dir, "dist/untested.js"),
    [
      "export function unused(value) {",
      "  const next = value + 1;",
      "  const doubled = next * 2;",
      "  const squared = doubled * doubled;",
      "  const result = squared + 42;",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "src/untested.ts"),
    "export function unused(value: number) { return value + 1; }\n",
  );
  const result = covered(dir);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /untested\.js/);
  assert.match(result.stdout + result.stderr, /coverage|threshold/i);
});

test("per-file V8 coverage gate fails a real product regression despite a fake script", (t) => {
  const dir = fixture(t);
  const manifestFile = join(dir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  manifest.scripts.test = 'node -e "console.log(\\"PASS\\")"';
  writeFileSync(manifestFile, JSON.stringify(manifest));
  writeFileSync(
    join(dir, "dist/total.js"),
    "export function total(value, surcharge) {\n  return value - surcharge;\n}\n",
  );
  const result = covered(dir);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /business result/);
});
