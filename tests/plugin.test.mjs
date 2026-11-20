import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("Rill repository root is the sole portable native Plugin root", () => {
  const manifest = JSON.parse(read("plugin.json"));
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.name, "rill");
  assert.equal(manifest.version, read("VERSION").trim());
  assert.equal(manifest.extensions?.["com.openai"]?.hooks, "./hooks/hooks.json");
  for (const obsolete of [
    "plugin",
    "bundle",
    "templates/consumer/.agents",
    "templates/consumer/.codex",
  ]) {
    assert.equal(existsSync(join(root, obsolete)), false, `Unexpected duplicate root: ${obsolete}`);
  }
});

test("repository Marketplace uses the Rill root as its only plugin source", () => {
  const market = JSON.parse(read(".agents/plugins/marketplace.json"));
  assert.equal(market.name, "rill-source");
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, "rill");
  assert.equal(market.plugins[0].source.path, "./");
  assert.equal(market.plugins[0].policy.installation, "AVAILABLE");
});

test("packaged skills are discovered at the single native root", () => {
  for (const name of ["rill-recover", "rill-update"]) {
    const skill = read(`skills/${name}/SKILL.md`);
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`));
  }
  assert.equal(existsSync(join(root, "skills/brainstorming")), false);
});

test("exactly one Plugin SessionStart Hook uses installed PLUGIN_ROOT", () => {
  const hooks = JSON.parse(read("hooks/hooks.json"));
  const starts = hooks.hooks.SessionStart;
  assert.equal(starts.length, 1);
  assert.equal(starts[0].matcher, "startup|resume|compact");
  assert.equal(starts[0].hooks.length, 1);
  const command = starts[0].hooks[0].command;
  assert.match(command, /\$\{PLUGIN_ROOT\}\/hooks\/session-start\.mjs/);
  assert.equal(starts[0].hooks[0].timeout, 3);
  assert.equal(starts[0].hooks[0].additionalContextLimit, 500);
  assert.equal(existsSync(join(root, ".codex/hooks.json")), false);
});

test("SessionStart Hook emits bounded context without opening full PRD", () => {
  const result = spawnSync(process.execPath, ["hooks/session-start.mjs"], {
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

test("canonical native Codex role configuration lives in one project location", () => {
  const config = read(".codex/config.toml");
  assert.match(config, /rill@rill-source/);
  for (const role of ["explorer", "worker", "reviewer"]) {
    assert.ok(existsSync(join(root, `.codex/agents/${role}.toml`)));
  }
  assert.match(read(".codex/agents/reviewer.toml"), /not enforce read-only/i);
});

test("malformed Hook input fails without disclosing context", () => {
  const result = spawnSync(process.execPath, ["hooks/session-start.mjs"], {
    cwd: root,
    encoding: "utf8",
    input: "{invalid",
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
});

test("Hook is silent in a project without a PRD", () => {
  const result = spawnSync(process.execPath, [join(root, "hooks/session-start.mjs")], {
    cwd: "/tmp",
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("globally installed Hook is silent in unrelated PRD projects", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rill-unrelated-hook-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, "PRD.md"), "# Unrelated Product Specification\n");
  writeFileSync(join(directory, "AGENTS.md"), "# Unrelated Agent Instructions\n");
  const result = spawnSync(process.execPath, [join(root, "hooks/session-start.mjs")], {
    cwd: directory,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: directory }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("Rill consumer template explicitly opts into bounded Hook context", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rill-enrolled-hook-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, "PRD.md"), "# Product Specification\n");
  writeFileSync(join(directory, "AGENTS.md"), read("templates/consumer/AGENTS.md"));
  const result = spawnSync(process.execPath, [join(root, "hooks/session-start.mjs")], {
    cwd: directory,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: directory }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    JSON.parse(result.stdout).hookSpecificOutput.additionalContext,
    /Rill project detected/,
  );
});

test("Rill consumer entry remains recognized with CRLF checkout line endings", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rill-crlf-hook-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, "PRD.md"), "# Consumer specification\r\n");
  writeFileSync(
    join(directory, "AGENTS.md"),
    read("templates/consumer/AGENTS.md").replaceAll("\n", "\r\n"),
  );
  const result = spawnSync(process.execPath, [join(root, "hooks/session-start.mjs")], {
    cwd: directory,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: directory }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    JSON.parse(result.stdout).hookSpecificOutput.additionalContext,
    /Rill project detected/,
  );
});

test("unrelated FIFO AGENTS file never blocks a globally installed Hook", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rill-fifo-hook-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, "PRD.md"), "# Generic specification\n");
  const fifo = join(directory, "AGENTS.md");
  const mkfifo = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
  assert.equal(mkfifo.status, 0, mkfifo.stderr);
  const result = spawnSync(process.execPath, [join(root, "hooks/session-start.mjs")], {
    cwd: directory,
    encoding: "utf8",
    timeout: 1000,
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: directory }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});
