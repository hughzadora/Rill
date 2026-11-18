import { createHash, randomUUID } from "node:crypto";
import * as z from "zod/v4";
import { workingTree } from "./ci-evidence.ts";
import { readNativeHistory } from "./native-history.ts";
import {
  activeTask,
  projectContext,
  recordFact,
  taskRecords,
} from "./task-context.ts";

export const decisionSourceSchema = z.object({
  stage: z.enum([
    "design",
    "plan",
    "pilot",
    "prototype",
    "acceptance",
    "correction",
  ]),
  threadId: z.string().min(1),
  itemId: z.string().min(1),
  subject: z.string().trim().min(1),
  quote: z.string().trim().min(1),
});
export async function recordDecisionSource(
  cwd: string,
  input: z.input<typeof decisionSourceSchema>,
  signal: AbortSignal,
) {
  const selected = decisionSourceSchema.parse(input);
  const context = projectContext(cwd);
  const taskUrl = activeTask(context);
  const history = await readNativeHistory(selected.threadId, cwd, signal);
  const matches = history.items.filter(
    ({ item }) => item.id === selected.itemId,
  );
  if (matches.length !== 1 || matches[0]?.item.type !== "userMessage")
    throw new Error(
      "Decision source must identify exactly one native user message",
    );
  const source = matches[0];
  const content = source.item.content;
  if (!Array.isArray(content))
    throw new Error(
      "Native decision source has no text content; inspect its original source",
    );
  const sourceText = content
    .filter(
      (part) =>
        part &&
        typeof part === "object" &&
        part.type === "text" &&
        typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
  if (!sourceText.includes(selected.quote))
    throw new Error("Decision quote does not match the actual native source");
  const sourceSha256 = createHash("sha256").update(sourceText).digest("hex");
  const previous = taskRecords(context).find(
    (record) =>
      record.payload.executor === "rill-decision-source/v1" &&
      record.source.threadId === selected.threadId &&
      record.source.itemId === selected.itemId &&
      record.payload.stage === selected.stage &&
      record.payload.subject === selected.subject &&
      record.payload.quote === selected.quote &&
      record.payload.sourceSha256 === sourceSha256,
  );
  if (previous) return previous;
  const observedCandidate = workingTree(cwd);
  return recordFact(context, {
    schemaVersion: 1,
    id: randomUUID(),
    taskUrl,
    kind: selected.stage === "correction" ? "correction" : "checkpoint",
    createdAt: new Date().toISOString(),
    revision: observedCandidate.revision,
    source: { threadId: selected.threadId, itemId: selected.itemId },
    payload: {
      executor: "rill-decision-source/v1",
      stage: selected.stage,
      subject: selected.subject,
      quote: selected.quote,
      sourceText,
      sourceSha256,
      sourceTurnId: source.turnId,
      sourceVerified: true,
      nativeHistoryPages: history.pageCount,
      semanticDecision: "requires-interpretation",
      candidateBinding:
        "observed-at-collection; not approval of this candidate",
      observedCandidate,
    },
  });
}
if (import.meta.main) {
  try {
    const [stage, threadId, itemId, subject, quote] = process.argv.slice(2);
    const input = decisionSourceSchema.parse({
      stage,
      threadId,
      itemId,
      subject,
      quote,
    });
    console.log(
      JSON.stringify(
        await recordDecisionSource(
          process.cwd(),
          input,
          AbortSignal.timeout(30_000),
        ),
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
