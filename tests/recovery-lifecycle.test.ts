import {
  chmodSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { evaluateEvent } from "../tools/control-event.ts";
import { recoverTask } from "../tools/recover-task.ts";
import { lifecycleEvent } from "../tools/recovery-lifecycle.ts";
import { projectContext } from "../tools/task-context.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

let fixture: ReturnType<typeof fixtureProject>;
beforeEach(() => {
  fixture = fixtureProject();
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  for (const [key, value] of Object.entries(fixture.environment))
    vi.stubEnv(key, value);
  const codex = join(fixture.directory, "bin/codex");
  writeFileSync(
    codex,
    `#!${process.execPath}
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', line => {
 const r = JSON.parse(line);
 let result = {};
 if (r.method === 'thread/items/list') result = r.params.cursor
 ? { data: [{turnId:'t2',item:{id:'failure',type:'commandExecution',exitCode:1,status:'failed'}}],nextCursor:null }
 : { data: [{turnId:'t1',item:{id:'correction',type:'userMessage',content:[{type:'text',text:'Keep R-7; no deployment; run targeted checks for behavior changes.'}]}}],nextCursor:'page-2' };
 console.log(JSON.stringify({id:r.id,result}));
});
`,
  );
  chmodSync(codex, 0o755);
});
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.cleanup();
});
const event = (name: string) => ({
  hook_event_name: name,
  cwd: fixture.root,
  session_id: "native-thread",
});
const capture = () =>
  lifecycleEvent(event("PreCompact"), AbortSignal.timeout(3000));
const restore = () =>
  lifecycleEvent(event("SessionStart"), AbortSignal.timeout(3000));

function pathFrom(response: unknown) {
  const match = JSON.stringify(response).match(/(?:at|:) ([^ ]+\.json)/);
  if (!match?.[1]) throw new Error("Missing checkpoint path");
  return match[1];
}

test("durably captures unique outbox facts, latest user correction, failure and final history page", async () => {
  const fact = fixture.record();
  // A source reference is not a receipt that all earlier decisions were synchronized.
  fact.source.threadId = "native-thread";
  fact.source.itemId = "failure";
  expect(fixture.run("record", fixture.recordPath(fact)).status).toBe(0);
  const path = pathFrom(await capture());
  const saved = JSON.parse(readFileSync(path, "utf8"));
  expect(saved.task.pendingIds).toContain(fact.id);
  expect(saved.task.records).toContainEqual(fact);
  expect(saved.preferences).toContain("behavioral risk");
  expect(saved.history.history[0]).toMatchObject({
    readStatus: "exhausted",
    pageCount: 2,
  });
  const recoveryReport = JSON.parse(
    readFileSync(saved.history.reportPath, "utf8"),
  );
  expect(JSON.stringify(recoveryReport.history)).toContain("no deployment");
  expect(JSON.stringify(recoveryReport.history)).toContain('"exitCode":1');
  expect(saved.semanticCompleteness).toBe("requires-reconciliation");
  expect(JSON.stringify(await restore())).toContain(path);
});

test("unavailable native history retains the checkpoint and marks unknown coverage", async () => {
  writeFileSync(
    join(fixture.directory, "bin/codex"),
    `#!${process.execPath}\nprocess.exit(1);\n`,
  );
  const path = pathFrom(await capture());
  const saved = JSON.parse(readFileSync(path, "utf8"));
  expect(saved.task.taskUrl).toBe(taskUrl);
  expect(saved.history.history[0].readStatus).toBe("unknown");
  expect(JSON.stringify(await restore())).toContain("requires-reconciliation");
});

test("a corrupt or mismatched checkpoint is rejected while actual task and history are freshly recovered", async () => {
  const path = pathFrom(await capture());
  const saved = JSON.parse(readFileSync(path, "utf8"));
  saved.taskUrl = "https://github.com/example/project/issues/8";
  writeFileSync(path, JSON.stringify(saved));
  let response = await restore();
  expect(response).not.toHaveProperty("continue", false);
  let report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.checkpoint).toMatchObject({
    status: "rejected",
    reason: expect.stringContaining("another task"),
  });
  expect(report.state.taskUrl).toBe(taskUrl);
  expect(report.history[0].readStatus).toBe("exhausted");
  expect(JSON.parse(readFileSync(path, "utf8")).taskUrl).toContain("issues/8");
  expect(report.mechanicalGaps.join("\n")).toContain(
    "Pre-compaction checkpoint rejected",
  );
  const edit = { ...event("PreToolUse"), tool_name: "apply_patch" };
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  await recoverTask(fixture.root, "native-thread", AbortSignal.timeout(3000));
  expect(evaluateEvent(edit)).toEqual({});
  writeFileSync(path, "{");
  response = await restore();
  report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.checkpoint.status).toBe("rejected");
  expect(report.mechanicalGaps.join("\n")).toContain(
    "Pre-compaction checkpoint rejected",
  );
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  expect(readFileSync(path, "utf8")).toBe("{");
});

test("ordinary events retain existing guard behavior without history reads", async () => {
  expect(
    await lifecycleEvent(event("PreToolUse"), AbortSignal.timeout(3000)),
  ).toEqual({});
});

test("a new chat without a precompact checkpoint actually refreshes task and native history", async () => {
  fixture.state.issue.body =
    "Latest owner correction: retain R-7; no deployment";
  fixture.save();
  const response = await restore();
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.state.taskBody).toContain("Latest owner correction");
  expect(report.history[0]).toMatchObject({
    readStatus: "exhausted",
    pageCount: 2,
  });
  expect(report.checkpoint.status).toBe("absent");
  expect(report.mechanicalGaps).toEqual([]);
  expect(report.workingTree.contentSha256).toMatch(/^[a-f0-9]{64}$/);
});

test("SessionStart lifecycle preserves the pinned-standard block and recovery context", async () => {
  writeFileSync(
    join(fixture.root, ".rill/project.json"),
    JSON.stringify({
      schemaVersion: 2,
      repository: "example/project",
      standard: { version: "1.2.3", digest: "a".repeat(64) },
      tools: [],
      exceptions: [],
    }),
  );
  const response = await restore();
  expect(response).toMatchObject({
    hookSpecificOutput: {
      additionalContext: expect.stringContaining(
        "Rill standard activation is blocked",
      ),
    },
  });
  const context = JSON.stringify(response);
  expect(context).toContain("Rill recovery report at");
  expect(context).toContain("diagnostics and recovery remain available");
  expect(context).not.toContain("Owner working agreements");
});

test("bootstrap leaves diagnostics available while edits stay gated until real recovery", async () => {
  rmSync(join(projectContext(fixture.root).recoveryRoot, "active.json"));
  const response = await restore();
  expect(response).not.toHaveProperty("continue", false);
  const edit = { ...event("PreToolUse"), tool_name: "apply_patch" };
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  expect(evaluateEvent({ ...edit, tool_name: "Bash" })).toEqual({});
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  await recoverTask(fixture.root, "native-thread", AbortSignal.timeout(3000));
  expect(evaluateEvent(edit)).toEqual({});
});

test("online recovery repairs a corrupt authoritative cache without losing unique outbox facts", async () => {
  const fact = fixture.record();
  expect(fixture.run("record", fixture.recordPath(fact)).status).toBe(0);
  const context = projectContext(fixture.root);
  const snapshots = readdirSync(context.recoveryRoot, {
    recursive: true,
    encoding: "utf8",
  }).filter((path) => path.endsWith("snapshot.json"));
  expect(snapshots).toHaveLength(1);
  const snapshot = join(context.recoveryRoot, snapshots[0] ?? "");
  writeFileSync(snapshot, "{");
  const response = await restore();
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.state.pendingIds).toContain(fact.id);
  expect(report.state.records).toContainEqual(fact);
  expect(report.remoteStatus).toBe("online");
  expect(report.mechanicalGaps).toEqual([]);
});

test("an offline restart retains new facts and clearly marks cached authority", async () => {
  const fact = fixture.record();
  expect(fixture.run("record", fixture.recordPath(fact)).status).toBe(0);
  fixture.state.offline = true;
  fixture.save();
  const response = await restore();
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.remoteStatus).toBe("cached");
  expect(report.state.pendingIds).toContain(fact.id);
  expect(report.state.records).toContainEqual(fact);
  expect(report.semanticCompleteness).toBe("requires-reconciliation");
});

test("stale checkpoint content is exposed alongside current code and updated requirements", async () => {
  const old = pathFrom(await capture());
  writeFileSync(
    join(fixture.root, "changed.ts"),
    "export const changed=true;\n",
  );
  fixture.state.issue.body = "New acceptance still excludes deployment";
  fixture.save();
  const response = await restore();
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.checkpoint.path).toBe(old);
  expect(report.checkpoint.comparison).toMatchObject({
    contentChanged: true,
    authorityChanged: true,
  });
  expect(report.state.taskBody).toBe(
    "New acceptance still excludes deployment",
  );
  expect(report.mechanicalGaps.join("\n")).toContain(
    "Previous checkpoint differs",
  );
  const edit = { ...event("PreToolUse"), tool_name: "apply_patch" };
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  await recoverTask(fixture.root, "native-thread", AbortSignal.timeout(3000));
  expect(evaluateEvent(edit)).toEqual({});
});

test("unknown source coverage blocks edits, leaves diagnostics live and clears only after source recovery", async () => {
  const codex = join(fixture.directory, "bin/codex");
  const original = readFileSync(codex, "utf8");
  writeFileSync(codex, `#!${process.execPath}\nprocess.exit(1);\n`);
  const response = await restore();
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.mechanicalGaps).toContain(
    "Native history unavailable for native-thread",
  );
  const edit = { ...event("PreToolUse"), tool_name: "apply_patch" };
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  expect(evaluateEvent({ ...edit, tool_name: "Bash" })).toEqual({});
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  writeFileSync(codex, original);
  await recoverTask(fixture.root, "native-thread", AbortSignal.timeout(3000));
  expect(evaluateEvent(edit)).toEqual({});
});

test("offline corrupt cache preserves unique facts and exposes a recovery gap instead of stopping diagnosis", async () => {
  const fact = fixture.record();
  expect(fixture.run("record", fixture.recordPath(fact)).status).toBe(0);
  const context = projectContext(fixture.root);
  const files = readdirSync(context.recoveryRoot, {
    recursive: true,
    encoding: "utf8",
  });
  const snapshot = files.find((path) => path.endsWith("snapshot.json"));
  const outbox = files.find((path) => path.endsWith(`${fact.id}.json`));
  if (!snapshot || !outbox) throw new Error("Missing cache or outbox fixture");
  const originalFact = readFileSync(join(context.recoveryRoot, outbox), "utf8");
  writeFileSync(join(context.recoveryRoot, snapshot), "{");
  fixture.state.offline = true;
  fixture.save();
  const response = await restore();
  expect(response).not.toHaveProperty("continue", false);
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.mechanicalGaps.length).toBeGreaterThan(0);
  expect(readFileSync(join(context.recoveryRoot, outbox), "utf8")).toBe(
    originalFact,
  );
  expect(readFileSync(join(context.recoveryRoot, snapshot), "utf8")).toBe("{");
  const edit = { ...event("PreToolUse"), tool_name: "apply_patch" };
  expect(evaluateEvent(edit)).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  expect(evaluateEvent({ ...edit, tool_name: "Bash" })).toEqual({});
  fixture.state.offline = false;
  fixture.save();
  await restore();
  expect(evaluateEvent(edit)).toEqual({});
});

test("a repeated native-history cursor exposes incomplete coverage and gates edits", async () => {
  const codex = join(fixture.directory, "bin/codex");
  writeFileSync(
    codex,
    `#!${process.execPath}
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', line => {
 const r = JSON.parse(line);
 const result = r.method === 'thread/items/list'
 ? { data: [], nextCursor: 'same-cursor' }
 : {};
 console.log(JSON.stringify({id:r.id,result}));
});
`,
  );
  const response = await restore();
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(report.history[0].readStatus).toBe("unknown");
  expect(report.mechanicalGaps).toContain(
    "Native history unavailable for native-thread",
  );
  expect(
    evaluateEvent({ ...event("PreToolUse"), tool_name: "apply_patch" }),
  ).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  expect(evaluateEvent({ ...event("PreToolUse"), tool_name: "Bash" })).toEqual(
    {},
  );
});

test("oversized task data stays in the recovery report behind a bounded pointer", async () => {
  fixture.state.issue.body = "approved task fact ".repeat(2000);
  fixture.save();
  const response = await restore();
  const serialized = JSON.stringify(response);
  const report = JSON.parse(readFileSync(pathFrom(response), "utf8"));
  expect(serialized.length).toBeLessThan(5000);
  expect(report.state.taskBody).toBe(fixture.state.issue.body);
  expect(serialized).toContain("Rill recovery report at ");
  const result = await recoverTask(
    fixture.root,
    "native-thread",
    AbortSignal.timeout(3000),
  );
  if (!("reportPath" in result) || typeof result.reportPath !== "string")
    throw new Error("Recovery report missing");
  expect(JSON.stringify(result).length).toBeLessThan(5000);
  expect(
    JSON.parse(readFileSync(result.reportPath, "utf8")).state.taskBody,
  ).toBe(fixture.state.issue.body);
});

test("recover_task bounds returned working-tree details while retaining them in its report", async () => {
  const names = Array.from(
    { length: 100 },
    (_, index) => `${String(index).padStart(3, "0")}-${"x".repeat(220)}.txt`,
  );
  for (const name of names) writeFileSync(join(fixture.root, name), "x");
  const result = await recoverTask(
    fixture.root,
    "native-thread",
    AbortSignal.timeout(3000),
  );
  if (!("reportPath" in result) || typeof result.reportPath !== "string")
    throw new Error("Recovery report missing");
  expect(JSON.stringify(result).length).toBeLessThan(5000);
  if (!result.workingTree) throw new Error("Working-tree summary missing");
  expect(result.workingTree.changedPathCount).toBeGreaterThanOrEqual(100);
  expect(result.workingTree.statusOmittedCount).toBeGreaterThanOrEqual(96);
  expect(result.workingTree.statusTruncated).toBe(true);
  expect(result.workingTree.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  const report = JSON.parse(readFileSync(result.reportPath, "utf8"));
  expect(report.workingTree.status).toContain(names[0]);
  expect(report.workingTree.status.length).toBeGreaterThan(5000);
  expect(report.state.records).toEqual([]);
  expect(report.state.pendingIds).toEqual([]);
  expect(report.history[0]).toMatchObject({
    readStatus: "exhausted",
    pageCount: 2,
  });
});
