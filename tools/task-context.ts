import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Ajv } from "ajv";
import formats from "ajv-formats";
import recordSchema from "../schemas/task-record.schema.json" with {
  type: "json",
};
import type {
  ProjectEnrollmentV2,
  ProjectStandardException,
  ProjectToolBinding,
} from "./project-enrollment.ts";
import {
  isSchema1Enrollment,
  validateProjectEnrollment,
} from "./project-enrollment.ts";

export interface TaskRecord {
  schemaVersion: 1;
  id: string;
  taskUrl: string;
  kind: "requirement" | "correction" | "attempt" | "diagnosis" | "checkpoint";
  createdAt: string;
  revision: string | null;
  source: { threadId: string; itemId?: string };
  payload: Record<string, unknown>;
}

interface Issue {
  number: number;
  html_url: string;
  updated_at: string;
  body: string | null;
  state: string;
}

interface Comment {
  user?: { id: number; login?: string } | null;
  id: number;
  body: string | null;
  updated_at: string;
}

export interface TaskSnapshot {
  schemaVersion: 1;
  repository: string;
  taskUrl: string;
  syncedAt: string;
  issue: Issue;
  comments: Comment[];
}

export interface ProjectContext {
  root: string;
  repository: string;
  recoveryRoot: string;
  schemaVersion: 1 | 2;
  standard?: ProjectEnrollmentV2["standard"];
  tools?: ProjectToolBinding[];
  exceptions?: ProjectStandardException[];
}

export function repositoryRevision(root: string) {
  const head = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  if (head.error) throw head.error;
  if (head.status === 0)
    return {
      revision: head.stdout.trim(),
      revisionState: "committed" as const,
    };
  const symbolic = spawnSync("git", ["symbolic-ref", "-q", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  if (symbolic.status !== 0)
    throw new Error(head.stderr || "Cannot resolve repository HEAD");
  const reference = spawnSync(
    "git",
    ["show-ref", "--verify", "--quiet", symbolic.stdout.trim()],
    { cwd: root, encoding: "utf8" },
  );
  if (reference.status !== 1)
    throw new Error(
      reference.stderr || "Cannot verify unborn repository state",
    );
  return { revision: null, revisionState: "unborn" as const };
}

const ajv = new Ajv({ allErrors: true });
formats.default(ajv);
export const validateRecord = ajv.compile<TaskRecord>(recordSchema);
const issueSchema = {
  type: "object",
  required: ["number", "html_url", "updated_at", "body", "state"],
  properties: {
    number: { type: "integer", minimum: 1 },
    html_url: { type: "string", format: "uri" },
    updated_at: { type: "string", format: "date-time" },
    body: { type: ["string", "null"] },
    state: { enum: ["open", "closed"] },
  },
};
const commentSchema = {
  type: "object",
  required: ["id", "body", "updated_at"],
  properties: {
    id: { type: "integer", minimum: 1 },
    body: { type: ["string", "null"] },
    updated_at: { type: "string", format: "date-time" },
  },
};
const validateIssue = ajv.compile<Issue>(issueSchema);
const validateComment = ajv.compile<Comment>(commentSchema);
const validateSnapshot = ajv.compile<TaskSnapshot>({
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "repository",
    "taskUrl",
    "syncedAt",
    "issue",
    "comments",
  ],
  properties: {
    schemaVersion: { const: 1 },
    repository: { type: "string" },
    taskUrl: { type: "string", format: "uri" },
    syncedAt: { type: "string", format: "date-time" },
    issue: issueSchema,
    comments: { type: "array", items: commentSchema },
  },
});
export function projectContext(cwd = process.cwd()): ProjectContext {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const project: unknown = JSON.parse(
    readFileSync(join(root, ".rill/project.json"), "utf8"),
  );
  if (!isSchema1Enrollment(project) && !validateProjectEnrollment(project))
    throw new Error(
      "Invalid project enrollment: schema 1 or schema 2 is required",
    );
  const identity = project as
    | { schemaVersion: 1; repository: string }
    | ProjectEnrollmentV2;
  const gitPath = execFileSync(
    "git",
    ["rev-parse", "--git-path", "rill-recovery"],
    { cwd: root, encoding: "utf8" },
  ).trim();
  return {
    root,
    repository: identity.repository.toLowerCase(),
    recoveryRoot: resolve(root, gitPath),
    schemaVersion: identity.schemaVersion,
    ...(identity.schemaVersion === 2
      ? {
          standard: identity.standard,
          tools: identity.tools,
          exceptions: identity.exceptions,
        }
      : {}),
  };
}

export function taskIdentity(url: string, repository: string) {
  const parsed = new URL(url);
  const match = /^\/([^/]+\/[^/]+)\/issues\/([1-9][0-9]*)\/?$/.exec(
    parsed.pathname,
  );
  if (
    parsed.protocol !== "https:" ||
    parsed.host !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    !match ||
    match[1]?.toLowerCase() !== repository.toLowerCase()
  ) {
    throw new Error(
      "Task URL must identify an issue in the enrolled GitHub repository",
    );
  }
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number)) throw new Error("Invalid issue number");
  return {
    url: `https://github.com/${repository.toLowerCase()}/issues/${number}`,
    endpoint: `repos/${repository}/issues/${number}`,
    number,
  };
}

export function atomicJson(path: string, value: unknown) {
  atomicText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function atomicText(path: string, value: string) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(file, value);
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), "r");
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}

async function locked<T>(
  context: ProjectContext,
  operation: () => Promise<T>,
): Promise<T> {
  mkdirSync(context.recoveryRoot, { recursive: true, mode: 0o700 });
  const lock = join(context.recoveryRoot, "operation.lock");
  mkdirSync(lock);
  try {
    atomicJson(join(lock, "owner.json"), {
      pid: process.pid,
      createdAt: new Date().toISOString(),
    });
    return await operation();
  } finally {
    rmSync(lock, { recursive: true });
  }
}

class RemoteUnavailable extends Error {}

async function ghJson(
  endpoint: string,
  flags: string[] = [],
  body?: unknown,
): Promise<unknown> {
  const args = ["api", "--hostname", "github.com", endpoint, ...flags];
  if (body !== undefined) args.push("--method", "POST", "--input", "-");
  const result = await new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
  }>((fulfill, reject) => {
    const child = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => reject(new RemoteUnavailable(error.message)));
    child.on("close", (code) =>
      fulfill({
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
        code,
      }),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(body === undefined ? undefined : JSON.stringify(body));
  });
  if (result.code !== 0)
    throw new RemoteUnavailable(result.stderr || `gh exited ${result.code}`);
  return JSON.parse(result.stdout);
}

function taskDirectory(context: ProjectContext, taskUrl: string) {
  const identity = taskIdentity(taskUrl, context.repository);
  return join(
    context.recoveryRoot,
    createHash("sha256").update(identity.url).digest("hex"),
  );
}

export function activeTask(context: ProjectContext): string {
  const binding: unknown = JSON.parse(
    readFileSync(join(context.recoveryRoot, "active.json"), "utf8"),
  );
  if (
    !binding ||
    typeof binding !== "object" ||
    !("taskUrl" in binding) ||
    typeof binding.taskUrl !== "string"
  )
    throw new Error("No valid active task binding");
  return taskIdentity(binding.taskUrl, context.repository).url;
}

export function cachedTask(
  context: ProjectContext,
  taskUrl = activeTask(context),
): TaskSnapshot {
  const snapshot: unknown = JSON.parse(
    readFileSync(
      join(taskDirectory(context, taskUrl), "snapshot.json"),
      "utf8",
    ),
  );
  if (!validateSnapshot(snapshot))
    throw new Error(
      `Invalid recovery snapshot: ${ajv.errorsText(validateSnapshot.errors)}`,
    );
  const identity = taskIdentity(taskUrl, context.repository);
  if (
    snapshot.repository !== context.repository ||
    snapshot.taskUrl !== identity.url ||
    snapshot.issue.number !== identity.number ||
    snapshot.issue.html_url.toLowerCase() !== identity.url
  )
    throw new Error("Snapshot identity mismatch");
  return snapshot;
}

async function remoteTask(
  context: ProjectContext,
  url: string,
): Promise<TaskSnapshot> {
  const task = taskIdentity(url, context.repository);
  const [issue, pages] = await Promise.all([
    ghJson(task.endpoint),
    ghJson(`${task.endpoint}/comments?per_page=100`, ["--paginate", "--slurp"]),
  ]);
  if (
    !validateIssue(issue) ||
    issue.number !== task.number ||
    issue.html_url.toLowerCase() !== task.url
  )
    throw new Error("Invalid or mismatched remote issue");
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page)))
    throw new Error("Invalid comment pagination response");
  const comments: unknown[] = pages.flat();
  const validComments: Comment[] = [];
  for (const comment of comments) {
    if (!validateComment(comment)) throw new Error("Invalid remote comment");
    validComments.push(comment);
  }
  return {
    schemaVersion: 1,
    repository: context.repository,
    taskUrl: task.url,
    syncedAt: new Date().toISOString(),
    issue,
    comments: validComments,
  };
}

export async function syncTask(context: ProjectContext, url: string) {
  const taskUrl = taskIdentity(url, context.repository).url;
  return locked(context, async () => {
    let snapshot: TaskSnapshot;
    try {
      snapshot = await remoteTask(context, taskUrl);
    } catch (error) {
      if (!(error instanceof RemoteUnavailable)) throw error;
      if (activeTask(context) !== taskUrl)
        throw new Error("Cannot switch tasks while the remote is unavailable");
      return {
        status: "cached",
        warning: error.message,
        snapshot: cachedTask(context, taskUrl),
      };
    }
    atomicJson(
      join(taskDirectory(context, taskUrl), "snapshot.json"),
      snapshot,
    );
    atomicJson(join(context.recoveryRoot, "active.json"), { taskUrl });
    return { status: "online", snapshot };
  });
}

export function pendingRecords(
  context: ProjectContext,
  taskUrl = activeTask(context),
): TaskRecord[] {
  const outbox = join(taskDirectory(context, taskUrl), "outbox");
  if (!existsSync(outbox)) return [];
  return readdirSync(outbox)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const record: unknown = JSON.parse(
        readFileSync(join(outbox, name), "utf8"),
      );
      if (
        !validateRecord(record) ||
        record.taskUrl !== taskUrl ||
        name !== `${record.id}.json`
      )
        throw new Error(`Invalid pending record: ${name}`);
      return record;
    })
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
}

const validateAuthority = ajv.compile<{
  schemaVersion: 1;
  githubUserIds: number[];
}>({
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "githubUserIds"],
  properties: {
    schemaVersion: { const: 1 },
    githubUserIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "integer", minimum: 1 },
    },
  },
});

export function trustedPublisherIds(context: ProjectContext): number[] {
  const value: unknown = JSON.parse(
    readFileSync(join(context.root, ".rill/authority.json"), "utf8"),
  );
  if (!validateAuthority(value))
    throw new Error("Invalid project record-publisher authority");
  return value.githubUserIds;
}

function trustedComment(comment: Comment, publishers: number[]) {
  if (!comment.user || !Number.isSafeInteger(comment.user.id))
    throw new Error(
      "Machine record author is unavailable; recover GitHub source metadata before dependent work",
    );
  return publishers.includes(comment.user.id);
}

export function taskRecordView(context: ProjectContext) {
  const snapshot = cachedTask(context);
  const pending = pendingRecords(context);
  const records = new Map<string, TaskRecord>();
  const ignoredCommentIds: number[] = [];
  let publishers: number[] | undefined;
  for (const comment of snapshot.comments) {
    if (!comment.body?.startsWith("<!-- rill-record:v1:")) continue;
    publishers ??= trustedPublisherIds(context);
    if (!trustedComment(comment, publishers)) {
      ignoredCommentIds.push(comment.id);
      continue;
    }
    const match =
      /^<!-- rill-record:v1:([^ ]+) -->\n\n```json\n([\s\S]+)\n```$/.exec(
        comment.body,
      );
    if (!match?.[2])
      throw new Error("Malformed Rill record in authoritative task");
    const record: unknown = JSON.parse(match[2]);
    if (
      !validateRecord(record) ||
      record.id !== match[1] ||
      record.taskUrl !== snapshot.taskUrl
    )
      throw new Error("Mismatched authoritative Rill record");
    const previous = records.get(record.id);
    if (previous && !isDeepStrictEqual(previous, record))
      throw new Error("Conflicting authoritative record identity");
    records.set(record.id, record);
  }
  for (const record of pending) {
    const previous = records.get(record.id);
    if (previous && !isDeepStrictEqual(previous, record))
      throw new Error("Pending record conflicts with authoritative task");
    records.set(record.id, record);
  }
  return {
    records: [...records.values()].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
    ignoredCommentIds,
    trustedPublisherIds: publishers ?? [],
  };
}

export function taskRecords(context: ProjectContext): TaskRecord[] {
  return taskRecordView(context).records;
}

// Public fact entry preserves observations; actual execution records come from the runner.
export async function recordUserFact(context: ProjectContext, record: unknown) {
  if (validateRecord(record) && record.payload.executor === "rill-repair/v1")
    throw new Error(
      "Repair results are executor-owned; use repair-check/diagnose/interpret instead",
    );
  if (
    validateRecord(record) &&
    record.payload.executor === "rill-decision-source/v1"
  )
    throw new Error(
      "Native decision sources are source-owned; use record_decision_source instead",
    );
  if (validateRecord(record) && record.payload.executor === "rill-delivery/v1")
    throw new Error(
      "Delivery conclusions are executor-owned; use delivery-audit/retract instead",
    );
  return recordFact(context, record);
}

export async function recordFact(
  context: ProjectContext,
  record: unknown,
): Promise<TaskRecord> {
  if (!validateRecord(record))
    throw new Error(
      `Invalid task record: ${ajv.errorsText(validateRecord.errors)}`,
    );
  return locked(context, async () => {
    if (record.taskUrl !== activeTask(context))
      throw new Error("Record does not belong to the active task");
    cachedTask(context);
    const path = join(
      taskDirectory(context, record.taskUrl),
      "outbox",
      `${record.id}.json`,
    );
    if (
      existsSync(path) &&
      !isDeepStrictEqual(JSON.parse(readFileSync(path, "utf8")), record)
    )
      throw new Error("Record ID already contains different facts");
    atomicJson(path, record);
    return record;
  });
}

function recordBody(record: TaskRecord) {
  return `<!-- rill-record:v1:${record.id} -->\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``;
}

export async function publishRecords(context: ProjectContext) {
  return locked(context, async () => {
    const taskUrl = activeTask(context);
    const identity = taskIdentity(taskUrl, context.repository);
    const previous = cachedTask(context);
    const publishers = trustedPublisherIds(context);
    const principal = await ghJson("user");
    if (
      !principal ||
      typeof principal !== "object" ||
      !("id" in principal) ||
      typeof principal.id !== "number" ||
      !publishers.includes(principal.id)
    )
      throw new Error(
        "Current GitHub identity is not a configured record publisher; retain the outbox and reconcile authorization",
      );
    let current = await remoteTask(context, taskUrl);
    if (
      current.issue.body !== previous.issue.body ||
      current.issue.state !== previous.issue.state
    )
      throw new Error(
        "Remote scope or task state changed; synchronize and reconcile before publishing",
      );
    const records = pendingRecords(context);
    let published = 0;
    for (const record of records) {
      const body = recordBody(record);
      const marker = `<!-- rill-record:v1:${record.id} -->`;
      const matches = current.comments.filter(
        (comment) =>
          comment.body?.includes(marker) && trustedComment(comment, publishers),
      );
      if (matches.length > 1 || (matches[0] && matches[0].body !== body))
        throw new Error(
          "Conflicting remote record identity; keep the local outbox",
        );
      let comment: unknown = matches[0];
      if (!comment)
        comment = await ghJson(`${identity.endpoint}/comments`, [], { body });
      if (!validateComment(comment) || !trustedComment(comment, publishers))
        throw new Error(
          "Invalid or untrusted publish response; keep the local outbox",
        );
      const confirmed = await ghJson(
        `repos/${context.repository}/issues/comments/${comment.id}`,
      );
      if (
        !validateComment(confirmed) ||
        confirmed.id !== comment.id ||
        confirmed.body !== body ||
        !trustedComment(confirmed, publishers)
      )
        throw new Error("Publication readback mismatch; keep the local outbox");
      current = {
        ...current,
        comments: [
          ...current.comments.filter((entry) => entry.id !== confirmed.id),
          confirmed,
        ],
      };
      atomicJson(
        join(taskDirectory(context, taskUrl), "snapshot.json"),
        current,
      );
      atomicJson(
        join(taskDirectory(context, taskUrl), "receipts", `${record.id}.json`),
        {
          record,
          commentId: confirmed.id,
          confirmedAt: new Date().toISOString(),
        },
      );
      rmSync(
        join(taskDirectory(context, taskUrl), "outbox", `${record.id}.json`),
      );
      published += 1;
    }
    current = await remoteTask(context, taskUrl);
    atomicJson(join(taskDirectory(context, taskUrl), "snapshot.json"), current);
    return { published, remaining: pendingRecords(context).length };
  });
}

if (import.meta.main) {
  try {
    const context = projectContext();
    const [command, argument] = process.argv.slice(2);
    if (command === "sync" && argument) {
      const result = await syncTask(context, argument);
      console.log(
        JSON.stringify({
          status: result.status,
          taskUrl: result.snapshot.taskUrl,
          syncedAt: result.snapshot.syncedAt,
          warning: "warning" in result ? result.warning : undefined,
          pending: pendingRecords(context).length,
        }),
      );
    } else if (command === "record" && argument) {
      console.log(
        JSON.stringify(
          await recordUserFact(
            context,
            JSON.parse(readFileSync(argument, "utf8")),
          ),
        ),
      );
    } else if (command === "publish") {
      console.log(JSON.stringify(await publishRecords(context)));
    } else
      throw new Error(
        "Usage: task-context.ts sync <issue-url> | record <record.json> | publish",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
