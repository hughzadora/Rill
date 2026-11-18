import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod/v4";
import {
  candidate,
  separateAcceptanceBoundary,
  verifyEvidence,
  verifyFullSpecEvidence,
} from "./ci-evidence.ts";
import { repairState } from "./repair-evidence.ts";
import {
  activeTask,
  cachedTask,
  type ProjectContext,
  pendingRecords,
  projectContext,
  recordFact,
  syncTask,
  type TaskRecord,
  taskRecords,
} from "./task-context.ts";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const artifactSchema = z.object({
  path: z.string().min(1),
  sha256: digestSchema,
});
const inventorySchema = z.object({
  schemaVersion: z.literal(1),
  criteria: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Z][A-Z0-9-]*$/),
        source: z.string().url(),
        label: z.string().min(1),
        requiredBefore: z.enum(["pr", "delivery"]),
      }),
    )
    .min(1),
});
export const deliveryBundleSchema = z.object({
  schemaVersion: z.literal(1),
  authorThreadId: z.string().min(1),
  scopeSha256: digestSchema,
  fullSpecReceipt: z.string().min(1),
  review: artifactSchema,
  acceptanceSourceId: z.string().uuid(),
  resolvedUnverified: z
    .array(
      z.object({
        item: z.string().min(1),
        criterionIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .default([]),
  criteria: z.array(
    z.object({
      id: z.string().min(1),
      status: z.enum(["passed", "failed", "unverified"]),
      evidence: z
        .array(
          artifactSchema.extend({
            kind: z.enum(["command", "native"]),
            candidateSha256: digestSchema,
          }),
        )
        .min(1),
    }),
  ),
});
const auditPayloadSchema = z.object({
  executor: z.literal("rill-delivery/v1"),
  operation: z.literal("audit"),
  candidate: z.unknown(),
  scopeSha256: z.string().nullable(),
  ready: z.boolean(),
  blockers: z.array(z.string()),
  bundle: deliveryBundleSchema.nullable(),
});
const retractionSchema = z.object({
  executor: z.literal("rill-delivery/v1"),
  operation: z.literal("retract"),
  receiptId: z.string().uuid(),
  reason: z.string().min(1),
  invalidated: z
    .array(z.object({ criterionId: z.string(), sha256: digestSchema }))
    .min(1),
});
export function scopeInventory(context: ProjectContext) {
  const snapshot = cachedTask(context);
  const matches = [
    ...(snapshot.issue.body ?? "").matchAll(
      /<!-- rill-acceptance:v1 -->\s*```json\s*([\s\S]*?)```\s*<!-- \/rill-acceptance:v1 -->/g,
    ),
  ];
  if (matches.length !== 1 || !matches[0]?.[1])
    throw new Error(
      "Exactly one authoritative acceptance inventory is required in the current task",
    );
  const inventory = inventorySchema.parse(JSON.parse(matches[0][1]));
  if (
    new Set(inventory.criteria.map((c) => c.id)).size !==
    inventory.criteria.length
  )
    throw new Error("Duplicate authoritative acceptance IDs");
  const scopeRecords = taskRecords(context).filter(
    (r) =>
      r.kind === "requirement" ||
      r.kind === "correction" ||
      (r.payload.executor === "rill-decision-source/v1" &&
        r.payload.stage !== "acceptance"),
  );
  const comments = snapshot.comments.filter(
    (c) => !c.body?.startsWith("<!-- rill-record:v1:"),
  );
  return {
    ...inventory,
    sha256: hash(
      JSON.stringify({ body: snapshot.issue.body, comments, scopeRecords }),
    ),
  };
}
export function acceptanceQuestion(
  taskUrl: string,
  current: ReturnType<typeof candidate>,
  scopeSha256: string,
) {
  return `请对当前完整批次做最终验收：${taskUrl}。候选 revision=${current.revision}，内容 SHA256=${current.contentSha256}，批准范围／验收映射 SHA256=${scopeSha256}。请依据原规格、实际操作及独立审查核对全部必需验收项；选择已操作通过，或明确将本次人工操作改为证据审阅后通过。存在未完成、失败或未知项时选择未通过。这不是合并或发布授权。`;
}
export const finalAcceptanceAnswers = Object.freeze([
  "通过最终验收（已操作）",
  "通过最终验收（本次改为证据审阅）",
]);
function hasCurrentAcceptance(
  record: TaskRecord | undefined,
  question: string,
) {
  if (
    record?.payload.executor !== "rill-decision-source/v1" ||
    record.payload.stage !== "acceptance" ||
    record.payload.sourceVerified !== true ||
    typeof record.payload.sourceText !== "string" ||
    hash(record.payload.sourceText) !== record.payload.sourceSha256
  )
    return false;
  const match =
    /<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>/.exec(
      record.payload.sourceText,
    );
  if (!match?.[1]) return false;
  const replies = z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .safeParse(JSON.parse(match[1]));
  return (
    replies.success &&
    replies.data.some(
      (r) =>
        r.question === question && finalAcceptanceAnswers.includes(r.answer),
    )
  );
}
function artifact(input: z.infer<typeof artifactSchema>) {
  const raw = readFileSync(input.path, "utf8");
  if (hash(raw) !== input.sha256) throw new Error("Artifact hash mismatch");
  return JSON.parse(raw);
}
function retractions(context: ProjectContext) {
  return taskRecords(context)
    .filter(
      (r) =>
        r.payload.executor === "rill-delivery/v1" &&
        r.payload.operation === "retract",
    )
    .map((r) => retractionSchema.parse(r.payload));
}
function verifyBundle(
  context: ProjectContext,
  bundle: z.infer<typeof deliveryBundleSchema>,
  scope: ReturnType<typeof scopeInventory>,
  threadId: string,
) {
  const blockers: string[] = [],
    cwd = context.root,
    current = candidate(cwd),
    taskUrl = activeTask(context);
  if (bundle.authorThreadId !== threadId)
    blockers.push("Author thread source mismatch");
  if (bundle.scopeSha256 !== scope.sha256)
    blockers.push(
      "Approved scope or acceptance inventory changed; reconcile before delivery",
    );
  try {
    const checked = verifyFullSpecEvidence(cwd, bundle.fullSpecReceipt);
    for (const item of z.array(z.string()).parse(checked.unverified)) {
      // This standard boundary is discharged only by all acceptance, review and owner checks below.
      if (item === separateAcceptanceBoundary) continue;
      const resolution = bundle.resolvedUnverified.find((r) => r.item === item);
      if (
        !resolution ||
        resolution.criterionIds.some(
          (id) =>
            !scope.criteria.some((c) => c.id === id) ||
            !bundle.criteria.some((c) => c.id === id && c.status === "passed"),
        )
      )
        blockers.push(
          `Command unverified item lacks current acceptance evidence mapping: ${item}`,
        );
    }
  } catch (e) {
    blockers.push(`Full-spec evidence: ${String(e)}`);
  }
  const ids = bundle.criteria.map((c) => c.id);
  if (new Set(ids).size !== ids.length)
    blockers.push("Duplicate submitted acceptance IDs");
  for (const expected of scope.criteria.filter(
    (c) => c.requiredBefore === "pr",
  )) {
    const proof = bundle.criteria.find((c) => c.id === expected.id);
    if (proof?.status !== "passed")
      blockers.push(
        `Acceptance ${expected.id} is missing, failed or unverified`,
      );
  }
  const invalidated = retractions(context).flatMap((r) => r.invalidated);
  for (const proof of bundle.criteria) {
    if (!scope.criteria.some((c) => c.id === proof.id))
      blockers.push(`Unknown acceptance ${proof.id}`);
    for (const evidence of proof.evidence) {
      if (
        invalidated.some(
          (e) => e.criterionId === proof.id && e.sha256 === evidence.sha256,
        )
      )
        blockers.push(`Acceptance ${proof.id} reuses retracted evidence`);
      try {
        if (evidence.candidateSha256 !== current.contentSha256)
          throw new Error("Evidence belongs to an older candidate");
        const observed = artifact(evidence);
        if (evidence.kind === "command") verifyEvidence(cwd, evidence.path);
        else if (
          !isDeepStrictEqual(observed.candidate, current) ||
          !("observed" in observed)
        )
          throw new Error(
            "Native evidence requires current-candidate observation envelope",
          );
      } catch (e) {
        blockers.push(`Acceptance ${proof.id}: ${String(e)}`);
      }
    }
  }
  try {
    const review = z
      .object({
        reviewer: z.string().min(1),
        candidate: z.unknown(),
        scopeSha256: digestSchema,
        findings: z.array(
          z.object({
            severity: z.enum(["critical", "important", "minor"]),
            resolved: z.boolean().default(false),
          }),
        ),
      })
      .parse(artifact(bundle.review));
    if (
      review.reviewer === threadId ||
      !isDeepStrictEqual(review.candidate, current) ||
      review.scopeSha256 !== scope.sha256
    )
      throw new Error("Independent review does not match this candidate/scope");
    if (review.findings.some((f) => f.severity !== "minor" && !f.resolved))
      throw new Error("Independent review has unresolved blocking findings");
  } catch (e) {
    blockers.push(`Independent review: ${String(e)}`);
  }
  const source = taskRecords(context).find(
    (r) => r.id === bundle.acceptanceSourceId,
  );
  try {
    if (
      !hasCurrentAcceptance(
        source,
        acceptanceQuestion(taskUrl, current, scope.sha256),
      )
    )
      blockers.push(
        "Final native owner acceptance is missing, negative or belongs to another candidate/scope",
      );
  } catch (e) {
    blockers.push(`Final native acceptance: ${String(e)}`);
  }
  return blockers;
}

export async function auditDelivery(
  cwd: string,
  input: unknown,
  threadId: string,
  signal: AbortSignal,
) {
  if (!threadId.trim())
    throw new Error("Actual author thread source is required");
  signal.throwIfAborted();
  const context = projectContext(cwd),
    taskUrl = activeTask(context),
    blockers: string[] = [];
  const synchronized = await syncTask(context, taskUrl);
  if (synchronized.status !== "online")
    blockers.push(
      "Current online authority unavailable; cache cannot certify delivery",
    );
  const current = candidate(cwd);
  let scope: ReturnType<typeof scopeInventory> | null = null;
  try {
    scope = scopeInventory(context);
  } catch (e) {
    blockers.push(String(e));
  }
  const parsed = deliveryBundleSchema.safeParse(input);
  const bundle = parsed.success ? parsed.data : null;
  if (!bundle)
    blockers.push(`Invalid evidence bundle: ${parsed.error?.message}`);
  if (pendingRecords(context).length)
    blockers.push("Pending facts require publication and exact readback");
  if (cachedTask(context).issue.state !== "open")
    blockers.push("Bound task is not open; reconcile authorized scope");
  const repair = repairState(context);
  if (
    repair.executionLease ||
    Object.values(repair.problems).some(
      (problem) => problem.consecutiveFailures > 0 || problem.unknownIds.length,
    ) ||
    repair.unverifiedRecordIds.length
  )
    blockers.push("Unresolved repair or execution evidence remains");
  if (bundle && scope)
    blockers.push(...verifyBundle(context, bundle, scope, threadId));
  const record = await recordFact(context, {
    schemaVersion: 1,
    id: randomUUID(),
    taskUrl,
    kind: "checkpoint",
    createdAt: new Date().toISOString(),
    revision: current.revision,
    source: { threadId },
    payload: {
      executor: "rill-delivery/v1",
      operation: "audit",
      candidate: current,
      scopeSha256: scope?.sha256 ?? null,
      ready: blockers.length === 0,
      blockers,
      bundle,
      semantics:
        "Artifact integrity and explicit prerequisites only; independent review must judge exhaustive coverage and causal correctness",
      completion:
        "not automatically established; actual PR/merge/publication are separate outcomes",
    },
  });
  return {
    id: record.id,
    ready: blockers.length === 0,
    blockers,
    pendingPublication: true,
    mayCreatePr: false,
  };
}
export function deliveryState(context: ProjectContext) {
  const records = taskRecords(context),
    latest = records
      .filter(
        (r) =>
          r.payload.executor === "rill-delivery/v1" &&
          r.payload.operation === "audit",
      )
      .at(-1);
  if (!latest)
    return { mayCreatePr: false, reason: "No delivery audit", receiptId: null };
  const audit = auditPayloadSchema.parse(latest.payload);
  const revoked = retractions(context).some((r) => r.receiptId === latest.id);
  let scopeMatches = false;
  try {
    scopeMatches = audit.scopeSha256 === scopeInventory(context).sha256;
  } catch {
    /* Missing scope remains unknown. */
  }
  const matches = isDeepStrictEqual(audit.candidate, candidate(context.root));
  const pending = pendingRecords(context).length;
  const liveBlockers = [...audit.blockers];
  try {
    if (audit.bundle && audit.ready && !revoked && matches && scopeMatches)
      liveBlockers.push(
        ...verifyBundle(
          context,
          audit.bundle,
          scopeInventory(context),
          latest.source.threadId,
        ),
      );
    else if (!audit.bundle) liveBlockers.push("Missing audit bundle");
  } catch (error) {
    liveBlockers.push(String(error));
  }
  const repair = repairState(context);
  if (
    repair.executionLease ||
    repair.unverifiedRecordIds.length ||
    Object.values(repair.problems).some(
      (problem) => problem.consecutiveFailures > 0 || problem.unknownIds.length,
    )
  )
    liveBlockers.push("Unresolved repair or execution evidence remains");
  return {
    mayCreatePr:
      audit.ready &&
      !revoked &&
      matches &&
      scopeMatches &&
      pending === 0 &&
      liveBlockers.length === 0,
    receiptId: latest.id,
    revoked,
    candidateMatches: matches,
    scopeMatches,
    pending,
    blockers: liveBlockers,
  };
}
export function isDeliveryTool(toolName: string | undefined) {
  return /(?:^|[._/])github[._/]+(create_pull_request|merge_pull_request)$/.test(
    toolName ?? "",
  );
}
export function deliveryTarget(
  context: ProjectContext,
  toolName: string | undefined,
  input: unknown,
) {
  if (!isDeliveryTool(toolName)) return false;
  if (
    !input ||
    typeof input !== "object" ||
    !("repository_full_name" in input) ||
    typeof input.repository_full_name !== "string"
  )
    throw new Error(
      "Cannot determine delivery tool repository; reconcile its target",
    );
  return input.repository_full_name.toLowerCase() === context.repository;
}
export function deliveryGuard(
  context: ProjectContext,
  toolName: string | undefined,
  input: unknown,
) {
  if (!deliveryTarget(context, toolName, input)) return null;
  const state = deliveryState(context);
  return state.mayCreatePr
    ? null
    : `Final candidate delivery prerequisites are not satisfied: ${JSON.stringify(state)}. This check does not grant merge or publication authorization.`;
}

export async function retractDelivery(
  cwd: string,
  receiptId: string,
  criterionIds: string[],
  reason: string,
  threadId: string,
) {
  if (!reason.trim() || !threadId.trim())
    throw new Error("Retraction requires actual source and reason");
  const context = projectContext(cwd);
  const target = taskRecords(context).find(
    (r) => r.id === receiptId && r.payload.executor === "rill-delivery/v1",
  );
  if (!target)
    throw new Error(
      "Unknown delivery receipt; original evidence must be retained",
    );
  const original = auditPayloadSchema.parse(target.payload);
  if (!original.ready || !original.bundle || !criterionIds.length)
    throw new Error(
      "Retraction requires a prior pass and affected acceptance IDs",
    );
  const invalidated = criterionIds.flatMap((id) => {
    const proof = original.bundle?.criteria.find((c) => c.id === id);
    if (!proof) throw new Error(`Unknown affected acceptance ${id}`);
    return proof.evidence.map((e) => ({ criterionId: id, sha256: e.sha256 }));
  });
  return recordFact(context, {
    schemaVersion: 1,
    id: randomUUID(),
    taskUrl: activeTask(context),
    kind: "correction",
    createdAt: new Date().toISOString(),
    revision: candidate(cwd).revision,
    source: { threadId },
    payload: {
      executor: "rill-delivery/v1",
      operation: "retract",
      receiptId,
      reason,
      invalidated,
      acceptanceState: "unverified; original pass retained but invalid",
      requiresAuthorizedReopen: cachedTask(context).issue.state === "closed",
      remoteIssueState:
        "not changed; use authorized native GitHub operation when reopening is required",
    },
  });
}
if (import.meta.main) {
  try {
    const [operation, path, ids, reason] = process.argv.slice(2),
      cwd = process.cwd(),
      threadId =
        process.env.CODEX_THREAD_ID ?? process.env.RILL_THREAD_ID ?? "";
    if (operation === "status")
      console.log(JSON.stringify(deliveryState(projectContext())));
    else if (operation === "question") {
      const c = projectContext();
      console.log(
        JSON.stringify({
          question: acceptanceQuestion(
            activeTask(c),
            candidate(cwd),
            scopeInventory(c).sha256,
          ),
          answers: finalAcceptanceAnswers,
        }),
      );
    } else if (operation === "audit" && path) {
      const result = await auditDelivery(
        cwd,
        JSON.parse(readFileSync(path, "utf8")),
        threadId,
        AbortSignal.timeout(30000),
      );
      console.log(JSON.stringify(result));
      if (!result.ready) process.exitCode = 1;
    } else if (operation === "retract" && path && ids && reason)
      console.log(
        JSON.stringify(
          await retractDelivery(cwd, path, ids.split(","), reason, threadId),
        ),
      );
    else
      throw new Error(
        "Usage: delivery-evidence.ts status | question | audit <bundle.json> | retract <receipt-id> <criterion-ids> <reason>",
      );
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
