import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const scratch = () => mkdtempSync(join(tmpdir(), "rill-init-test-"));
const run = (executable, args) =>
  spawnSync(process.execPath, [executable, ...args], { encoding: "utf8", cwd: repo });
const compiled = join(repo, "dist/cli.js");

test("new product gets a specific PRD, versioned Plugin, native roles and a new Git root", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, "equipment-portal");
  const result = run(compiled, [
    "init",
    target,
    "--goal",
    "Track commercial kitchen service tickets",
    "--yes",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "CREATED_NOT_VERIFIED");
  assert.equal(receipt.version, "0.0.1");
  assert.equal(receipt.path, target);
  assert.match(
    readFileSync(join(target, "PRD.md"), "utf8"),
    /Track commercial kitchen service tickets/,
  );
  assert.equal(existsSync(join(target, "CONSTITUTION.md")), false);
  assert.equal(existsSync(join(target, ".codex/agents/reviewer.toml")), true);
  assert.equal(existsSync(join(target, ".rill/plugin/skills/brainstorming/SKILL.md")), true);
  assert.equal(
    JSON.parse(readFileSync(join(target, ".rill/plugin/plugin.json"), "utf8")).version,
    "0.0.1",
  );
  const marketplace = JSON.parse(
    readFileSync(join(target, ".agents/plugins/marketplace.json"), "utf8"),
  );
  assert.equal(marketplace.plugins[0].source.path, "./.rill/plugin");
  assert.equal(
    existsSync(join(target, ".github/workflows/quality.yml")),
    false,
    "no fake-green CI for unknown product stack",
  );
  const git = spawnSync("git", ["-C", target, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  assert.equal(git.status, 0, git.stderr);
  assert.equal(git.stdout.trim(), target);
});

test("refuses existing data without modifying user-owned files, even with --yes", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, "existing");
  mkdirSync(target);
  writeFileSync(join(target, "important.txt"), "must survive");
  const result = run(compiled, [
    "init",
    target,
    "--goal",
    "An existing project",
    "--yes",
    "--json",
  ]);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(readFileSync(join(target, "important.txt"), "utf8"), "must survive");
  assert.equal(existsSync(join(target, "PRD.md")), false);
});

test("refuses a symlink target and preserves its real directory", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  mkdirSync(join(parent, "actual"));
  const target = join(parent, "shortcut");
  symlinkSync(join(parent, "actual"), target);
  const result = run(compiled, ["init", target, "--goal", "Symlink escape", "--yes", "--json"]);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(lstatSync(target).isSymbolicLink(), true);
  assert.equal(existsSync(join(parent, "actual/PRD.md")), false);
});

test("requires explicit product intent for non-interactive init", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, "new");
  const result = run(compiled, ["init", target, "--yes", "--json"]);
  assert.equal(result.status, 2);
  assert.equal(existsSync(target), false);
});

test("standalone copied distribution initializes a repo without the Rill Git checkout", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const distribution = join(parent, "rill-distribution");
  mkdirSync(distribution);
  cpSync(join(repo, "dist"), join(distribution, "dist"), { recursive: true });
  cpSync(join(repo, "package.json"), join(distribution, "package.json"));
  cpSync(join(repo, "VERSION"), join(distribution, "VERSION"));
  cpSync(join(repo, "bundle"), join(distribution, "bundle"), { recursive: true });
  const target = join(parent, "independent-product");
  const result = run(join(distribution, "dist/cli.js"), [
    "init",
    target,
    "--goal",
    "A new independent product",
    "--yes",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "CREATED_NOT_VERIFIED");
  assert.match(readFileSync(join(target, "PRD.md"), "utf8"), /A new independent product/);
  assert.equal(existsSync(join(target, ".rill/plugin/plugin.json")), true);
});

test("missing goal reports a usage error rather than an environment failure", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const result = run(compiled, ["init", join(parent, "empty"), "--json", "--yes"]);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stderr).error.code, "USAGE");
});

test("mismatched plugin version fails without exposing a half-created project", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const distribution = join(parent, "damaged-distribution");
  mkdirSync(distribution);
  cpSync(join(repo, "dist"), join(distribution, "dist"), { recursive: true });
  cpSync(join(repo, "package.json"), join(distribution, "package.json"));
  cpSync(join(repo, "VERSION"), join(distribution, "VERSION"));
  cpSync(join(repo, "bundle"), join(distribution, "bundle"), { recursive: true });
  const manifest = join(distribution, "bundle/plugin/plugin.json");
  const data = JSON.parse(readFileSync(manifest, "utf8"));
  data.version = "9.9.9";
  writeFileSync(manifest, JSON.stringify(data));
  const target = join(parent, "must-not-exist");
  const result = run(join(distribution, "dist/cli.js"), [
    "init",
    target,
    "--goal",
    "Must fail closed",
    "--yes",
    "--json",
  ]);
  assert.equal(result.status, 2);
  assert.equal(existsSync(target), false);
  const leftovers = readdirSync(parent).filter((name) => name.startsWith(".rill-init-"));
  assert.deepEqual(leftovers, []);
});

test("missing native Git reports an environment error and cleans the staging folder", (t) => {
  const parent = scratch();
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, "no-git");
  const result = spawnSync(
    process.execPath,
    [compiled, "init", target, "--goal", "Git failure path", "--yes", "--json"],
    {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, PATH: "/__rill_missing_git_binary__" },
    },
  );
  assert.equal(result.status, 2);
  assert.match(JSON.parse(result.stderr).error.message, /Git/);
  assert.equal(existsSync(target), false);
  assert.deepEqual(
    readdirSync(parent).filter((name) => name.startsWith(".rill-init-")),
    [],
  );
});
