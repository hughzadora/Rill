import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "dist/cli.js");
const command = (...args) =>
  spawnSync(process.execPath, [cli, "update", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
const git = (repo, ...args) =>
  spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
  });
const read = (path) => readFileSync(path, "utf8");

function fixture(t, options = {}) {
  const scratch = mkdtempSync(join(tmpdir(), "rill-update-cli-"));
  const repo = join(scratch, "product");
  mkdirSync(repo);
  t.after(() => {
    const list = git(repo, "worktree", "list", "--porcelain");
    for (const match of list.stdout.matchAll(/^worktree (.+)$/gm)) {
      if (match[1] === repo) continue;
      assert.equal(git(repo, "worktree", "remove", "--force", match[1]).status, 0);
      if (match[1]?.startsWith(join(tmpdir(), "rill-update-"))) {
        rmSync(join(match[1], ".."), { recursive: true, force: true });
      }
    }
    rmSync(scratch, { recursive: true, force: true });
  });
  mkdirSync(join(repo, ".rill/plugin"), { recursive: true });
  mkdirSync(join(repo, "src"));
  const oldPlugin = join(repo, ".rill/plugin/plugin.json");
  const old = {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: "rill",
    version: "0.0.0",
  };
  writeFileSync(oldPlugin, `${JSON.stringify(old)}\n`);
  writeFileSync(join(repo, ".rill/plugin/custom-user.txt"), "user asset to preserve\n");
  writeFileSync(join(repo, "src/actual.ts"), "export const amount = 42;\n");
  writeFileSync(join(repo, "AGENTS.md"), "# Consumer-owned instructions\n");
  assert.equal(git(repo, "init", "-q", "--initial-branch=main").status, 0);
  assert.equal(git(repo, "add", "-A").status, 0);
  const committed = git(
    repo,
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "Real consumer source",
  );
  assert.equal(committed.status, 0, committed.stderr);
  const head = git(repo, "rev-parse", "HEAD").stdout.trim();
  if (options.dirty) writeFileSync(join(repo, "src/actual.ts"), "export const amount = 99;\n");
  return { repo, head, oldPlugin };
}

test("rill update preview lists review work without modifying the consumer repository", (t) => {
  const { repo, head, oldPlugin } = fixture(t);
  const output = command(repo, "--json");
  assert.equal(output.status, 0, output.stderr);
  const receipt = JSON.parse(output.stdout);
  assert.equal(receipt.status, "PLAN_ONLY");
  assert.equal(receipt.fromVersion, "0.0.0");
  assert.equal(receipt.toVersion, "0.0.1");
  assert.equal(receipt.sourceHead, head);
  assert.equal(receipt.nativeTrust, "REQUIRES_USER_APPROVAL");
  assert.equal(JSON.parse(read(oldPlugin)).version, "0.0.0");
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
  assert.equal(git(repo, "worktree", "list", "--porcelain").stdout.split("worktree ").length, 2);
});

test("rill update --yes stages a review worktree, preserves original files and reports overlap", (t) => {
  const { repo, head } = fixture(t);
  const output = command(repo, "--yes", "--json");
  assert.equal(output.status, 0, output.stderr);
  const receipt = JSON.parse(output.stdout);
  assert.equal(receipt.status, "PREPARED_NOT_VERIFIED");
  assert.match(receipt.branch, /^chatgpt\/rill-update-/);
  assert.equal(
    JSON.parse(read(join(receipt.worktree, ".rill/plugin/plugin.json"))).version,
    "0.0.1",
  );
  assert.equal(
    read(join(receipt.worktree, ".rill/plugin/custom-user.txt")),
    "user asset to preserve\n",
  );
  assert.equal(
    existsSync(join(receipt.worktree, ".rill/plugin/skills/rill-update/SKILL.md")),
    true,
  );
  assert.equal(read(join(receipt.worktree, "src/actual.ts")), "export const amount = 42;\n");
  assert.equal(read(join(receipt.worktree, "AGENTS.md")), "# Consumer-owned instructions\n");
  assert.ok(receipt.pendingReview.includes(".rill/plugin/plugin.json"));
  assert.equal(receipt.nativeTrust, "REQUIRES_USER_APPROVAL");
  assert.equal(JSON.parse(read(join(repo, ".rill/plugin/plugin.json"))).version, "0.0.0");
  assert.equal(git(repo, "rev-parse", "HEAD").stdout.trim(), head);
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
});

test("rill update rejects dirty consumer files rather than discarding changes", (t) => {
  const { repo } = fixture(t, { dirty: true });
  const original = read(join(repo, "src/actual.ts"));
  const output = command(repo, "--yes", "--json");
  assert.equal(output.status, 1);
  assert.equal(JSON.parse(output.stderr).error.code, "POLICY");
  assert.equal(read(join(repo, "src/actual.ts")), original);
});

test("rill update rejects symlink-controlled managed paths without changing their targets", (t) => {
  const { repo } = fixture(t);
  const original = join(repo, ".rill/plugin/custom-user.txt");
  symlinkSync(original, join(repo, ".rill/plugin/rewrite-link"));
  assert.equal(git(repo, "add", "-A").status, 0);
  const committed = git(
    repo,
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "Track managed symlink",
  );
  assert.equal(committed.status, 0, committed.stderr);
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
  const output = command(repo, "--yes", "--json");
  assert.equal(output.status, 1);
  assert.equal(read(original), "user asset to preserve\n");
});

test("rill update refuses an existing same-version plugin without branch creation", (t) => {
  const { repo } = fixture(t);
  writeFileSync(
    join(repo, ".rill/plugin/plugin.json"),
    readFileSync(join(root, "bundle/plugin/plugin.json")),
  );
  assert.equal(git(repo, "add", "-A").status, 0);
  assert.equal(
    git(
      repo,
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "Plugin already current",
    ).status,
    0,
  );
  const output = command(repo, "--yes", "--json");
  assert.equal(output.status, 1);
  assert.match(output.stderr, /current|version|up.to.date/i);
});

test("rill update refuses an ignored, untracked managed plugin even with clean Git status", (t) => {
  const { repo } = fixture(t);
  const removed = git(repo, "rm", "--cached", "-r", "--", ".rill/plugin");
  assert.equal(removed.status, 0, removed.stderr);
  writeFileSync(join(repo, ".gitignore"), ".rill/\n");
  assert.equal(git(repo, "add", "-A").status, 0);
  const committed = git(
    repo,
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "Ignore untracked plugin",
  );
  assert.equal(committed.status, 0, committed.stderr);
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
  assert.equal(existsSync(join(repo, ".rill/plugin/plugin.json")), true);
  const output = command(repo, "--yes", "--json");
  assert.equal(output.status, 1);
  assert.match(output.stderr, /not tracked by Git/);
});

test("a copied Rill distribution with locked production dependencies plans an update", (t) => {
  const { repo } = fixture(t);
  const distribution = join(repo, "../rill-distribution");
  mkdirSync(distribution);
  for (const item of ["dist", "bundle", "VERSION", "package.json", "bun.lock"]) {
    cpSync(join(root, item), join(distribution, item), { recursive: true });
  }
  const install = spawnSync("bun", ["install", "--production", "--offline", "--frozen-lockfile"], {
    cwd: distribution,
    encoding: "utf8",
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  assert.equal(install.status, 0, install.stderr);
  const result = spawnSync(
    process.execPath,
    [join(distribution, "dist/cli.js"), "update", repo, "--json"],
    {
      cwd: distribution,
      encoding: "utf8",
      env: { ...process.env, NODE_TEST_CONTEXT: undefined },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "PLAN_ONLY");
});
