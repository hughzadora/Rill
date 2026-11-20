import assert from "node:assert/strict";
import test from "node:test";
import { verifyNativeEvidence } from "../dist/native-evidence.js";

const event = (type, item = undefined) => JSON.stringify({ type, ...(item ? { item } : {}) });
const skillRead = event("item.completed", {
  type: "mcp_tool_call",
  server: "codex_apps",
  tool: "linux_commander.read_file",
  arguments: { path: "/sandbox/plugins/rill/skills/rill-recover/SKILL.md" },
  status: "completed",
});
const acceptedSpawn = event("item.completed", {
  type: "collab_tool_call",
  tool: "spawn_agent",
  receiver_thread_ids: ["thread-2"],
  status: "completed",
});

test("rejects a model claim of delegation when native events only show empty wait", () => {
  const trace = [
    event("thread.started"),
    event("item.completed", {
      type: "collab_tool_call",
      tool: "wait",
      receiver_thread_ids: [],
      status: "completed",
    }),
    event("item.completed", {
      type: "agent_message",
      text: "The explorer replied; spawn accepted.",
    }),
    event("turn.completed"),
  ].join("\n");
  const proof = verifyNativeEvidence(trace, "");
  assert.equal(proof.delegation, "NOT_VERIFIED");
  assert.equal(proof.skillRead, "NOT_VERIFIED");
});

test("counts actual completed skill read and explicit nonempty spawn event only", () => {
  const trace = [event("thread.started"), skillRead, acceptedSpawn, event("turn.completed")].join(
    "\n",
  );
  const proof = verifyNativeEvidence(trace, "");
  assert.equal(proof.skillRead, "OBSERVED");
  assert.equal(proof.delegation, "OBSERVED");
  assert.equal(proof.session, "COMPLETED");
  assert.equal(proof.projectConfig, "UNKNOWN");
});

test("untrusted project configuration warning blocks native role claims", () => {
  const trace = [skillRead, acceptedSpawn, event("turn.completed")].join("\n");
  const proof = verifyNativeEvidence(
    trace,
    "warning: Untrusted project-local configuration is disabled.",
  );
  assert.equal(proof.projectConfig, "DISABLED");
  assert.equal(proof.customRoles, "NOT_VERIFIED");
});

test("corrupted JSONL cannot be counted as proof", () => {
  assert.throws(
    () => verifyNativeEvidence(`${event("thread.started")}\n{not json`, ""),
    /Invalid Codex JSONL/,
  );
});

test("missing turn completion fails closed even if a skill was read", () => {
  const proof = verifyNativeEvidence(skillRead, "");
  assert.equal(proof.session, "NOT_VERIFIED");
});
