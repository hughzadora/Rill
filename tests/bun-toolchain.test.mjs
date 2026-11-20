import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const manifest = JSON.parse(read("package.json"));
const workflow = read(".github/workflows/quality.yml");

test("Bun 1.4.5 is the only installed package manager and a frozen upstream lock guards the workflow", () => {
  assert.equal(manifest.packageManager, "bun@1.4.5");
  assert.equal(existsSync(join(root, "pnpm-lock.yaml")), false);
  assert.ok(existsSync(join(root, "bun.lock")));
  assert.match(workflow, /uses: oven-sh\/setup-bun@v2/);
  assert.match(workflow, /bun-version: 1\.4\.5/);
  assert.match(workflow, /run: bun install --frozen-lockfile/);
  assert.doesNotMatch(workflow, /pnpm/);
});

test("native Bun test, strict check, formatter and build are real commands, not fake green scripts", () => {
  assert.match(manifest.scripts.typecheck, /bun check --no-script/);
  assert.match(manifest.scripts["format:check"], /bun fmt --check/);
  assert.match(manifest.scripts.build, /bun build .*--no-bundle.*--target=node/);
  assert.match(manifest.scripts.test, /bun test --parallel=2.*--timings=/);
  assert.match(manifest.scripts["test:coverage"], /c8 --all.*--per-file --lines 80/);
  assert.match(manifest.scripts.ci, /bun run --parallel lint typecheck format:check build/);
  assert.match(manifest.scripts.ci, /&& bun run --parallel test test:coverage/);
  assert.doesNotMatch(manifest.scripts.ci, /--changed/);
});

test("native test sharding is informed by real recorded file timings, not invented weights", () => {
  const timings = JSON.parse(read(".github/test-timings.json"));
  assert.equal(timings.version, 1);
  const entries = Object.entries(timings.files);
  const testFiles = readdirSync(join(root, "tests"))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `tests/${file}`)
    .sort();
  assert.deepEqual(entries.map(([file]) => file).sort(), testFiles);
  for (const [file, duration] of entries) {
    assert.match(file, /^tests\/[a-z-]+\.test\.mjs$/);
    assert.ok(Number.isFinite(duration) && duration > 0, file);
  }
  assert.match(manifest.scripts["test:changed"], /bun test --changed=main/);
  assert.match(manifest.scripts["test:timings"], /--update-timings/);
});

test("the required hosted gate never substitutes selective tests for full source coverage", () => {
  assert.match(workflow, /^ {2}pull_request:\s*$/m);
  assert.match(workflow, /^ {2}push:\n {4}branches:\n {6}- main/m);
  assert.match(workflow, /run: bun run ci/);
  assert.doesNotMatch(workflow, /--changed|--shard/);
  assert.match(workflow, /^permissions:\n {2}contents: read/m);
});
