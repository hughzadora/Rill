import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test } from "vitest";
import { evaluateEvent } from "../tools/control-event.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

let fixture: ReturnType<typeof fixtureProject>;
const cli = fileURLToPath(
  new URL("../tools/repair-evidence.ts", import.meta.url),
);
beforeEach(() => {
  fixture = fixtureProject();
  expect(fixture.run("sync", taskUrl).status).toBe(0);
});
afterEach(() => fixture.cleanup());
function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: fixture.root,
    env: {
      ...process.env,
      ...fixture.environment,
      RILL_THREAD_ID: "test-owned-source",
    },
    encoding: "utf8",
  });
}
function result(value: ReturnType<typeof run>) {
  expect(value.stdout, value.stderr).not.toBe("");
  return JSON.parse(value.stdout.trim().split("\n").at(-1) ?? "");
}
const check = (key = "BUG-7", code = "process.exit(1)") =>
  run(
    "check",
    key,
    "explicit repair hypothesis",
    "--",
    process.execPath,
    "-e",
    code,
  );
function twoFailures() {
  const first = check();
  expect(first.status).toBe(1);
  expect(result(first).exitCode).toBe(1);
  writeFileSync(
    join(fixture.root, "repair.txt"),
    "second actual repair candidate",
  );
  const second = check();
  expect(second.status).toBe(1);
  expect(result(second).exitCode).toBe(1);
}

test("two actual failures survive cache loss and block a renamed repair before execution", () => {
  twoFailures();
  expect(fixture.run("publish").status).toBe(0);
  rmSync(join(fixture.root, ".git/rill-recovery"), { recursive: true });
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  const blocked = check(
    "RENAMED",
    "require('node:fs').writeFileSync('third-marker','ran')",
  );
  expect(blocked.status).toBe(2);
  expect(blocked.stderr).toContain("diagnosis");
  expect(existsSync(join(fixture.root, "third-marker"))).toBe(false);
  const state = result(run("status"));
  expect(state.problems["BUG-7"].failedAttempts).toBe(2);
  expect(state.blockedProblems).toContain("BUG-7");
  const event = {
    hook_event_name: "PreToolUse",
    cwd: fixture.root,
    session_id: "another-native-chat",
    tool_name: "apply_patch",
  };
  expect(evaluateEvent(event)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  expect(evaluateEvent({ ...event, tool_name: "Bash" })).toEqual({});
  expect(
    evaluateEvent({
      ...event,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__rill__repair_check",
    }),
  ).toMatchObject({
    systemMessage: expect.stringContaining('"consecutiveFailures":2'),
  });
});

test("a repeated failed check cannot create another repair round without a changed candidate", () => {
  expect(check().status).toBe(1);
  const repeated = check();
  expect(repeated.status).toBe(2);
  expect(repeated.stderr).toContain("unchanged");
  expect(result(run("status")).problems["BUG-7"].failedAttempts).toBe(1);
});

test("new actual diagnosis evidence plus its interpretation permits the next check and retains failures", () => {
  twoFailures();
  const evidence = result(
    run(
      "diagnose",
      "BUG-7",
      "--",
      process.execPath,
      "-e",
      "console.log('observed: missing conversion')",
    ),
  );
  expect(result(run("status")).blockedProblems).toContain("BUG-7");
  const interpreted = run(
    "interpret",
    "BUG-7",
    evidence.id,
    "The experiment distinguishes missing conversion from incorrect input; next repair will convert before addition.",
  );
  expect(interpreted.status, interpreted.stderr).toBe(0);
  writeFileSync(
    join(fixture.root, "repair.txt"),
    "candidate with observed conversion fix",
  );
  expect(check("BUG-7", "process.exit(0)").status).toBe(0);
  const state = result(run("status"));
  expect(state.problems["BUG-7"]).toMatchObject({
    failedAttempts: 2,
    consecutiveFailures: 0,
  });
  expect(state.blockedProblems).toEqual([]);
});

test("interpretation cannot cite evidence from before the last failure or another problem", () => {
  const old = result(
    run(
      "diagnose",
      "BUG-7",
      "--",
      process.execPath,
      "-e",
      "console.log('old evidence')",
    ),
  );
  twoFailures();
  expect(
    run(
      "interpret",
      "BUG-7",
      old.id,
      "This older observation cannot explain the newer failure.",
    ).status,
  ).toBe(2);
  const other = result(
    run(
      "diagnose",
      "OTHER",
      "--",
      process.execPath,
      "-e",
      "console.log('unrelated observation')",
    ),
  );
  expect(
    run(
      "interpret",
      "BUG-7",
      other.id,
      "Different problem evidence cannot unlock this repair.",
    ).status,
  ).toBe(2);
  expect(result(run("status")).blockedProblems).toContain("BUG-7");
});

test("public fact entry cannot manufacture an executor-owned passing result", () => {
  const failed = check();
  expect(failed.status).toBe(1);
  const receipt = JSON.parse(readFileSync(result(failed).receiptPath, "utf8"));
  receipt.record.id = fixture.record().id;
  receipt.record.payload.exitCode = 0;
  const forged = fixture.run("record", fixture.recordPath(receipt.record));
  expect(forged.status).toBe(1);
  expect(forged.stderr).toContain("executor-owned");
  expect(result(run("status")).problems["BUG-7"].failedAttempts).toBe(1);
});
