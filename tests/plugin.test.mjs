import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("portable plugin manifest matches VERSION and declares hooks requiring trust", () => {
  const manifest = JSON.parse(read("bundle/plugin/plugin.json"));
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.name, "rill");
  assert.equal(manifest.version, read("VERSION").trim());
  assert.equal(manifest.extensions?.["com.openai"]?.hooks, "./hooks/hooks.json");
});

test("repo marketplace resolves only to the Rill source package, not a global install", () => {
  const market = JSON.parse(read(".agents/plugins/marketplace.json"));
  assert.equal(market.name, "rill-source");
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].source.path, "./bundle/plugin");
  assert.equal(market.plugins[0].policy.installation, "AVAILABLE");
});

test("native skill discovery uses exactly one packaged skill root", () => {
  for (const name of ["brainstorming", "rill-discovery"]) {
    const skill = read(`bundle/plugin/skills/${name}/SKILL.md`);
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`));
  }
  assert.equal(existsSync(join(root, "bundle/skills")), false);
});

test("native SessionStart hook never reads or writes full PRD and emits bounded context", () => {
  const hooks = JSON.parse(read("bundle/plugin/hooks/hooks.json"));
  assert.ok(hooks.hooks.SessionStart.length > 0);
  const result = spawnSync(process.execPath, ["bundle/plugin/hooks/session-start.mjs"], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: root }),
  });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(data.hookSpecificOutput.additionalContext, /PRD.md/);
  assert.ok(data.hookSpecificOutput.additionalContext.length <= 500);
  assert.doesNotMatch(result.stdout, /\| FR-01 \|/);
});

test("project agent configuration is a consumer asset, not a user-global settings takeover", () => {
  for (const role of ["explorer", "worker", "reviewer"]) {
    assert.ok(existsSync(join(root, `bundle/repo-common/.codex/agents/${role}.toml`)));
  }
  assert.ok(existsSync(join(root, "bundle/repo-common/.codex/config.toml")));
});

test("malformed hook input fails visibly without leaking context", () => {
  const result = spawnSync(process.execPath, ["bundle/plugin/hooks/session-start.mjs"], {
    cwd: root,
    encoding: "utf8",
    input: "{invalid",
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
});

test("hook outputs nothing when project PRD is missing", () => {
  const result = spawnSync(
    process.execPath,
    [join(root, "bundle/plugin/hooks/session-start.mjs")],
    {
      cwd: "/tmp",
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: "/tmp", source: "startup" }),
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});
