import { createHash } from "node:crypto";
import { chmodSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type DistributionPlan,
  type DistributionPlanTarget,
  distributionPlanId,
} from "./distribution-plan.ts";
import {
  type DistributionJournal,
  type DistributionJournalTarget,
  distributionJournalPath,
  distributionStateDirectory,
  ensureDistributionStateDirectory,
  inspectDistributionRecovery,
  type JournalTargetState,
  readDistributionJournal,
  writeDistributionJournal,
} from "./distribution-recovery.ts";
import { readGitFacts } from "./project-inventory.ts";
import { checkedProjectPath } from "./project-path-boundary.ts";
import { atomicText } from "./task-context.ts";

export interface ApplyTargetResult {
  name: string;
  state: JournalTargetState;
  path: string | null;
  error?: string;
}

export interface ApplyResult {
  status: "complete" | "stale" | "failed" | "interrupted" | "conflict";
  planId: string;
  nativeConfigEffects: DistributionPlan["nativeConfigEffects"];
  journalPath: string | null;
  targets: ApplyTargetResult[];
  issues: string[];
}

export interface DistributionApplyOptions {
  /** Test and filesystem-fault seam; production callers should use the default atomic writer. */
  writeEnrollment?(path: string, bytes: string, mode: number): void;
  /** Resume an existing operation only after the journal and current files are reconciled. */
  resume?: boolean;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function currentFile(root: string, path: string) {
  if (checkedProjectPath(root, ".rill/project.json") !== path)
    throw new Error("Enrollment target is outside its canonical project path");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Enrollment target is not a regular file");
  const bytes = readFileSync(path);
  return { bytes, sha256: sha256(bytes), mode: stat.mode & 0o777 };
}

function targetPath(target: DistributionPlanTarget) {
  const change = target.changes[0];
  if (!target.canonicalRoot || !change)
    throw new Error(
      `Plan target ${target.name} has no writable enrollment change`,
    );
  const path = resolve(target.canonicalRoot, change.path);
  if (
    path !== change.expectedCurrent.path ||
    checkedProjectPath(target.canonicalRoot, change.path) !== path
  )
    throw new Error(
      `Plan target ${target.name} contains an unexpected write path`,
    );
  if (change.path !== ".rill/project.json")
    throw new Error(
      `Plan target ${target.name} names an unsupported write path`,
    );
  if (
    !target.enrollmentBaseline ||
    target.enrollmentBaseline.path !== change.expectedCurrent.path ||
    target.enrollmentBaseline.bytes !== change.expectedCurrent.bytes ||
    target.enrollmentBaseline.sha256 !== change.expectedCurrent.sha256 ||
    target.enrollmentBaseline.mode !== change.expectedCurrent.mode ||
    sha256(change.expectedCurrent.bytes) !== change.expectedCurrent.sha256 ||
    sha256(change.expectedAfter.bytes) !== change.expectedAfter.sha256 ||
    change.diff.before !== change.expectedCurrent.bytes ||
    change.diff.after !== change.expectedAfter.bytes ||
    change.expectedCurrent.mode !== change.expectedAfter.mode
  )
    throw new Error(
      `Plan target ${target.name} contains inconsistent file states`,
    );
  return { path, change };
}

function gitMatches(target: DistributionPlanTarget) {
  if (!target.canonicalRoot || !target.gitBaseline)
    throw new Error(`Plan target ${target.name} has no Git baseline`);
  const actual = readGitFacts(target.canonicalRoot);
  const baseline = target.gitBaseline;
  const mismatches = [
    actual.commonDir !== baseline.commonDir ? "common directory" : null,
    actual.gitDir !== baseline.gitDir ? "worktree Git directory" : null,
    actual.revision !== baseline.revision ? "revision" : null,
    actual.status !== baseline.status ? "working-tree status" : null,
    sha256(actual.status) !== baseline.statusSha256 ? "status digest" : null,
  ].filter((value): value is string => value !== null);
  if (mismatches.length)
    throw new Error(`Git baseline changed (${mismatches.join(", ")})`);
  return true;
}

function validatePlan(plan: DistributionPlan) {
  if (distributionPlanId(plan) !== plan.planId)
    throw new Error("Distribution plan content does not match its plan ID");
  if (
    plan.conflicts.length ||
    plan.targets.some((target) => target.action === "blocked")
  )
    throw new Error("A conflicted distribution plan cannot be applied");
  if (
    plan.nativeConfigEffects.status !== "not-planned" ||
    !plan.nativeConfigEffects.reason
  )
    throw new Error(
      "Plan contains unsupported or unverified native configuration effects",
    );
  for (const target of plan.targets) {
    if (target.conflicts.length)
      throw new Error(`Plan target ${target.name} has unresolved conflicts`);
    if (target.action === "unchanged") {
      const baseline = target.enrollmentBaseline;
      if (
        !target.canonicalRoot ||
        !baseline ||
        baseline.path !== join(target.canonicalRoot, ".rill/project.json") ||
        sha256(baseline.bytes) !== baseline.sha256
      )
        throw new Error(
          `Unchanged target ${target.name} has no valid enrollment baseline`,
        );
      if (target.changes.length)
        throw new Error(`Unchanged target ${target.name} has file changes`);
      continue;
    }
    if (target.changes.length !== 1)
      throw new Error(
        `Plan target ${target.name} must contain one enrollment change`,
      );
    targetPath(target);
  }
}

function checkBeforeState(target: DistributionPlanTarget) {
  if (!target.canonicalRoot)
    throw new Error(`Plan target ${target.name} has no canonical project root`);
  const { path, change } = targetPath(target);
  const current = currentFile(target.canonicalRoot, path);
  if (
    current.sha256 !== change.expectedCurrent.sha256 ||
    current.mode !== change.expectedCurrent.mode
  )
    throw new Error(
      `Target ${target.name} enrollment differs from the planned before-state`,
    );
  if (!gitMatches(target))
    throw new Error(
      `Target ${target.name} Git baseline changed after planning`,
    );
  return { path, change };
}

function checkUnchangedState(target: DistributionPlanTarget) {
  const baseline = target.enrollmentBaseline;
  if (!baseline || !target.canonicalRoot)
    throw new Error(
      `Unchanged target ${target.name} has no enrollment baseline`,
    );
  const current = currentFile(target.canonicalRoot, baseline.path);
  if (current.sha256 !== baseline.sha256 || current.mode !== baseline.mode)
    throw new Error(
      `Target ${target.name} enrollment differs from its unchanged plan baseline`,
    );
  if (!gitMatches(target))
    throw new Error(
      `Target ${target.name} Git baseline changed after planning`,
    );
}

function writeEnrollment(path: string, bytes: string, mode: number) {
  atomicText(path, bytes);
  chmodSync(path, mode);
}

function resultFromJournal(
  status: ApplyResult["status"],
  plan: DistributionPlan,
  journalPath: string | null,
  journal?: DistributionJournal,
  issues: string[] = [],
): ApplyResult {
  return {
    status,
    planId: plan.planId,
    nativeConfigEffects: plan.nativeConfigEffects,
    journalPath,
    targets: plan.targets.map((target, index) => ({
      name: target.name,
      state: journal?.targets[index]?.state ?? "pending",
      path: journal?.targets[index]?.path ?? null,
      ...(journal?.targets[index]?.error
        ? { error: journal.targets[index].error }
        : {}),
    })),
    issues,
  };
}

function initializeJournal(plan: DistributionPlan, stateDirectory: string) {
  const backupDirectory = join(stateDirectory, "backups");
  ensureDistributionStateDirectory(backupDirectory);
  const targets: DistributionJournalTarget[] = [];
  for (const [index, target] of plan.targets.entries()) {
    if (target.action === "unchanged") {
      targets.push({
        name: target.name,
        root: target.canonicalRoot ?? "",
        path: target.enrollmentBaseline?.path ?? null,
        state: "unchanged",
        before: null,
        after: null,
      });
      continue;
    }
    const { path, change } = targetPath(target);
    const backupPath = join(
      backupDirectory,
      `${String(index).padStart(4, "0")}.before`,
    );
    try {
      const existing = lstatSync(backupPath);
      if (
        !existing.isFile() ||
        existing.isSymbolicLink() ||
        (existing.mode & 0o077) !== 0 ||
        sha256(readFileSync(backupPath)) !== change.expectedCurrent.sha256
      )
        throw new Error(
          `Existing before-state backup conflicts for ${target.name}`,
        );
    } catch (error) {
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
      )
        throw error;
      atomicText(backupPath, change.expectedCurrent.bytes);
    }
    targets.push({
      name: target.name,
      root: target.canonicalRoot ?? "",
      path,
      state: "pending",
      before: {
        sha256: change.expectedCurrent.sha256,
        mode: change.expectedCurrent.mode,
        backupPath,
      },
      after: {
        sha256: change.expectedAfter.sha256,
        mode: change.expectedAfter.mode,
      },
    });
  }
  return {
    schemaVersion: 1 as const,
    planId: plan.planId,
    status: "in-progress" as const,
    updatedAt: new Date().toISOString(),
    targets,
  };
}

export function applyDistributionPlan(
  plan: DistributionPlan,
  stateRoot: string,
  options: DistributionApplyOptions = {},
): ApplyResult {
  validatePlan(plan);
  const stateDirectory = distributionStateDirectory(plan, stateRoot);
  const journalPath = distributionJournalPath(plan, stateRoot);
  let journal: DistributionJournal | null = null;
  try {
    ensureDistributionStateDirectory(stateRoot);
    const existing = readDistributionJournal(journalPath);
    if (existing) {
      const recovery = inspectDistributionRecovery(plan, stateRoot);
      if (recovery.status === "complete")
        return resultFromJournal("complete", plan, journalPath, existing);
      if (recovery.status === "conflict")
        return resultFromJournal(
          "conflict",
          plan,
          journalPath,
          existing,
          recovery.issues,
        );
      if (!options.resume)
        return resultFromJournal("interrupted", plan, journalPath, existing, [
          "An apply journal already exists; inspect it and explicitly resume or roll back",
        ]);
      journal = existing;
      for (const [index, target] of plan.targets.entries()) {
        const record = journal.targets[index];
        const observation = recovery.targets[index]?.observed;
        if (!record || !observation || observation === "other")
          return resultFromJournal("conflict", plan, journalPath, journal, [
            `Could not reconcile current state for ${target.name}`,
          ]);
        if (observation === "after") record.state = "applied";
        else if (observation === "before" && target.action === "update") {
          record.state = "pending";
          try {
            checkBeforeState(target);
          } catch (error) {
            record.state = "conflict";
            record.error =
              error instanceof Error ? error.message : String(error);
            journal.status = "conflict";
            writeDistributionJournal(journalPath, journal);
            return resultFromJournal("stale", plan, journalPath, journal, [
              record.error,
            ]);
          }
        }
      }
      journal.status = "in-progress";
      writeDistributionJournal(journalPath, journal);
    } else {
      for (const target of plan.targets) {
        if (target.action === "update") checkBeforeState(target);
        else checkUnchangedState(target);
      }
      ensureDistributionStateDirectory(stateDirectory);
      journal = initializeJournal(plan, stateDirectory);
      writeDistributionJournal(journalPath, journal);
    }
  } catch (error) {
    return resultFromJournal("stale", plan, null, undefined, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const writer = options.writeEnrollment ?? writeEnrollment;
  for (const [index, target] of plan.targets.entries()) {
    const record = journal.targets[index];
    if (!record || target.action === "unchanged" || record.state === "applied")
      continue;
    try {
      const { path, change } = targetPath(target);
      record.state = "writing";
      delete record.error;
      writeDistributionJournal(journalPath, journal);
      const currentBefore = checkBeforeState(target);
      if (currentBefore.path !== path)
        throw new Error(`Target ${target.name} path changed during apply`);
      writer(
        currentBefore.path,
        change.expectedAfter.bytes,
        change.expectedAfter.mode,
      );
      if (!target.canonicalRoot)
        throw new Error(
          `Plan target ${target.name} has no canonical project root`,
        );
      const current = currentFile(target.canonicalRoot, currentBefore.path);
      if (
        current.sha256 !== change.expectedAfter.sha256 ||
        current.mode !== change.expectedAfter.mode
      )
        throw new Error(
          `Written enrollment did not match planned after-state for ${target.name}`,
        );
      record.state = "applied";
      record.path = path;
      journal.status = "in-progress";
      writeDistributionJournal(journalPath, journal);
    } catch (error) {
      record.state = "failed";
      record.error = error instanceof Error ? error.message : String(error);
      journal.status = "failed";
      writeDistributionJournal(journalPath, journal);
      return resultFromJournal("failed", plan, journalPath, journal, [
        record.error,
      ]);
    }
  }
  journal.status = "complete";
  writeDistributionJournal(journalPath, journal);
  return resultFromJournal("complete", plan, journalPath, journal);
}
