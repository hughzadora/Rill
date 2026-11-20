import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function git(cwd, ...args) {
  return spawnSync("git", ["-C", cwd, "-c", "core.hooksPath=/dev/null", ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
  });
}

function requireGit(cwd, ...args) {
  const result = git(cwd, ...args);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr ?? ""}`);
  return result.stdout.trim();
}

function manifest(version, details = "upstream") {
  return `${JSON.stringify({ name: "rill", version, details }, null, 2)}\n`;
}

function product(t) {
  const root = mkdtempSync(join(tmpdir(), "rill-git-update-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "product");
  mkdirSync(join(path, ".rill/plugin"), { recursive: true });
  mkdirSync(join(path, "src"), { recursive: true });
  writeFileSync(join(path, ".rill/plugin/plugin.json"), manifest("0.0.1"));
  writeFileSync(join(path, "src/business.ts"), "export const businessResult = 42;\n");
  requireGit(path, "init", "-q", "--initial-branch=main");
  requireGit(path, "config", "user.name", "Rill isolated test");
  requireGit(path, "config", "user.email", "rill@invalid.example");
  requireGit(path, "add", "-A");
  requireGit(path, "commit", "-qm", "Initial consumer with Rill 0.0.1");
  return { root, path, sourceHead: requireGit(path, "rev-parse", "HEAD") };
}

function prepareReviewedUpdate(productRepo) {
  const review = join(productRepo.root, "native-review");
  requireGit(productRepo.path, "worktree", "add", "-q", "-b", "chatgpt/rill-update-test", review);
  writeFileSync(join(review, ".rill/plugin/plugin.json"), manifest("0.0.2"));
  requireGit(review, "add", "--", ".rill/plugin/plugin.json");
  requireGit(review, "commit", "-qm", "Update Rill-managed plugin to 0.0.2");
  assert.equal(
    readFileSync(join(productRepo.path, ".rill/plugin/plugin.json"), "utf8"),
    manifest("0.0.1"),
    "review worktree cannot silently change the original consumer",
  );
  return review;
}

test("native review worktree, authorized merge and revert preserve consumer business edits", (t) => {
  const fixture = product(t);
  prepareReviewedUpdate(fixture);
  const businessChange = "export const businessResult = 99;\n";
  writeFileSync(join(fixture.path, "src/business.ts"), businessChange);
  requireGit(fixture.path, "add", "--", "src/business.ts");
  requireGit(fixture.path, "commit", "-qm", "Independent consumer business change");
  requireGit(fixture.path, "merge", "--no-ff", "--no-edit", "chatgpt/rill-update-test");
  const mergeCommit = requireGit(fixture.path, "rev-parse", "HEAD");
  assert.equal(
    readFileSync(join(fixture.path, ".rill/plugin/plugin.json"), "utf8"),
    manifest("0.0.2"),
  );
  assert.equal(readFileSync(join(fixture.path, "src/business.ts"), "utf8"), businessChange);
  requireGit(fixture.path, "revert", "-m", "1", "--no-edit", mergeCommit);
  assert.equal(
    readFileSync(join(fixture.path, ".rill/plugin/plugin.json"), "utf8"),
    manifest("0.0.1"),
  );
  assert.equal(readFileSync(join(fixture.path, "src/business.ts"), "utf8"), businessChange);
  assert.notEqual(requireGit(fixture.path, "rev-parse", "HEAD"), fixture.sourceHead);
  assert.equal(requireGit(fixture.path, "status", "--porcelain=v1"), "");
});

test("native Git stops when an update would overwrite committed consumer edits", (t) => {
  const fixture = product(t);
  prepareReviewedUpdate(fixture);
  const custom = manifest("0.0.1", "consumer-custom");
  writeFileSync(join(fixture.path, ".rill/plugin/plugin.json"), custom);
  requireGit(fixture.path, "add", "--", ".rill/plugin/plugin.json");
  requireGit(fixture.path, "commit", "-qm", "Consumer customization of managed file");
  const before = requireGit(fixture.path, "rev-parse", "HEAD");
  const attempted = git(fixture.path, "merge", "--no-ff", "--no-edit", "chatgpt/rill-update-test");
  assert.notEqual(attempted.status, 0, "conflicting managed edits must not silently merge");
  assert.equal(requireGit(fixture.path, "rev-parse", "HEAD"), before);
  assert.match(
    requireGit(fixture.path, "status", "--porcelain=v1"),
    /UU \.rill\/plugin\/plugin\.json/,
  );
  requireGit(fixture.path, "merge", "--abort");
  assert.equal(readFileSync(join(fixture.path, ".rill/plugin/plugin.json"), "utf8"), custom);
  assert.equal(requireGit(fixture.path, "status", "--porcelain=v1"), "");
  assert.equal(requireGit(fixture.path, "rev-parse", "HEAD"), before);
});

test("dirty edits block an overlapping Git update without discard or hard reset", (t) => {
  const fixture = product(t);
  prepareReviewedUpdate(fixture);
  const dirty = manifest("0.0.1", "not-committed-user-edit");
  writeFileSync(join(fixture.path, ".rill/plugin/plugin.json"), dirty);
  const before = requireGit(fixture.path, "rev-parse", "HEAD");
  const attempted = git(fixture.path, "merge", "--no-ff", "--no-edit", "chatgpt/rill-update-test");
  assert.notEqual(attempted.status, 0);
  assert.equal(readFileSync(join(fixture.path, ".rill/plugin/plugin.json"), "utf8"), dirty);
  assert.equal(requireGit(fixture.path, "rev-parse", "HEAD"), before);
  assert.match(
    requireGit(fixture.path, "status", "--porcelain=v1"),
    /^M \.rill\/plugin\/plugin\.json$/,
  );
});

test("native revert conflict can be aborted without destroying post-upgrade edits", (t) => {
  const fixture = product(t);
  prepareReviewedUpdate(fixture);
  requireGit(fixture.path, "merge", "--no-ff", "--no-edit", "chatgpt/rill-update-test");
  const merged = requireGit(fixture.path, "rev-parse", "HEAD");
  const custom = manifest("0.0.2", "consumer-edited-after-upgrade");
  writeFileSync(join(fixture.path, ".rill/plugin/plugin.json"), custom);
  requireGit(fixture.path, "add", "--", ".rill/plugin/plugin.json");
  requireGit(fixture.path, "commit", "-qm", "Consumer modified updated plugin");
  const before = requireGit(fixture.path, "rev-parse", "HEAD");
  const attempted = git(fixture.path, "revert", "-m", "1", "--no-edit", merged);
  assert.notEqual(attempted.status, 0, "rollback must not overwrite post-update edits");
  requireGit(fixture.path, "revert", "--abort");
  assert.equal(readFileSync(join(fixture.path, ".rill/plugin/plugin.json"), "utf8"), custom);
  assert.equal(requireGit(fixture.path, "rev-parse", "HEAD"), before);
  assert.equal(requireGit(fixture.path, "status", "--porcelain=v1"), "");
});
