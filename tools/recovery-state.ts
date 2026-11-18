import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod/v4";
import { activeTask, atomicJson, type ProjectContext } from "./task-context.ts";

const reportSchema = z.object({
  schemaVersion: z.literal(1),
  threadId: z.string(),
  repository: z.string(),
  taskUrl: z.string().nullable(),
  mechanicalGaps: z.array(z.string()),
  semanticCompleteness: z.literal("requires-reconciliation"),
});
export function recoveryReportPath(context: ProjectContext, threadId: string) {
  return join(
    context.recoveryRoot,
    "recovery",
    `${createHash("sha256").update(threadId).digest("hex")}.json`,
  );
}
export function saveRecoveryReport(
  context: ProjectContext,
  threadId: string,
  data: Record<string, unknown>,
) {
  const path = recoveryReportPath(context, threadId);
  atomicJson(path, {
    ...data,
    schemaVersion: 1,
    threadId,
    repository: context.repository,
    semanticCompleteness: "requires-reconciliation",
  });
  return path;
}
export function saveRecoveryGap(
  context: ProjectContext,
  threadId: string,
  reason: string,
) {
  let taskUrl: string | null = null;
  try {
    taskUrl = activeTask(context);
  } catch {
    /* The binding itself may be the missing input. */
  }
  return saveRecoveryReport(context, threadId, {
    taskUrl,
    state: null,
    history: [],
    recoveredAt: new Date().toISOString(),
    mechanicalGaps: [reason],
  });
}
export function recoveryGuard(context: ProjectContext, threadId: string) {
  const path = recoveryReportPath(context, threadId);
  if (!existsSync(path)) return null;
  try {
    const report = reportSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    if (
      report.repository !== context.repository ||
      report.threadId !== threadId ||
      report.taskUrl !== activeTask(context)
    )
      return "Recovery report belongs to another task or thread; use recover_task for the current binding";
    return report.mechanicalGaps.length
      ? `Recover current task/source data before dependent edits: ${report.mechanicalGaps.join("; ")}. Diagnostics and task_sync/recover_task remain available.`
      : null;
  } catch (error) {
    return `Recovery report unavailable: ${String(error)}. Rebuild it from task/source data before dependent edits.`;
  }
}
