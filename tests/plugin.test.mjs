import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("portable plugin manifest matches VERSION and declares only native components", () => {
  const manifest = JSON.parse(read("plugin/plugin.json"));
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.name, "rill");
  assert.equal(manifest.version, read("VERSION").trim());
  assert.equal(manifest.extensions?.["com.openai"]?.hooks, "./hooks/hooks.json");
  assert.equal(existsSync(join(root, "plugin/skills/rill-recover/SKILL.md")), true);
  assert.equal(existsSync(join(root, "plugin/skills/rill-update/SKILL.md")), true);
  assert.deepEqual(readdirSync(join(root, "plugin")).sort(), ["hooks", "plugin.json", "skills"]);
});

test("repo marketplace resolves only to the versioned plugin directory", () => {
  const market = JSON.parse(read(".agents/plugins/marketplace.json"));
  assert.equal(market.name, "rill-source");
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, "rill");
  assert.equal(market.plugins[0].source.path, "./plugin");
  assert.equal(market.plugins[0].policy.installation, "AVAILABLE");
});

test("consumer Marketplace references only its independently installed copy", () => {
  const market = JSON.parse(read("templates/consumer/.agents/plugins/marketplace.json"));
  assert.equal(market.name, "rill-consumer");
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, "rill");
  assert.equal(market.plugins[0].source.path, "./.rill/plugin");
});

test("consumer project Hooks expose SessionStart to native trust review", () => {
  const nativeHooks = JSON.parse(read("templates/consumer/.codex/hooks.json"));
  const pluginHooks = JSON.parse(read("plugin/hooks/hooks.json"));
  const nativeStart = nativeHooks.hooks.SessionStart[0];
  const pluginStart = pluginHooks.hooks.SessionStart[0];
  assert.equal(nativeStart.matcher, pluginStart.matcher);
  assert.equal(nativeStart.hooks[0].type, "command");
  assert.match(nativeStart.hooks[0].command, /\.rill\/plugin\/hooks\/session-start\.mjs/);
  assert.equal(nativeStart.hooks[0].timeout, 3);
  assert.equal(nativeStart.hooks[0].additionalContextLimit, 500);
});

test("native Skill discovery uses exactly one bounded packaged Skill root", () => {
  for (const name of ["rill-recover", "rill-update"]) {
    const skill = read(`plugin/skills/${name}/SKILL.md`);
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`));
  }
  assert.equal(existsSync(join(root, "bundle")), false);
  assert.equal(existsSync(join(root, "plugin/skills/brainstorming")), false);
});

test("SessionStart Hook emits bounded reference context, not full PRD", () => {
  const hooks = JSON.parse(read("plugin/hooks/hooks.json"));
  assert.ok(hooks.hooks.SessionStart.length > 0);
  const result = spawnSync(process.execPath, ["plugin/hooks/session-start.mjs"], {
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

test("consumer roles are project-scoped files, not global Codex policy", () => {
  for (const role of ["explorer", "worker", "reviewer"]) {
    assert.ok(existsSync(join(root, `templates/consumer/.codex/agents/${role}.toml`)));
  }
  assert.ok(existsSync(join(root, "templates/consumer/.codex/config.toml")));
  assert.match(read("templates/consumer/.codex/agents/reviewer.toml"), /not enforce read-only/i);
});

test("malformed Hook input fails visibly without leaking context", () => {
  const result = spawnSync(process.execPath, ["plugin/hooks/session-start.mjs"], {
    cwd: root,
    encoding: "utf8",
    input: "{invalid",
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
});

test("Hook outputs nothing when project PRD is missing", () => {
  const result = spawnSync(process.execPath, [join(root, "plugin/hooks/session-start.mjs")], {
    cwd: "/tmp",
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "SessionStart", cwd: "/tmp", source: "startup" }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});
