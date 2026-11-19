import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicJson, atomicText } from "./atomic-files.ts";
import {
  type DistributionPlan,
  type DistributionPlanTarget,
  distributionPlanId,
} from "./distribution-plan.ts";
import { checkedProjectPath } from "./project-path-boundary.ts";

export type JournalTargetState =
  | "pending"
  | "writing"
  | "applied"
  | "unchanged"
  | "failed"
  | "rolled-back"
  | "conflict";

export interface DistributionJournalTarget {
  name: string;
  root: string;
  path: string | null;
  state: JournalTargetState;
  before: { sha256: string; mode: number; backupPath: string } | null;
  after: { sha256: string; mode: number } | null;
  error?: string;
}

export interface DistributionJournal {
  schemaVersion: 1;
  planId: string;
  status: "in-progress" | "complete" | "failed" | "conflict" | "rolled-back";
  updatedAt: string;
  targets: DistributionJournalTarget[];
}

export interface RecoveryTarget {
  name: string;
  state: JournalTargetState;
  observed: "before" | "after" | "other" | "unchanged";
  path: string | null;
}

export interface RecoveryResult {
  status: "not-found" | "complete" | "interrupted" | "conflict" | "rolled-back";
  journalPath: string;
  targets: RecoveryTarget[];
  issues: string[];
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function distributionStateDirectory(
  plan: DistributionPlan,
  stateRoot: string,
) {
  return join(stateRoot, plan.planId);
}

export function distributionJournalPath(
  plan: DistributionPlan,
  stateRoot: string,
) {
  return join(distributionStateDirectory(plan, stateRoot), "journal.json");
}

export function writeDistributionJournal(
  path: string,
  journal: DistributionJournal,
) {
  atomicJson(path, { ...journal, updatedAt: new Date().toISOString() });
}

export function readDistributionJournal(
  path: string,
): DistributionJournal | null {
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0)
    throw new Error("Distribution journal is not a private regular file");
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    !((value as DistributionJournal).schemaVersion === 1) ||
    !Array.isArray((value as DistributionJournal).targets)
  )
    throw new Error("Distribution journal is invalid");
  return value as DistributionJournal;
}

export function observeDistributionTarget(
  target: DistributionPlanTarget,
  journalTarget: DistributionJournalTarget,
): RecoveryTarget["observed"] {
  if (target.action === "unchanged") {
    const baseline = target.enrollmentBaseline;
    if (!baseline || !target.canonicalRoot) return "other";
    try {
      if (
        checkedProjectPath(target.canonicalRoot, ".rill/project.json") !==
        baseline.path
      )
        return "other";
      const stat = lstatSync(baseline.path);
      if (!stat.isFile() || stat.isSymbolicLink()) return "other";
      const bytes = readFileSync(baseline.path);
      return sha256(bytes) === baseline.sha256 &&
        (stat.mode & 0o777) === baseline.mode
        ? "unchanged"
        : "other";
    } catch {
      return "other";
    }
  }
  const change = target.changes[0];
  if (!change || !journalTarget.path || !target.canonicalRoot) return "other";
  try {
    if (
      checkedProjectPath(target.canonicalRoot, change.path) !==
      journalTarget.path
    )
      return "other";
    const stat = lstatSync(journalTarget.path);
    if (!stat.isFile() || stat.isSymbolicLink()) return "other";
    const bytes = readFileSync(journalTarget.path);
    const hash = sha256(bytes);
    const mode = stat.mode & 0o777;
    if (
      hash === change.expectedCurrent.sha256 &&
      mode === change.expectedCurrent.mode
    )
      return "before";
    if (
      hash === change.expectedAfter.sha256 &&
      mode === change.expectedAfter.mode
    )
      return "after";
  } catch {
    return "other";
  }
  return "other";
}

export function inspectDistributionRecovery(
  plan: DistributionPlan,
  stateRoot: string,
): RecoveryResult {
  const journalPath = distributionJournalPath(plan, stateRoot);
  if (distributionPlanId(plan) !== plan.planId)
    return {
      status: "conflict",
      journalPath,
      targets: [],
      issues: ["Plan content does not match its plan ID"],
    };
  let journal: DistributionJournal | null;
  try {
    journal = readDistributionJournal(journalPath);
  } catch (error) {
    return {
      status: "conflict",
      journalPath,
      targets: [],
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (!journal)
    return { status: "not-found", journalPath, targets: [], issues: [] };
  if (
    journal.planId !== plan.planId ||
    journal.targets.length !== plan.targets.length
  )
    return {
      status: "conflict",
      journalPath,
      targets: [],
      issues: ["Journal does not match the supplied plan"],
    };
  const stateDirectory = distributionStateDirectory(plan, stateRoot);
  const journalIssues = plan.targets.flatMap((target, index) => {
    const record = journal.targets[index];
    if (
      !record ||
      record.name !== target.name ||
      record.root !== target.canonicalRoot
    )
      return [`${target.name}: journal target identity differs from the plan`];
    if (target.action === "unchanged") {
      return record.path === target.enrollmentBaseline?.path &&
        record.before === null &&
        record.after === null &&
        record.state === "unchanged"
        ? []
        : [`${target.name}: unchanged journal target differs from the plan`];
    }
    const change = target.changes[0];
    const expectedPath = target.canonicalRoot
      ? join(target.canonicalRoot, change?.path ?? "")
      : null;
    const expectedBackup = join(
      stateDirectory,
      "backups",
      `${String(index).padStart(4, "0")}.before`,
    );
    if (
      !change ||
      record.path !== expectedPath ||
      record.before?.sha256 !== change.expectedCurrent.sha256 ||
      record.before?.mode !== change.expectedCurrent.mode ||
      record.before?.backupPath !== expectedBackup ||
      record.after?.sha256 !== change.expectedAfter.sha256 ||
      record.after?.mode !== change.expectedAfter.mode
    )
      return [`${target.name}: journal file states differ from the plan`];
    return [];
  });
  if (journalIssues.length)
    return {
      status: "conflict",
      journalPath,
      targets: [],
      issues: journalIssues,
    };
  const backupIssues = plan.targets.flatMap((target, index) => {
    if (target.action !== "update") return [];
    const record = journal.targets[index];
    if (!record) return [`${target.name}: journal record is missing`];
    try {
      verifyDistributionBeforeBackup(record, target);
      return [];
    } catch (error) {
      return [
        `${target.name}: before-state backup is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
  });
  const targets = plan.targets.map((target, index) => {
    const journalTarget = journal.targets[index];
    return {
      name: target.name,
      state: journalTarget?.state ?? "conflict",
      observed: journalTarget
        ? observeDistributionTarget(target, journalTarget)
        : "other",
      path: journalTarget?.path ?? null,
    };
  });
  const issues = [
    ...backupIssues,
    ...targets.flatMap((target) =>
      target.observed === "other"
        ? [
            `${target.name}: current bytes or mode match neither the plan before-state nor after-state`,
          ]
        : [],
    ),
    ...(journal.status === "conflict"
      ? journal.targets
          .filter((target) => target.state === "conflict")
          .map(
            (target) =>
              `${target.name}: ${target.error ?? "journal records a conflict"}`,
          )
      : []),
  ];
  const allAfter = targets.every(
    (target) => target.observed === "after" || target.observed === "unchanged",
  );
  const allBefore = targets.every(
    (target) => target.observed === "before" || target.observed === "unchanged",
  );
  return {
    status:
      issues.length || journal.status === "conflict"
        ? "conflict"
        : allAfter
          ? "complete"
          : journal.status === "rolled-back" && allBefore
            ? "rolled-back"
            : "interrupted",
    journalPath,
    targets,
    issues,
  };
}

function privateDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0)
    throw new Error(`Distribution state directory is not private: ${path}`);
}

export function verifyDistributionBeforeBackup(
  journalTarget: DistributionJournalTarget,
  target: DistributionPlanTarget,
) {
  const change = target.changes[0];
  if (!change || !journalTarget.before)
    throw new Error(`No before-state backup is recorded for ${target.name}`);
  const backup = journalTarget.before.backupPath;
  const stat = lstatSync(backup);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0)
    throw new Error(
      `Before-state backup is not a private regular file: ${backup}`,
    );
  const bytes = readFileSync(backup);
  if (sha256(bytes) !== change.expectedCurrent.sha256)
    throw new Error(`Before-state backup digest differs for ${target.name}`);
  return { bytes: bytes.toString("utf8"), mode: change.expectedCurrent.mode };
}

export function rollbackDistributionPlan(
  plan: DistributionPlan,
  stateRoot: string,
): RecoveryResult {
  const inspected = inspectDistributionRecovery(plan, stateRoot);
  if (inspected.status === "not-found" || inspected.status === "conflict")
    return inspected;
  const journal = readDistributionJournal(inspected.journalPath);
  if (!journal) return inspected;
  const targets = [...plan.targets].reverse();
  for (const target of targets) {
    const index = plan.targets.indexOf(target);
    const journalTarget = journal.targets[index];
    if (!journalTarget || target.action === "unchanged") continue;
    const observed = observeDistributionTarget(target, journalTarget);
    if (observed === "before") {
      journalTarget.state = "rolled-back";
      continue;
    }
    if (observed !== "after") {
      journalTarget.state = "conflict";
      journalTarget.error =
        "Current file differs from both operation before-state and after-state";
      journal.status = "conflict";
      writeDistributionJournal(inspected.journalPath, journal);
      return inspectDistributionRecovery(plan, stateRoot);
    }
    try {
      const before = verifyDistributionBeforeBackup(journalTarget, target);
      const path = journalTarget.path;
      if (!path)
        throw new Error("Target path is missing from recovery journal");
      if (
        !target.canonicalRoot ||
        checkedProjectPath(
          target.canonicalRoot,
          target.changes[0]?.path ?? "",
        ) !== path
      )
        throw new Error(
          `Target path crosses its project boundary for ${target.name}`,
        );
      if (observeDistributionTarget(target, journalTarget) !== "after")
        throw new Error(
          `Current bytes or mode changed before rollback for ${target.name}`,
        );
      atomicText(path, before.bytes);
      chmodSync(path, before.mode);
      if (
        observeDistributionTarget(target, { ...journalTarget, path }) !==
        "before"
      )
        throw new Error(
          `Restored bytes or mode could not be verified for ${target.name}`,
        );
      journalTarget.state = "rolled-back";
      delete journalTarget.error;
      writeDistributionJournal(inspected.journalPath, journal);
    } catch (error) {
      journalTarget.state = "conflict";
      journalTarget.error =
        error instanceof Error ? error.message : String(error);
      journal.status = "conflict";
      writeDistributionJournal(inspected.journalPath, journal);
      return inspectDistributionRecovery(plan, stateRoot);
    }
  }
  journal.status = "rolled-back";
  writeDistributionJournal(inspected.journalPath, journal);
  return {
    status: "rolled-back",
    journalPath: inspected.journalPath,
    targets: [...plan.targets].map((target, index) => ({
      name: target.name,
      state: journal.targets[index]?.state ?? "conflict",
      observed: observeDistributionTarget(
        target,
        journal.targets[index] ?? {
          name: target.name,
          root: target.canonicalRoot ?? "",
          path: null,
          state: "conflict",
          before: null,
          after: null,
        },
      ),
      path: journal.targets[index]?.path ?? null,
    })),
    issues: [],
  };
}

export function ensureDistributionStateDirectory(path: string) {
  privateDirectory(path);
}
