import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { lifecycleEvent } from "../tools/recovery-lifecycle.ts";
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
  const match = JSON.stringify(response).match(/at ([^ ]+\.json)/);
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
  expect(JSON.stringify(saved.history)).toContain("no deployment");
  expect(JSON.stringify(saved.history)).toContain('"exitCode":1');
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

test("a corrupt or mismatched checkpoint cannot masquerade as restored task data", async () => {
  const path = pathFrom(await capture());
  const saved = JSON.parse(readFileSync(path, "utf8"));
  saved.taskUrl = "https://github.com/example/project/issues/8";
  writeFileSync(path, JSON.stringify(saved));
  expect(await restore()).toMatchObject({
    continue: false,
    stopReason: expect.stringContaining("another task"),
  });
  writeFileSync(path, "{");
  expect(await restore()).toMatchObject({ continue: false });
});

test("ordinary events retain existing guard behavior without history reads", async () => {
  expect(
    await lifecycleEvent(event("PreToolUse"), AbortSignal.timeout(3000)),
  ).toEqual({});
});
