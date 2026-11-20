import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const run = (args, entry = "dist/cli.js") =>
  spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" });

test("rill version prints product SemVer, not blueprint edition", () => {
  const result = run(["version"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "0.0.1");
});

test("rill version --json is machine-readable, including status", () => {
  const result = run(["version", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { version: "0.0.1" });
});

test("rill --help is concise and exposes only implemented commands", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rill version/);
  assert.doesNotMatch(result.stdout, /rill setup/);
});

test("rill unknown command exits with usage error without false success", () => {
  const result = run(["does-not-exist"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown command/);
});

test("compiled CLI works and uses the same VERSION file", () => {
  const result = run(["version", "--json"], "dist/cli.js");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { version: "0.0.1" });
});
