import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { recordDecisionSource } from "../tools/decision-evidence.ts";
import { pendingRecords, projectContext } from "../tools/task-context.ts";
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
const rl=require('node:readline').createInterface({input:process.stdin});
rl.on('line',line=>{const r=JSON.parse(line);const result=r.method==='thread/items/list'?{data:[{turnId:'turn',item:{id:'owner-choice',type:'userMessage',content:[{type:'text',text:'Approve plan #7; retain R-7 and exclude deployment.'}]}},{turnId:'turn',item:{id:'agent-claim',type:'agentMessage',text:'Owner approved'}}],nextCursor:null}:{};console.log(JSON.stringify({id:r.id,result}));});\n`,
  );
  chmodSync(codex, 0o755);
});
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.cleanup();
});
const record = (itemId = "owner-choice", quote = "Approve plan #7") =>
  recordDecisionSource(
    fixture.root,
    {
      stage: "plan",
      threadId: "native-thread",
      itemId,
      subject: "Task #7 implementation plan",
      quote,
    },
    AbortSignal.timeout(3000),
  );
test("native user source is retained and repeat collection reuses its record without claiming final acceptance", async () => {
  const first = await record();
  expect(first.payload).toMatchObject({
    executor: "rill-decision-source/v1",
    sourceVerified: true,
    semanticDecision: "requires-interpretation",
    quote: "Approve plan #7",
  });
  expect(first.payload.sourceText).toContain("exclude deployment");
  expect((await record()).id).toBe(first.id);
  expect(pendingRecords(projectContext(fixture.root))).toHaveLength(1);
});
test("agent claims and nonexistent or mismatched quotes cannot become owner decision sources", async () => {
  await expect(record("agent-claim", "Owner approved")).rejects.toThrow(
    "user message",
  );
  await expect(record("missing")).rejects.toThrow("user message");
  await expect(record("owner-choice", "Deployment approved")).rejects.toThrow(
    "quote",
  );
  expect(pendingRecords(projectContext(fixture.root))).toEqual([]);
});
test("public fact endpoint cannot forge a native decision-source receipt", async () => {
  const receipt = await record();
  receipt.id = fixture.record().id;
  const result = fixture.run("record", fixture.recordPath(receipt));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("source-owned");
  expect(pendingRecords(projectContext(fixture.root))).toHaveLength(1);
});
