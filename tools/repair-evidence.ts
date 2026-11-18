import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod/v4";
import { environment, workingTree } from "./ci-evidence.ts";
import {
  activeTask,
  atomicJson,
  cachedTask,
  type ProjectContext,
  projectContext,
  recordFact,
  type TaskRecord,
  taskRecords,
} from "./task-context.ts";

const executor = "rill-repair/v1";
const key = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/);
const tree = z
  .object({
    root: z.string(),
    revision: z.string().nullable(),
    contentSha256: z.string(),
    status: z.string(),
  })
  .passthrough();
const common = z.object({
  executor: z.literal(executor),
  problemKey: key,
  ordinal: z.number().int().positive(),
});
const execution = common.extend({
  operation: z.enum(["check", "diagnose"]),
  hypothesis: z.string(),
  command: z.string(),
  argv: z.array(z.string()).min(1),
  argvSha256: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  error: z.string().nullable(),
  before: tree,
  after: tree,
  candidateUnchanged: z.boolean(),
  environment: z.unknown(),
  stdoutSha256: z.string(),
  stderrSha256: z.string(),
  stdoutPath: z.string(),
  stderrPath: z.string(),
  receiptPath: z.string(),
});
const interpretation = common.extend({
  operation: z.literal("interpret"),
  evidenceId: z.string().uuid(),
  failureIds: z.array(z.string().uuid()),
  explanation: z.string().min(1),
  candidate: tree,
});
const payloadSchema = z.discriminatedUnion("operation", [
  execution,
  interpretation,
]);
type Payload = z.infer<typeof payloadSchema>;
type Entry = { record: TaskRecord; payload: Payload };

function entries(context: ProjectContext) {
  const records = taskRecords(context);
  const result: Entry[] = [];
  const unverified = records
    .filter(
      (record) =>
        record.kind === "attempt" && record.payload.executor !== executor,
    )
    .map((record) => record.id);
  const ordinals = new Set<number>();
  for (const record of records) {
    if (record.payload.executor !== executor) continue;
    const payload = payloadSchema.parse(record.payload);
    if (
      record.kind !== (payload.operation === "check" ? "attempt" : "diagnosis")
    )
      throw new Error("Repair evidence kind mismatch");
    if (ordinals.has(payload.ordinal))
      throw new Error(
        "Conflicting repair evidence order; synchronize and reconcile task history",
      );
    ordinals.add(payload.ordinal);
    result.push({ record, payload });
  }
  return {
    records: result.sort((a, b) => a.payload.ordinal - b.payload.ordinal),
    unverified,
  };
}

export function repairState(context: ProjectContext) {
  const all = entries(context);
  const problems = new Map<
    string,
    {
      failedAttempts: number;
      consecutiveFailures: number;
      failureIds: string[];
      unknownIds: string[];
      lastCheckId: string | null;
      authorizedDiagnosisId: string | null;
      requiredDiagnosis: boolean;
    }
  >();
  for (const entry of all.records) {
    const p = entry.payload;
    let state = problems.get(p.problemKey);
    if (!state) {
      state = {
        failedAttempts: 0,
        consecutiveFailures: 0,
        failureIds: [],
        unknownIds: [],
        lastCheckId: null,
        authorizedDiagnosisId: null,
        requiredDiagnosis: false,
      };
      problems.set(p.problemKey, state);
    }
    if (p.operation === "check") {
      state.lastCheckId = entry.record.id;
      state.authorizedDiagnosisId = null;
      if (p.exitCode === 0 && p.candidateUnchanged) {
        state.failureIds = [];
        state.unknownIds = [];
        state.consecutiveFailures = 0;
      } else {
        state.failureIds.push(entry.record.id);
        if (p.exitCode !== null && p.exitCode !== 0) {
          state.failedAttempts++;
          state.consecutiveFailures++;
        }
        if (p.exitCode === null || !p.candidateUnchanged)
          state.unknownIds.push(entry.record.id);
      }
    } else if (
      p.operation === "interpret" &&
      isDeepStrictEqual(p.failureIds, state.failureIds)
    ) {
      const evidence = all.records.find((e) => e.record.id === p.evidenceId);
      const latestFailure = all.records.find(
        (e) => e.record.id === state.failureIds.at(-1),
      );
      if (
        evidence?.payload.operation !== "diagnose" ||
        evidence.payload.problemKey !== p.problemKey ||
        !latestFailure ||
        evidence.payload.ordinal <= latestFailure.payload.ordinal ||
        evidence.payload.ordinal >= p.ordinal ||
        evidence.payload.exitCode === null ||
        !evidence.payload.candidateUnchanged ||
        !isDeepStrictEqual(evidence.payload.after, p.candidate)
      )
        throw new Error("Invalid diagnosis interpretation references");
      state.authorizedDiagnosisId = entry.record.id;
    }
    state.requiredDiagnosis =
      (state.consecutiveFailures >= 2 || state.unknownIds.length > 0) &&
      !state.authorizedDiagnosisId;
  }
  const leasePath = join(context.recoveryRoot, "repair.lock");
  let executionLease: {
    path: string;
    completion: string;
    owner?: unknown;
    error?: string;
  } | null = null;
  if (existsSync(leasePath)) {
    executionLease = {
      path: leasePath,
      completion: "not-established; inspect native process and receipts",
    };
    try {
      executionLease.owner = JSON.parse(
        readFileSync(join(leasePath, "owner.json"), "utf8"),
      );
    } catch (error) {
      executionLease.error =
        error instanceof Error ? error.message : String(error);
    }
  }
  return {
    executionLease,
    problems: Object.fromEntries(problems),
    blockedProblems: [...problems]
      .filter(([, p]) => p.requiredDiagnosis)
      .map(([k]) => k),
    unverifiedRecordIds: all.unverified,
    nextOrdinal: (all.records.at(-1)?.payload.ordinal ?? 0) + 1,
  };
}

export function repairGuard(
  context: ProjectContext,
  toolName: string | undefined,
) {
  if (!toolName || !/^(?:apply_patch|Edit|Write)$/.test(toolName)) return null;
  if (existsSync(join(context.recoveryRoot, "repair.lock")))
    return "Repair check is active or incomplete; inspect its evidence before editing";
  const state = repairState(context);
  if (state.blockedProblems.length || state.unverifiedRecordIds.length)
    return `Fresh diagnosis required before editing: ${state.blockedProblems.join(", ") || "unverified earlier attempts"}`;
  return null;
}

function assertRepairAllowed(context: ProjectContext) {
  const state = repairState(context);
  if (state.blockedProblems.length || state.unverifiedRecordIds.length)
    throw new Error(
      `Fresh diagnosis required before another repair: ${state.blockedProblems.join(", ") || "unverified earlier attempts"}`,
    );
  return state;
}

async function lease<T>(
  context: ProjectContext,
  operation: (
    markStarted: (evidence: {
      runningPath: string;
      receiptPath: string;
    }) => void,
  ) => Promise<T>,
) {
  mkdirSync(context.recoveryRoot, { recursive: true, mode: 0o700 });
  const path = join(context.recoveryRoot, "repair.lock");
  if (existsSync(path))
    throw new Error(
      "Repair evidence operation is active or incomplete; inspect repair.lock and its receipt before continuing",
    );
  mkdirSync(path, { mode: 0o700 });
  let started = false;
  let complete = false;
  try {
    atomicJson(join(path, "owner.json"), {
      pid: process.pid,
      createdAt: new Date().toISOString(),
    });
    const result = await operation((evidence) => {
      started = true;
      atomicJson(join(path, "owner.json"), {
        pid: process.pid,
        started: true,
        ...evidence,
      });
    });
    complete = true;
    return result;
  } finally {
    if (complete || !started) rmSync(path, { recursive: true });
  }
}

function source(threadId?: string) {
  const value =
    threadId ?? process.env.RILL_THREAD_ID ?? process.env.CODEX_THREAD_ID;
  if (!value)
    throw new Error(
      "Provide a native thread id through RILL_THREAD_ID/CODEX_THREAD_ID or the structured tool",
    );
  return { threadId: value };
}
function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export async function runRepair(
  context: ProjectContext,
  operation: "check" | "diagnose",
  problemKey: string,
  hypothesis: string,
  command: string[],
  signal?: AbortSignal,
  threadId?: string,
) {
  key.parse(problemKey);
  if (operation === "check" && !hypothesis.trim())
    throw new Error("Record the repair hypothesis before checking it");
  if (!command[0]) throw new Error("A check/diagnosis command is required");
  const origin = source(threadId);
  return lease(context, async (markStarted) => {
    const snapshot = cachedTask(context);
    if (snapshot.issue.state !== "open")
      throw new Error("The bound task is closed");
    const state =
      operation === "check"
        ? assertRepairAllowed(context)
        : repairState(context);
    const all = entries(context).records;
    const before = workingTree(context.root);
    const argvSha256 = sha(JSON.stringify(command));
    const previous = all
      .filter(
        (e) =>
          e.payload.operation === operation &&
          e.payload.problemKey === problemKey,
      )
      .at(-1);
    if (
      previous &&
      previous.payload.operation !== "interpret" &&
      previous.payload.argvSha256 === argvSha256 &&
      isDeepStrictEqual(previous.payload.after, before)
    ) {
      const problem = state.problems[problemKey];
      if (
        operation === "check" &&
        previous.payload.exitCode !== 0 &&
        !problem?.authorizedDiagnosisId
      )
        throw new Error(
          "The same failed check on an unchanged candidate supplies no new repair evidence; diagnose before repeating",
        );
      if (operation === "diagnose" || previous.payload.exitCode === 0)
        return {
          id: previous.record.id,
          exitCode: previous.payload.exitCode,
          reused: true,
          receiptPath: previous.payload.receiptPath,
        };
    }
    const taskUrl = activeTask(context),
      id = randomUUID();
    const directory = join(context.recoveryRoot, "repair-evidence", id);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stdoutPath = join(directory, "stdout.log"),
      stderrPath = join(directory, "stderr.log"),
      receiptPath = join(directory, "receipt.json");
    const env = environment();
    const startedAt = new Date().toISOString();
    const runningPath = join(directory, "running.json");
    const running = {
      id,
      taskUrl,
      operation,
      problemKey,
      hypothesis,
      command,
      before,
      startedAt,
      environment: env,
      controllerPid: process.pid,
      source: origin,
    };
    atomicJson(runningPath, running);
    const stdout = openSync(stdoutPath, "wx", 0o600),
      stderr = openSync(stderrPath, "wx", 0o600);
    markStarted({ runningPath, receiptPath });
    let outcome: {
      exitCode: number | null;
      signal: string | null;
      error: string | null;
    };
    try {
      outcome = await new Promise((resolve) => {
        let error: string | null = null;
        const child = spawn(command[0] as string, command.slice(1), {
          cwd: context.root,
          stdio: ["ignore", stdout, stderr],
          ...(signal ? { signal } : {}),
        });
        atomicJson(runningPath, { ...running, childPid: child.pid ?? null });
        child.once("error", (e) => {
          error = e.message;
        });
        child.once("close", (exitCode, signal) =>
          resolve({ exitCode, signal, error }),
        );
      });
    } finally {
      fsyncSync(stdout);
      fsyncSync(stderr);
      closeSync(stdout);
      closeSync(stderr);
    }
    const after = workingTree(context.root);
    const payload = execution.parse({
      executor,
      operation,
      problemKey,
      hypothesis,
      ordinal: state.nextOrdinal,
      command: command[0],
      argv: command,
      argvSha256,
      startedAt,
      finishedAt: new Date().toISOString(),
      ...outcome,
      before,
      after,
      candidateUnchanged: isDeepStrictEqual(before, after),
      environment: env,
      stdoutSha256: sha(readFileSync(stdoutPath)),
      stderrSha256: sha(readFileSync(stderrPath)),
      stdoutPath,
      stderrPath,
      receiptPath,
    });
    const record: TaskRecord = {
      schemaVersion: 1,
      id,
      taskUrl,
      kind: operation === "check" ? "attempt" : "diagnosis",
      createdAt: payload.finishedAt,
      revision: before.revision,
      source: origin,
      payload,
    };
    // Retain replayable argv/results in task facts; raw output stays in protected local evidence.
    atomicJson(receiptPath, { record, command });
    await recordFact(context, record);
    return {
      id,
      exitCode: outcome.exitCode,
      reused: false,
      receiptPath,
      stdoutPath,
      stderrPath,
      candidateUnchanged: payload.candidateUnchanged,
    };
  });
}

export async function interpretDiagnosis(
  context: ProjectContext,
  problemKey: string,
  evidenceId: string,
  explanation: string,
  threadId?: string,
) {
  key.parse(problemKey);
  if (!explanation.trim())
    throw new Error("Explain the prediction, observation and next hypothesis");
  const origin = source(threadId);
  return lease(context, async () => {
    const all = entries(context).records,
      state = repairState(context),
      problem = state.problems[problemKey];
    const evidence = all.find((e) => e.record.id === evidenceId),
      last = all.find((e) => e.record.id === problem?.failureIds.at(-1));
    if (
      evidence?.payload.operation !== "diagnose" ||
      evidence.payload.problemKey !== problemKey ||
      !last ||
      evidence.payload.ordinal <= last.payload.ordinal ||
      evidence.payload.exitCode === null ||
      !evidence.payload.candidateUnchanged ||
      !isDeepStrictEqual(evidence.payload.after, workingTree(context.root))
    )
      throw new Error(
        "Fresh diagnosis evidence for this problem and current candidate is required after the last failure",
      );
    const payload = interpretation.parse({
      executor,
      operation: "interpret",
      problemKey,
      ordinal: state.nextOrdinal,
      evidenceId,
      failureIds: problem?.failureIds,
      explanation,
      candidate: workingTree(context.root),
    });
    const record: TaskRecord = {
      schemaVersion: 1,
      id: randomUUID(),
      taskUrl: activeTask(context),
      kind: "diagnosis",
      createdAt: new Date().toISOString(),
      revision: payload.candidate.revision,
      source: origin,
      payload,
    };
    await recordFact(context, record);
    return {
      id: record.id,
      evidenceId,
      causalSufficiency: "requires-independent-review",
    };
  });
}

if (import.meta.main) {
  try {
    const context = projectContext(),
      [operation, problemKey, ...args] = process.argv.slice(2);
    if (operation === "status")
      console.log(JSON.stringify(repairState(context)));
    else if (operation === "interpret")
      console.log(
        JSON.stringify(
          await interpretDiagnosis(
            context,
            problemKey ?? "",
            args[0] ?? "",
            args.slice(1).join(" "),
          ),
        ),
      );
    else if (operation === "check" || operation === "diagnose") {
      const delimiter = args.indexOf("--");
      if (delimiter < 0) throw new Error("Use -- before command argv");
      const cancellation = new AbortController();
      const terminate = () => cancellation.abort();
      process.once("SIGINT", terminate);
      process.once("SIGTERM", terminate);
      let result: Awaited<ReturnType<typeof runRepair>>;
      try {
        result = await runRepair(
          context,
          operation,
          problemKey ?? "",
          operation === "check"
            ? args.slice(0, delimiter).join(" ")
            : "diagnostic experiment",
          args.slice(delimiter + 1),
          cancellation.signal,
        );
      } finally {
        process.removeListener("SIGINT", terminate);
        process.removeListener("SIGTERM", terminate);
      }
      console.log(JSON.stringify(result));
      process.exitCode = result.exitCode === 0 ? 0 : 1;
    } else
      throw new Error(
        "Usage: repair-evidence.ts check <problem> <hypothesis> -- <command> [args...] | diagnose <problem> -- <command> [args...] | interpret <problem> <evidence-id> <explanation> | status",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
