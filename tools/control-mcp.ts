import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import manifest from "../.codex-plugin/plugin.json" with { type: "json" };
import { candidate, verifyFullSpecEvidence } from "./ci-evidence.ts";
import { taskStatus } from "./control-event.ts";
import { controlEventSchema } from "./control-input.ts";
import {
  decisionSourceSchema,
  recordDecisionSource,
} from "./decision-evidence.ts";
import {
  acceptanceQuestion,
  auditDelivery,
  deliveryBundleSchema,
  deliveryState,
  finalAcceptanceAnswers,
  retractDelivery,
  scopeInventory,
} from "./delivery-evidence.ts";
import { recoverTask } from "./recover-task.ts";
import { lifecycleEvent } from "./recovery-lifecycle.ts";
import {
  interpretDiagnosis,
  repairState,
  runRepair,
} from "./repair-evidence.ts";
import {
  activeTask,
  projectContext,
  publishRecords,
  recordUserFact,
  syncTask,
} from "./task-context.ts";

const server = new McpServer({
  name: "rill-preferences",
  version: manifest.version,
});
const output = (value: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  structuredContent: value,
});

server.registerTool(
  "evaluate_event",
  {
    description:
      "Check Rill personal task preconditions for a native lifecycle event and return the native hook response. Coverage is reported by task_status; this tool does not define engineering methodology.",
    inputSchema: controlEventSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async (event, context) =>
    output(await lifecycleEvent(event, context.mcpReq.signal)),
);

server.registerTool(
  "task_status",
  {
    description:
      "Read the enrolled task, pending facts, actual Git state and implemented control coverage.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ cwd }) => output(taskStatus(cwd)),
);

server.registerTool(
  "recover_task",
  {
    description:
      "Recover the bound task and exhaust supported native history pages. Reports uncovered user requests and failures; reading history does not prove semantic reconciliation.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      thread_id: z.string().min(1),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, thread_id }, context) =>
    output(await recoverTask(cwd, thread_id, context.mcpReq.signal)),
);

server.registerTool(
  "task_sync",
  {
    description:
      "Synchronize an enrolled GitHub task into its local recovery cache, retaining offline pending facts.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      issue_url: z.string().url(),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, issue_url }) => {
    const result = await syncTask(projectContext(cwd), issue_url);
    return output({
      status: result.status,
      taskUrl: result.snapshot.taskUrl,
      syncedAt: result.snapshot.syncedAt,
    });
  },
);

server.registerTool(
  "record_fact",
  {
    description:
      "Validate and durably retain a task fact in its local outbox; this does not approve requirements or prove a repair.",
    inputSchema: z.object({ cwd: z.string().min(1), record: z.unknown() }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, record }) =>
    output({ record: await recordUserFact(projectContext(cwd), record) }),
);

server.registerTool(
  "record_decision_source",
  {
    description:
      "Read a referenced native user message and retain its exact text/hash as decision source evidence. Does not infer approval, prove semantic coverage or approve the current candidate.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      source: decisionSourceSchema,
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, source }, context) =>
    output({
      record: await recordDecisionSource(cwd, source, context.mcpReq.signal),
    }),
);

server.registerTool(
  "publish_records",
  {
    description:
      "Publish pending facts to the bound GitHub task and verify readback. Use only within the task's external-write authorization.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd }) => output(await publishRecords(projectContext(cwd))),
);

server.registerTool(
  "verify_full_spec_evidence",
  {
    description:
      "Verify that saved evidence ran the project's actual full-spec entry and matches the current candidate/environment. Does not rerun checks or establish uncovered acceptance or human approval.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      receipt: z.string().min(1),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ cwd, receipt }) => output(verifyFullSpecEvidence(cwd, receipt)),
);

server.registerTool(
  "delivery_status",
  {
    description:
      "Read current candidate delivery evidence, stale/retracted conclusions and publication prerequisites; does not grant external-write authorization.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ cwd }) => output(deliveryState(projectContext(cwd))),
);
server.registerTool(
  "delivery_acceptance_question",
  {
    description:
      "Build a candidate/scope-bound final question for the host's existing native input control; this tool neither asks it nor fabricates an owner decision.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ cwd }) => {
    const c = projectContext(cwd);
    return output({
      answers: finalAcceptanceAnswers,
      question: acceptanceQuestion(
        activeTask(c),
        candidate(cwd),
        scopeInventory(c).sha256,
      ),
    });
  },
);
server.registerTool(
  "delivery_audit",
  {
    description:
      "Synchronize authority and audit the complete declared acceptance map, actual full-spec receipt, native observations, independent review and exact native owner choice. Saves failures; passing still needs publish/readback. Does not infer semantic correctness or create a PR.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      thread_id: z.string().min(1),
      bundle: deliveryBundleSchema,
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  async ({ cwd, thread_id, bundle }, context) => {
    const result = await auditDelivery(
      cwd,
      bundle,
      thread_id,
      context.mcpReq.signal,
    );
    return { ...output(result), isError: !result.ready };
  },
);
server.registerTool(
  "delivery_retract",
  {
    description:
      "Retract a known prior pass, retain original history and invalidate affected evidence. Does not change GitHub issue state; use the authorized native GitHub operation if reopening is required.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      thread_id: z.string().min(1),
      receipt_id: z.string().uuid(),
      criterion_ids: z.array(z.string().min(1)).min(1),
      reason: z.string().min(1),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  async ({ cwd, thread_id, receipt_id, criterion_ids, reason }) =>
    output({
      record: await retractDelivery(
        cwd,
        receipt_id,
        criterion_ids,
        reason,
        thread_id,
      ),
    }),
);

server.registerTool(
  "repair_status",
  {
    description:
      "Read actual repair failures, diagnosis requirements and unresolved evidence. Counts come from recorded command outcomes, not ordinary tool errors.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ cwd }) => output(repairState(projectContext(cwd))),
);

for (const operation of ["check", "diagnose"] as const) {
  server.registerTool(
    `repair_${operation}`,
    {
      description:
        operation === "check"
          ? "Run an existing targeted check as explicit repair evidence. Saves actual exit/output hashes; requires diagnosis after two failures. Does not prove semantic repair."
          : "Run a discriminating diagnostic command and retain its actual evidence. Successful execution alone does not satisfy diagnosis; interpret the evidence separately.",
      inputSchema: z.object({
        cwd: z.string().min(1),
        thread_id: z.string().min(1),
        problem_key: z.string().min(1),
        hypothesis: z.string().min(1),
        command: z.array(z.string()).min(1),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ cwd, thread_id, problem_key, hypothesis, command }, context) => {
      const result = await runRepair(
        projectContext(cwd),
        operation,
        problem_key,
        hypothesis,
        command,
        context.mcpReq.signal,
        thread_id,
      );
      return { ...output(result), isError: result.exitCode !== 0 };
    },
  );
}
server.registerTool(
  "repair_interpret",
  {
    description:
      "Link fresh diagnostic evidence to the latest failures and explain its causal distinction before the next repair. Mechanical reference validity does not establish causal sufficiency.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      thread_id: z.string().min(1),
      problem_key: z.string().min(1),
      evidence_id: z.string().uuid(),
      explanation: z.string().min(1),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  async ({ cwd, thread_id, problem_key, evidence_id, explanation }) =>
    output(
      await interpretDiagnosis(
        projectContext(cwd),
        problem_key,
        evidence_id,
        explanation,
        thread_id,
      ),
    ),
);

await serveStdio(() => server);
