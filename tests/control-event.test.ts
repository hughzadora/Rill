import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { evaluateEvent, taskStatus } from "../tools/control-event.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

describe("personal task preconditions", () => {
  let fixture: ReturnType<typeof fixtureProject>;
  beforeEach(() => {
    fixture = fixtureProject();
  });
  afterEach(() => {
    fixture.cleanup();
  });
  const event = (hook_event_name = "PreToolUse") => ({
    hook_event_name,
    cwd: fixture.root,
    session_id: "test-session",
    tool_name: "Bash",
    tool_input: { command: "unrelated command, not a sentinel" },
  });
  const sync = () => {
    const result = fixture.run("sync", taskUrl);
    expect(result.status, result.stderr).toBe(0);
  };

  test("does not enroll an unrelated directory implicitly", () => {
    expect(evaluateEvent({ ...event(), cwd: tmpdir() })).toEqual({});
  });
  test("rejects tools when an enrolled task has no durable binding", () => {
    expect(evaluateEvent(event())).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
      },
    });
  });
  test("new projects can recover before a first commit", () => {
    sync();
    expect(taskStatus(fixture.root)).toMatchObject({
      enrolled: true,
      revision: null,
      revisionState: "unborn",
      taskUrl,
    });
    expect(evaluateEvent(event())).toEqual({});
  });
  test("reports the actual committed Git state separately from the cached task", () => {
    sync();
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Rill Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "--allow-empty",
        "-qm",
        "test baseline",
      ],
      { cwd: fixture.root },
    );
    const status = taskStatus(fixture.root);
    expect(status).toMatchObject({
      enrolled: true,
      revisionState: "committed",
    });
    expect("revision" in status && status.revision).toMatch(/^[0-9a-f]{40}$/);
  });
  test("does not allow a closed task to authorize tools", () => {
    fixture.state.issue.state = "closed";
    fixture.save();
    sync();
    expect(evaluateEvent(event())).toMatchObject({
      hookSpecificOutput: { permissionDecision: "deny" },
    });
  });
  test("recovery includes task requirements and unique unsynchronized facts", () => {
    sync();
    const record = fixture.record();
    expect(fixture.run("record", fixture.recordPath(record)).status).toBe(0);
    const result = evaluateEvent(event("SessionStart"));
    expect(result).toHaveProperty("hookSpecificOutput.additionalContext");
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("R-7");
    expect(serialized).toContain("deployment");
    expect(serialized).toContain(record.id);
    expect(taskStatus(fixture.root)).toMatchObject({
      coverage: {
        nativeHistoryCoverage: "pending",
        automaticRepairAttempts: "pending",
        finalAcceptance: "pending",
      },
    });
  });
});
