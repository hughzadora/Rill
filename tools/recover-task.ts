import { createHash } from "node:crypto";
import { join } from "node:path";
import { workingTree } from "./ci-evidence.ts";
import { taskStatus } from "./control-event.ts";
import { readNativeHistory } from "./native-history.ts";
import { saveRecoveryReport } from "./recovery-state.ts";
import { atomicJson, projectContext } from "./task-context.ts";

function contentReferences(content: unknown, itemId: string) {
  if (!Array.isArray(content))
    return { sourceItemId: itemId, requiresSourceRead: true };
  return content.map((part: unknown) => {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    )
      return part;
    return {
      type:
        part && typeof part === "object" && "type" in part
          ? part.type
          : "unknown",
      sourceItemId: itemId,
      requiresSourceRead: true,
    };
  });
}

export async function recoverTask(
  cwd: string,
  threadId: string,
  signal: AbortSignal,
) {
  const state = taskStatus(cwd);
  if (!state.enrolled) return { state, history: [] };
  const context = projectContext(cwd);
  const sourceThreads = new Set([
    threadId,
    ...state.records.map((record) => record.source.threadId),
  ]);
  const history = [];
  for (const sourceThread of sourceThreads) {
    try {
      const result = await readNativeHistory(sourceThread, cwd, signal);
      const anchor = state.records
        .filter(
          (record) =>
            record.source.threadId === sourceThread && record.source.itemId,
        )
        .at(-1)?.source.itemId;
      const anchorIndex = anchor
        ? result.items.findIndex((entry) => entry.item.id === anchor)
        : -1;
      // A fact source is a reference, not proof that earlier decisions were synchronized.
      const uncovered = result.items;
      const relevant = uncovered.filter(
        ({ item }) =>
          item.type === "userMessage" ||
          (item.type === "commandExecution" &&
            (item.status === "failed" ||
              (typeof item.exitCode === "number" && item.exitCode !== 0))) ||
          item.status === "failed",
      );
      const projection = relevant.map(({ turnId, item }) =>
        item.type === "userMessage"
          ? {
              turnId,
              id: item.id,
              type: item.type,
              content: contentReferences(item.content, item.id),
            }
          : {
              turnId,
              id: item.id,
              type: item.type,
              status: item.status,
              exitCode: item.exitCode,
            },
      );
      const entry = {
        threadId: sourceThread,
        readStatus: "exhausted",
        pageCount: result.pageCount,
        lastItemId: result.items.at(-1)?.item.id ?? null,
        anchor: anchor ?? null,
        anchorFound: anchorIndex >= 0,
        anchorTrustedForCoverage: false,
        uncovered: projection,
        reconciliation: "required",
      };
      atomicJson(
        join(
          context.recoveryRoot,
          "native-history",
          `${createHash("sha256").update(sourceThread).digest("hex")}.json`,
        ),
        entry,
      );
      history.push(entry);
    } catch (error) {
      history.push({
        threadId: sourceThread,
        readStatus: "unknown",
        error: error instanceof Error ? error.message : String(error),
        reconciliation: "required",
      });
    }
  }
  const mechanicalGaps = history
    .filter((entry) => entry.readStatus !== "exhausted")
    .map((entry) => `Native history unavailable for ${entry.threadId}`);
  let tree: unknown = null;
  try {
    tree = workingTree(cwd);
  } catch (error) {
    mechanicalGaps.push(
      `Current Git fingerprint unavailable: ${String(error)}`,
    );
  }
  const report = {
    taskUrl: state.taskUrl,
    state,
    history,
    workingTree: tree,
    mechanicalGaps,
    recoveredAt: new Date().toISOString(),
    semanticCompleteness: "requires-reconciliation" as const,
  };
  const reportPath = saveRecoveryReport(context, threadId, report);
  return {
    reportPath,
    state: { enrolled: state.enrolled, taskUrl: state.taskUrl },
    history: history.map((entry) => ({
      threadId: entry.threadId,
      readStatus: entry.readStatus,
      pageCount: "pageCount" in entry ? entry.pageCount : null,
    })),
    workingTree: tree,
    mechanicalGaps,
    semanticCompleteness: report.semanticCompleteness,
  };
}

if (import.meta.main) {
  try {
    const threadId = process.argv[2] ?? process.env.CODEX_THREAD_ID;
    if (!threadId) throw new Error("Usage: recover-task.ts <native-thread-id>");
    const result = await recoverTask(
      process.cwd(),
      threadId,
      AbortSignal.timeout(30_000),
    );
    const context = projectContext();
    const path = join(context.recoveryRoot, "last-recovery.json");
    atomicJson(path, result);
    console.log(
      JSON.stringify({
        cache: path,
        history: result.history.map((entry) => ({
          threadId: entry.threadId,
          readStatus: entry.readStatus,
        })),
        semanticCompleteness:
          "semanticCompleteness" in result
            ? result.semanticCompleteness
            : "unenrolled",
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
