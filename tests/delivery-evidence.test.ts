import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { candidate, runEvidence } from "../tools/ci-evidence.ts";
import { recordDecisionSource } from "../tools/decision-evidence.ts";
import {
  acceptanceQuestion,
  auditDelivery,
  deliveryState,
  retractDelivery,
  scopeInventory,
} from "../tools/delivery-evidence.ts";
import { lifecycleEvent } from "../tools/recovery-lifecycle.ts";
import { projectContext, publishRecords } from "../tools/task-context.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

let fixture: ReturnType<typeof fixtureProject>;
let nativeMessages: unknown[];
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
beforeEach(() => {
  fixture = fixtureProject();
  nativeMessages = [];
  for (const [key, value] of Object.entries(fixture.environment))
    vi.stubEnv(key, value);
  fixture.state.issue.body +=
    "\n<!-- rill-acceptance:v1 -->\n```json\n" +
    JSON.stringify({
      schemaVersion: 1,
      criteria: [
        {
          id: "R-7",
          source: taskUrl,
          label: "Numeric addition",
          requiredBefore: "pr",
        },
      ],
    }) +
    "\n```\n<!-- /rill-acceptance:v1 -->";
  fixture.save();
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-qm",
      "baseline",
    ],
    { cwd: fixture.root },
  );
  execFileSync("git", ["branch", "-f", "main", "HEAD"], { cwd: fixture.root });
  writeFileSync(
    join(fixture.root, "justfile"),
    "_full-spec-checks:\n    node -e \"require('node:assert/strict').equal(Number('10')+2,12)\"\n",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.cleanup();
});
async function bundle(
  answer = "通过最终验收（已操作）",
  observed: unknown = 12,
  existingFullSpec?: string,
) {
  const c = candidate(fixture.root),
    scope = scopeInventory(projectContext(fixture.root));
  const native = join(fixture.directory, "native.json");
  writeFileSync(native, JSON.stringify({ observed, candidate: c }));
  const review = join(fixture.directory, "review.json");
  writeFileSync(
    review,
    JSON.stringify({
      reviewer: "independent-fixture-reviewer",
      candidate: c,
      scopeSha256: scope.sha256,
      findings: [],
    }),
  );
  const question = acceptanceQuestion(taskUrl, c, scope.sha256);
  const codex = join(fixture.directory, "bin/codex");
  const text =
    "<send_user_message_question_reply>\n" +
    JSON.stringify([{ question, answer }]) +
    "\n</send_user_message_question_reply>";
  const sourceItemId = randomUUID();
  nativeMessages.push({
    turnId: "t",
    item: {
      id: sourceItemId,
      type: "userMessage",
      content: [{ type: "text", text }],
    },
  });
  writeFileSync(
    codex,
    `#!${process.execPath}\nconst rl=require('node:readline').createInterface({input:process.stdin});rl.on('line',l=>{const r=JSON.parse(l);console.log(JSON.stringify({id:r.id,result:r.method==='thread/items/list'?{data:${JSON.stringify(nativeMessages)},nextCursor:null}:{}}));});`,
  );
  chmodSync(codex, 0o755);
  const source = await recordDecisionSource(
    fixture.root,
    {
      stage: "acceptance",
      subject: "final candidate",
      threadId: "owner-thread",
      itemId: sourceItemId,
      quote: answer,
    },
    AbortSignal.timeout(3000),
  );
  await publishRecords(projectContext(fixture.root));
  const fullSpecReceipt =
    existingFullSpec ??
    runEvidence(fixture.root, ["just", "_full-spec-checks"], []).path;
  return {
    schemaVersion: 1 as const,
    authorThreadId: "author-thread",
    scopeSha256: scope.sha256,
    fullSpecReceipt,
    review: { path: review, sha256: digest(readFileSync(review, "utf8")) },
    acceptanceSourceId: source.id,
    criteria: [
      {
        id: "R-7",
        status: "passed" as const,
        evidence: [
          {
            kind: "native" as const,
            path: native,
            sha256: digest(readFileSync(native, "utf8")),
            candidateSha256: c.contentSha256,
          },
        ],
      },
    ],
  };
}
const audit = (input: unknown) =>
  auditDelivery(
    fixture.root,
    input,
    "author-thread",
    AbortSignal.timeout(5000),
  );
test("a current bundle requires publication/readback and becomes stale after a source change", async () => {
  const result = await audit(await bundle());
  expect(result.ready).toBe(true);
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(false);
  await publishRecords(projectContext(fixture.root));
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(true);
  writeFileSync(
    join(fixture.root, "new-code.ts"),
    "export const changed = true;\n",
  );
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(false);
});
test("missing criteria and document-only evidence cannot produce readiness", async () => {
  const input = await bundle();
  input.criteria = [];
  expect((await audit(input)).blockers.join()).toContain("R-7");
  const docs = await bundle();
  Object.assign(docs.criteria[0]?.evidence[0] ?? {}, { kind: "document" });
  expect((await audit(docs)).ready).toBe(false);
});
test("old or negative owner answers do not approve the candidate", async () => {
  const input = await bundle("未通过，仍需修复");
  expect((await audit(input)).blockers.join()).toContain("acceptance");
});
test("remote scope change and offline cache cannot certify delivery", async () => {
  const input = await bundle();
  fixture.state.issue.body += "\nNew required acceptance";
  fixture.save();
  expect((await audit(input)).ready).toBe(false);
  fixture.state.offline = true;
  fixture.save();
  expect((await audit(input)).blockers.join()).toContain("online");
});
test("a retracted pass retains history and its invalid evidence cannot be reused", async () => {
  const input = await bundle();
  const first = await audit(input);
  expect(first.ready).toBe(true);
  await publishRecords(projectContext(fixture.root));
  await retractDelivery(
    fixture.root,
    first.id,
    ["R-7"],
    "Original independent expectation was invalid; obtain corrected evidence",
    "author-thread",
  );
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(false);
  await publishRecords(projectContext(fixture.root));
  expect((await audit(input)).blockers.join()).toContain("retracted");
});

test("missing or changed artifacts revoke live readiness without changing code", async () => {
  const input = await bundle();
  expect((await audit(input)).ready).toBe(true);
  await publishRecords(projectContext(fixture.root));
  writeFileSync(
    input.criteria[0]?.evidence[0]?.path ?? "",
    '{"observed":"changed after audit"}',
  );
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(false);
});

test("valid corrected evidence and a fresh scoped owner choice can pass after retraction", async () => {
  const input = await bundle();
  const first = await audit(input);
  expect(first.ready).toBe(true);
  await publishRecords(projectContext(fixture.root));
  await retractDelivery(
    fixture.root,
    first.id,
    ["R-7"],
    "Correct the native observation premise",
    "author-thread",
  );
  await publishRecords(projectContext(fixture.root));
  const corrected = await bundle(
    "通过最终验收（本次改为证据审阅）",
    { expected: 12, correctedPremise: true },
    input.fullSpecReceipt,
  );
  expect((await audit(corrected)).ready).toBe(true);
  await publishRecords(projectContext(fixture.root));
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(true);
});

test("known GitHub delivery operations require current online authority while another repository is unaffected", async () => {
  const event = {
    hook_event_name: "PreToolUse",
    cwd: fixture.root,
    session_id: "author-thread",
    tool_name: "mcp__codex_apps__github_create_pull_request",
    tool_input: { repository_full_name: "example/project" },
  };
  expect(await lifecycleEvent(event, AbortSignal.timeout(5000))).toMatchObject({
    hookSpecificOutput: { permissionDecision: "deny" },
  });
  const input = await bundle();
  expect((await audit(input)).ready).toBe(true);
  await publishRecords(projectContext(fixture.root));
  expect(await lifecycleEvent(event, AbortSignal.timeout(5000))).toEqual({});
  fixture.state.offline = true;
  fixture.save();
  expect(await lifecycleEvent(event, AbortSignal.timeout(5000))).toMatchObject({
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: expect.stringContaining("online"),
    },
  });
  expect(
    await lifecycleEvent(
      { ...event, tool_input: { repository_full_name: "other/project" } },
      AbortSignal.timeout(5000),
    ),
  ).toEqual({});
  fixture.state.offline = false;
  fixture.state.issue.state = "closed";
  fixture.save();
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  expect(deliveryState(projectContext(fixture.root)).mayCreatePr).toBe(false);
});

test("public facts cannot manufacture delivery conclusions", async () => {
  const record = fixture.record();
  record.payload = {
    executor: "rill-delivery/v1",
    operation: "audit",
    ready: true,
  };
  const result = fixture.run("record", fixture.recordPath(record));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("executor-owned");
});

test("self-review and unresolved important findings do not satisfy independent review", async () => {
  const input = await bundle();
  const review = JSON.parse(readFileSync(input.review.path, "utf8"));
  review.reviewer = "author-thread";
  writeFileSync(input.review.path, JSON.stringify(review));
  input.review.sha256 = digest(readFileSync(input.review.path, "utf8"));
  expect((await audit(input)).blockers.join()).toContain("Independent review");
  review.reviewer = "independent-fixture-reviewer";
  review.findings = [{ severity: "important", resolved: false }];
  writeFileSync(input.review.path, JSON.stringify(review));
  input.review.sha256 = digest(readFileSync(input.review.path, "utf8"));
  expect((await audit(input)).blockers.join()).toContain("blocking findings");
});

test("explicitly unverified command items require evidence mapping rather than disappearing", async () => {
  const input = await bundle();
  input.fullSpecReceipt = runEvidence(
    fixture.root,
    ["just", "_full-spec-checks"],
    ["separate numeric observation pending"],
  ).path;
  expect((await audit(input)).blockers.join()).toContain("unverified");
  await publishRecords(projectContext(fixture.root));
  const resolved = {
    ...input,
    resolvedUnverified: [
      { item: "separate numeric observation pending", criterionIds: ["R-7"] },
    ],
  };
  expect((await audit(resolved)).ready).toBe(true);
});
