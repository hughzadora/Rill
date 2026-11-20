import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const factory = fileURLToPath(new URL("../", import.meta.url));
const cli = join(factory, "dist/cli.js");
const exec = (command, args, cwd) =>
  spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
const call = (...args) => exec(process.execPath, [cli, "adopt", ...args], factory);
const git = (repo, ...args) => exec("git", ["-C", repo, ...args], factory);
const text = (path) => readFileSync(path, "utf8");

function fixture(t, options = {}) {
  const parent = mkdtempSync(join(tmpdir(), "rill-brownfield-"));
  const repo = join(parent, "product");
  mkdirSync(repo);
  t.after(() => {
    // The test removes only its own temporary workspace, not a consumer's real worktree.
    const result = git(repo, "worktree", "list", "--porcelain");
    const paths = [...result.stdout.matchAll(/^worktree (.+)$/gm)]
      .map((m) => m[1])
      .filter((p) => p && p !== repo);
    for (const p of paths) {
      assert.equal(git(repo, "worktree", "remove", "--force", p).status, 0);
      if (p.startsWith(join(tmpdir(), "rill-adopt-"))) {
        rmSync(join(p, ".."), { recursive: true, force: true });
      }
    }
    rmSync(parent, { recursive: true, force: true });
  });
  assert.equal(git(repo, "init", "-q").status, 0);
  mkdirSync(join(repo, "src"));
  mkdirSync(join(repo, "tests"));
  mkdirSync(join(repo, ".github", "workflows"), { recursive: true });
  writeFileSync(join(repo, "src/core.mjs"), "export const total = (a,b) => a+b;\n");
  writeFileSync(
    join(repo, "tests/core.test.mjs"),
    "import test from 'node:test'; import{strict as assert}from 'node:assert';import{total}from '../src/core.mjs';test('actual product logic',()=>assert.equal(total(2,3),5));\n",
  );
  writeFileSync(
    join(repo, ".github/workflows/verify.yml"),
    "name: Product CI\non: [push]\njobs: {}\n",
  );
  if (options.custom !== false) {
    writeFileSync(join(repo, "AGENTS.md"), "# Existing product policy\nNO SILENT OVERWRITE\n");
    mkdirSync(join(repo, ".codex"));
    writeFileSync(
      join(repo, ".codex/config.toml"),
      "# Existing product Codex configuration\nmodel = 'example'\n",
    );
  }
  if (options.existingPrd)
    writeFileSync(join(repo, "PRD.md"), "# Existing requirements\nDo not replace\n");
  if (options.existingPlugin) {
    mkdirSync(join(repo, ".rill/plugin"), { recursive: true });
    writeFileSync(join(repo, ".rill/plugin/user-owned.txt"), "Not Rill owned");
  }
  assert.equal(git(repo, "add", "-A").status, 0);
  const initial = git(
    repo,
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "existing product source",
  );
  assert.equal(initial.status, 0, initial.stderr);
  return { repo, parent, head: git(repo, "rev-parse", "HEAD").stdout.trim() };
}

test("inspect mode plans against a clean brownfield without touching any tracked source", (t) => {
  const { repo, head } = fixture(t, { existingPrd: true });
  const result = call(repo, "--json");
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, "PLAN_ONLY");
  assert.equal(plan.sourceHead, head);
  assert.ok(plan.pendingIntegration.includes("AGENTS.md"));
  assert.ok(plan.pendingIntegration.includes(".codex/config.toml"));
  assert.ok(plan.preserved.includes("PRD.md"));
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
  assert.equal(git(repo, "worktree", "list", "--porcelain").stdout.split("worktree ").length, 2);
});

test("applied review branch preserves custom Codex policy, app source, tests and CI", (t) => {
  const { repo, head } = fixture(t, { existingPrd: true });
  const result = call(repo, "--yes", "--json");
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "PREPARED_NOT_VERIFIED");
  assert.ok(receipt.worktree.startsWith("/tmp/"));
  assert.match(receipt.branch, /^chatgpt\/rill-adopt-/);
  assert.equal(git(repo, "rev-parse", "HEAD").stdout.trim(), head);
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
  assert.equal(text(join(receipt.worktree, "AGENTS.md")), text(join(repo, "AGENTS.md")));
  assert.equal(
    text(join(receipt.worktree, ".codex/config.toml")),
    text(join(repo, ".codex/config.toml")),
  );
  assert.equal(
    text(join(receipt.worktree, ".github/workflows/verify.yml")),
    text(join(repo, ".github/workflows/verify.yml")),
  );
  assert.equal(text(join(receipt.worktree, "src/core.mjs")), text(join(repo, "src/core.mjs")));
  assert.equal(text(join(receipt.worktree, "PRD.md")), text(join(repo, "PRD.md")));
  assert.equal(existsSync(join(receipt.worktree, ".rill/plugin/plugin.json")), true);
  assert.equal(existsSync(join(receipt.worktree, ".agents/plugins/marketplace.json")), true);
  assert.ok(receipt.pendingIntegration.includes("AGENTS.md"));
  assert.ok(receipt.pendingIntegration.includes(".codex/config.toml"));
  assert.equal(receipt.nativeTrust, "REQUIRES_USER_APPROVAL");
  const tests = exec(process.execPath, ["--test", "tests/core.test.mjs"], receipt.worktree);
  assert.equal(tests.status, 0, tests.stderr);
  assert.match(tests.stdout + tests.stderr, /pass 1/);
  const originalSource = text(join(receipt.worktree, "src/core.mjs"));
  writeFileSync(join(receipt.worktree, "src/core.mjs"), "export const total = () => 0;\n");
  const regression = exec(process.execPath, ["--test", "tests/core.test.mjs"], receipt.worktree);
  assert.notEqual(
    regression.status,
    0,
    "a genuine business regression must turn the product test red",
  );
  writeFileSync(join(receipt.worktree, "src/core.mjs"), originalSource);
});

test("blank agent policy and current PRD are added only if absent and goal supplied", (t) => {
  const { repo } = fixture(t, { custom: false });
  const result = call(repo, "--yes", "--json", "--goal", "Service tickets for kitchen repairs");
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.pendingIntegration.length, 0);
  assert.match(text(join(receipt.worktree, "PRD.md")), /Service tickets for kitchen repairs/);
  assert.equal(existsSync(join(receipt.worktree, ".codex/agents/reviewer.toml")), true);
  assert.equal(existsSync(join(receipt.worktree, "AGENTS.md")), true);
  assert.equal(existsSync(join(repo, "AGENTS.md")), false);
});

test("dirty worktree is rejected without modifying source or adding review branches", (t) => {
  const { repo } = fixture(t);
  writeFileSync(join(repo, "source-is-dirty.txt"), "not committed");
  const before = git(repo, "branch", "--list").stdout;
  const result = call(repo, "--yes", "--json");
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stderr).error.code, "POLICY");
  assert.equal(text(join(repo, "source-is-dirty.txt")), "not committed");
  assert.equal(git(repo, "branch", "--list").stdout, before);
});

test("a product-owned .rill/plugin is a hard conflict, not an upgrade or overwrite", (t) => {
  const { repo } = fixture(t, { existingPlugin: true });
  const result = call(repo, "--yes", "--json");
  assert.equal(result.status, 1, result.stderr);
  assert.equal(text(join(repo, ".rill/plugin/user-owned.txt")), "Not Rill owned");
  assert.equal(git(repo, "status", "--porcelain").stdout.trim(), "");
});

test("existing PRD is preserved but missing PRD requires a genuine goal", (t) => {
  const { repo } = fixture(t);
  const result = call(repo, "--yes", "--json");
  assert.equal(result.status, 2, result.stderr);
  assert.match(JSON.parse(result.stderr).error.message, /goal/i);
});

test("standalone distribution can prepare a brownfield review without repository source checkout", (t) => {
  const { repo, parent } = fixture(t, { existingPrd: true });
  const distribution = join(parent, "standalone-rill");
  mkdirSync(distribution);
  cpSync(join(factory, "dist"), join(distribution, "dist"), { recursive: true });
  cpSync(join(factory, "bundle"), join(distribution, "bundle"), { recursive: true });
  cpSync(join(factory, "VERSION"), join(distribution, "VERSION"));
  cpSync(join(factory, "package.json"), join(distribution, "package.json"));
  const result = exec(
    process.execPath,
    [join(distribution, "dist/cli.js"), "adopt", repo, "--yes", "--json"],
    factory,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "PREPARED_NOT_VERIFIED");
});
