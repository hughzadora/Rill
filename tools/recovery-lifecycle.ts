import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod/v4";
import {
  blocked,
  enrolled,
  evaluateEvent,
  taskStatus,
} from "./control-event.ts";
import type { ControlEvent } from "./control-input.ts";
import { deliveryTarget, isDeliveryTool } from "./delivery-evidence.ts";
import { recoverTask } from "./recover-task.ts";
import { saveRecoveryGap, saveRecoveryReport } from "./recovery-state.ts";
import {
  activeTask,
  atomicJson,
  projectContext,
  syncTask,
} from "./task-context.ts";

const checkpointSchema = z.object({
  schemaVersion: z.literal(1),
  threadId: z.string(),
  taskUrl: z.string(),
  repository: z.string(),
  capturedAt: z.string().datetime(),
  event: z.literal("PreCompact"),
  preferences: z.string(),
  task: z.unknown(),
  history: z.unknown(),
  workingTree: z.unknown().optional(),
  semanticCompleteness: z.literal("requires-reconciliation"),
});
function checkpointPath(cwd: string, threadId: string) {
  return join(
    projectContext(cwd).recoveryRoot,
    "precompact",
    `${createHash("sha256").update(threadId).digest("hex")}.json`,
  );
}
const savedTaskSchema = z.object({
  taskBody: z.string().nullable(),
  records: z.array(z.object({ id: z.string() })),
  pendingIds: z.array(z.string()),
});
const treeSchema = z.object({ contentSha256: z.string() });

// Codex owns sessions and compaction. Reports are derived recovery data, not approval or semantic coverage proof.
export async function lifecycleEvent(event: ControlEvent, signal: AbortSignal) {
  if (
    event.hook_event_name === "PreToolUse" &&
    isDeliveryTool(event.tool_name)
  ) {
    try {
      if (!enrolled(event.cwd)) return {};
      const context = projectContext(event.cwd);
      if (!deliveryTarget(context, event.tool_name, event.tool_input))
        return {};
      const synchronized = await syncTask(context, activeTask(context));
      if (synchronized.status !== "online")
        return blocked(
          event,
          "Final delivery requires current online authority; an offline cache cannot authorize this operation",
        );
    } catch (error) {
      return blocked(
        event,
        `Final delivery precondition unavailable: ${String(error)}`,
      );
    }
    return evaluateEvent(event);
  }
  if (!["PreCompact", "SessionStart"].includes(event.hook_event_name))
    return evaluateEvent(event);
  try {
    if (!enrolled(event.cwd)) return {};
    const context = projectContext(event.cwd);
    let remoteStatus = "last-synchronized-snapshot";
    if (event.hook_event_name === "SessionStart")
      remoteStatus = (await syncTask(context, activeTask(context))).status;
    const state = taskStatus(event.cwd);
    if (!state.enrolled) return {};
    const path = checkpointPath(event.cwd, event.session_id);
    if (event.hook_event_name === "PreCompact") {
      const preferences = readFileSync(
        new URL(
          "../skills/rill-preferences/references/personal-policy.md",
          import.meta.url,
        ),
        "utf8",
      );
      const checkpoint = {
        schemaVersion: 1 as const,
        threadId: event.session_id,
        taskUrl: state.taskUrl,
        repository: state.repository,
        capturedAt: new Date().toISOString(),
        event: "PreCompact" as const,
        preferences,
        task: state,
        history: { readStatus: "pending" } as unknown,
        workingTree: { readStatus: "pending" } as unknown,
        semanticCompleteness: "requires-reconciliation" as const,
      };
      // Retain task/outbox before native history or content hashing can fail or exceed the hook budget.
      atomicJson(path, checkpoint);
      const recovery = await recoverTask(event.cwd, event.session_id, signal);
      checkpoint.history = recovery;
      checkpoint.workingTree =
        "workingTree" in recovery
          ? recovery.workingTree
          : { readStatus: "unknown" };
      atomicJson(path, checkpoint);
      return {
        systemMessage: `Rill saved pre-compaction task data at ${path}. Native history and task corrections still require reconciliation; saving a checkpoint does not establish complete coverage.`,
      };
    }
    const recovery = await recoverTask(event.cwd, event.session_id, signal);
    if (
      !("reportPath" in recovery) ||
      typeof recovery.reportPath !== "string" ||
      !recovery.state.enrolled ||
      !Array.isArray(recovery.mechanicalGaps)
    )
      return {};
    const report = JSON.parse(
      readFileSync(recovery.reportPath, "utf8"),
    ) as Record<string, unknown>;
    const reportGaps = report.mechanicalGaps;
    if (
      !Array.isArray(reportGaps) ||
      !reportGaps.every((gap: unknown) => typeof gap === "string")
    )
      throw new Error("Recovery report has invalid mechanical gaps");
    let checkpoint: Record<string, unknown> = { status: "absent", path };
    if (existsSync(path)) {
      try {
        const saved = checkpointSchema.parse(
          JSON.parse(readFileSync(path, "utf8")),
        );
        if (
          saved.threadId !== event.session_id ||
          saved.taskUrl !== state.taskUrl ||
          saved.repository !== state.repository
        )
          throw new Error(
            "Pre-compaction checkpoint belongs to another task or thread",
          );
        const before = savedTaskSchema.safeParse(saved.task),
          tree = treeSchema.safeParse(saved.workingTree),
          current = treeSchema.safeParse(recovery.workingTree);
        checkpoint = {
          status: "accepted-as-historical-data",
          path,
          capturedAt: saved.capturedAt,
          comparison: {
            contentChanged:
              tree.success && current.success
                ? tree.data.contentSha256 !== current.data.contentSha256
                : null,
            authorityChanged: before.success
              ? before.data.taskBody !== state.taskBody ||
                !isDeepStrictEqual(
                  before.data.records.map((r) => r.id),
                  state.records.map((r) => r.id),
                )
              : null,
            pendingFactsChanged: before.success
              ? !isDeepStrictEqual(before.data.pendingIds, state.pendingIds)
              : null,
          },
        };
      } catch (error) {
        checkpoint = { status: "rejected", path, reason: String(error) };
      }
    }
    const comparison = checkpoint.comparison;
    const checkpointChanged =
      checkpoint.status === "rejected" ||
      (comparison !== null &&
        typeof comparison === "object" &&
        Object.values(comparison).some((value) => value === true));
    const mechanicalGaps = [...reportGaps];
    if (checkpoint.status === "rejected")
      mechanicalGaps.push(
        "Pre-compaction checkpoint rejected; reconcile its task/thread identity before dependent edits",
      );
    else if (checkpointChanged)
      mechanicalGaps.push(
        "Previous checkpoint differs from current task/code state; reconcile before dependent edits",
      );
    const reportPath = saveRecoveryReport(context, event.session_id, {
      ...report,
      checkpoint,
      remoteStatus,
      mechanicalGaps,
    });
    const response = evaluateEvent(event),
      output = response.hookSpecificOutput;
    if (
      !output ||
      typeof output !== "object" ||
      !("additionalContext" in output)
    )
      return response;
    const preferences = readFileSync(
      new URL(
        "../skills/rill-preferences/references/personal-policy.md",
        import.meta.url,
      ),
      "utf8",
    );
    const checkpointStatus = String(checkpoint.status);
    return {
      ...response,
      hookSpecificOutput: {
        ...output,
        additionalContext: `${preferences}\n\nRill recovery report at ${reportPath}. Authority: ${remoteStatus}. Previous checkpoint: ${checkpointStatus} at ${path}. Mechanical gaps: ${mechanicalGaps.length}. Read the report and reconcile before dependent edits; semantic completeness remains requires-reconciliation.`,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const reason = `Rill recovery gap: ${detail.slice(0, 300)}. Diagnose with local tools, synchronize the known task, then use recover_task before dependent edits. An absent checkpoint is not evidence of complete restoration.`;
    let path: string | null = null;
    try {
      if (enrolled(event.cwd))
        path = saveRecoveryGap(
          projectContext(event.cwd),
          event.session_id,
          reason,
        );
    } catch {
      /* Preserve original cache/outbox; failure is visible even when the report cannot be written. */
    }
    // Keep the model available for diagnosis/recovery. The supported edit hook consumes the durable gap.
    return {
      systemMessage: reason,
      ...(event.hook_event_name === "SessionStart"
        ? {
            hookSpecificOutput: {
              hookEventName: "SessionStart",
              additionalContext: `${reason}${path ? ` Recovery data at ${path}.` : ""} Supported edits remain subject to task/recovery guards; diagnostics and recovery tools remain available.`,
            },
          }
        : {}),
    };
  }
}
