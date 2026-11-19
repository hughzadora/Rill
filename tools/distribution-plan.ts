import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  migrateSchema1Enrollment,
  type ProjectEnrollmentV2,
  type Schema1MigrationChoices,
  validateProjectEnrollment,
} from "./project-enrollment.ts";
import type {
  InventoryEntry,
  InventoryGitFacts,
  ProjectFileBaseline,
  ProjectInventory,
} from "./project-inventory.ts";
import { readGitFacts } from "./project-inventory.ts";
import type { LoadedStandardRelease } from "./standard-release.ts";
import {
  type RuntimeFacts,
  validateEnrollmentAgainstRelease,
} from "./standard-resolution.ts";

export type DistributionConflictCode =
  | "target-not-found"
  | "ambiguous-target"
  | "target-not-enrolled"
  | "target-disabled"
  | "target-invalid"
  | "migration-choices-required"
  | "migration-choices-mismatch"
  | "local-drift"
  | "inventory-stale"
  | "runtime-incompatible"
  | "release-incompatible";

export interface DistributionConflict {
  code: DistributionConflictCode;
  target: string | null;
  message: string;
}

export interface DistributionFileChange {
  path: string;
  expectedCurrent: ProjectFileBaseline;
  expectedAfter: ProjectFileBaseline;
  diff: { before: string; after: string };
}

export interface DistributionPlanTarget {
  name: string;
  canonicalRoot: string | null;
  repository: string | null;
  classification: InventoryEntry["classification"];
  gitBaseline: (InventoryGitFacts & { statusSha256: string }) | null;
  action: "update" | "unchanged" | "blocked";
  changes: DistributionFileChange[];
  conflicts: DistributionConflict[];
  checks: string[];
  rollbackPrerequisites: string[];
}

export interface DistributionPlan {
  planId: string;
  requestedTargets: string[];
  targetRelease: {
    version: string;
    manifestDigest: string;
    sourceRevision: string;
  };
  runtime: { version: string; compatibleStandards: Record<string, string> };
  nativeConfigEffects: {
    status: "not-planned";
    reason: string;
  };
  targets: DistributionPlanTarget[];
  conflicts: DistributionConflict[];
  checks: string[];
  rollbackPrerequisites: string[];
}

interface BuildPlanInput {
  inventory: ProjectInventory;
  namedTargets: readonly string[];
  targetRelease: LoadedStandardRelease;
  runtimeFacts: RuntimeFacts;
  migrationChoices?: Readonly<Record<string, Schema1MigrationChoices>>;
}

function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const pairs = Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${pairs.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fileState(
  path: string,
  bytes: string,
  mode: number,
): ProjectFileBaseline {
  return { path, bytes, sha256: sha256(bytes), mode };
}

function currentFile(entry: InventoryEntry): ProjectFileBaseline | null {
  const baseline = entry.enrollment;
  if (!baseline || !entry.canonicalRoot) return null;
  const stat = lstatSync(join(entry.canonicalRoot, ".rill", "project.json"));
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  return fileState(
    baseline.path,
    readFileSync(baseline.path, "utf8"),
    stat.mode & 0o777,
  );
}

function selectTargets(inventory: ProjectInventory, requested: string[]) {
  const targets: Array<{ entry: InventoryEntry; name: string }> = [];
  const conflicts: DistributionConflict[] = [];
  for (const name of requested) {
    const matches = inventory.entries.filter(
      (entry) =>
        entry.names.includes(name) ||
        entry.canonicalRoot === name ||
        entry.aliases.includes(name),
    );
    if (!matches.length) {
      conflicts.push({
        code: "target-not-found",
        target: name,
        message: `Named project target was not present in inventory: ${name}`,
      });
    } else if (matches.length > 1) {
      conflicts.push({
        code: "ambiguous-target",
        target: name,
        message: `Named project target matches multiple canonical roots: ${name}`,
      });
    } else {
      const match = matches[0];
      if (match && !targets.some((target) => target.entry === match))
        targets.push({ entry: match, name });
    }
  }
  return { targets, conflicts };
}

function compatibleTarget(input: BuildPlanInput): DistributionConflict[] {
  const manifest = input.targetRelease.manifest;
  const version = manifest.version;
  const conflicts: DistributionConflict[] = [];
  if (!manifest.projectSchemaVersions.includes(2))
    conflicts.push({
      code: "release-incompatible",
      target: null,
      message: `Target release ${version} does not support project schema 2`,
    });
  if (!manifest.runtimeVersions.includes(input.runtimeFacts.runtimeVersion))
    conflicts.push({
      code: "runtime-incompatible",
      target: null,
      message: `Target release ${version} does not support runtime ${input.runtimeFacts.runtimeVersion}`,
    });
  if (
    input.runtimeFacts.compatibleStandards[version] !==
    input.targetRelease.manifestDigest
  )
    conflicts.push({
      code: "runtime-incompatible",
      target: null,
      message: `Runtime ${input.runtimeFacts.runtimeVersion} does not map ${version} to this manifest digest`,
    });
  return conflicts;
}

function targetPlan(
  entry: InventoryEntry,
  selectedName: string,
  input: BuildPlanInput,
  releaseConflicts: DistributionConflict[],
): DistributionPlanTarget {
  const name = selectedName;
  const repository = entry.resolution?.project?.repository ?? null;
  const conflicts: DistributionConflict[] = releaseConflicts.map(
    (conflict) => ({
      ...conflict,
      target: name,
    }),
  );
  const target: DistributionPlanTarget = {
    name,
    canonicalRoot: entry.canonicalRoot,
    repository,
    classification: entry.classification,
    gitBaseline: entry.git
      ? { ...entry.git, statusSha256: sha256(entry.git.status) }
      : null,
    action: "blocked",
    changes: [],
    conflicts,
    checks: [],
    rollbackPrerequisites: [],
  };
  if (conflicts.length) return target;

  if (entry.classification === "disabled") {
    conflicts.push({
      code: "target-disabled",
      target: name,
      message:
        "Disabled projects require an explicit enrollment plan before a standard pin can be changed",
    });
    return target;
  }
  if (entry.classification === "unenrolled") {
    conflicts.push({
      code: "target-not-enrolled",
      target: name,
      message:
        "Unenrolled projects are discovery-only; enrollment requires a separate explicit plan",
    });
    return target;
  }
  if (
    entry.classification === "missing" ||
    entry.classification === "inaccessible" ||
    entry.classification === "nonGit"
  ) {
    conflicts.push({
      code: "target-invalid",
      target: name,
      message: `Project is ${entry.classification} and cannot be planned`,
    });
    return target;
  }
  if (entry.classification === "invalid") {
    conflicts.push({
      code: "target-invalid",
      target: name,
      message: entry.issues[0] ?? "Project enrollment is invalid",
    });
    return target;
  }

  const before = entry.enrollment;
  if (!before || !entry.canonicalRoot || !entry.resolution?.project) {
    conflicts.push({
      code: "inventory-stale",
      target: name,
      message:
        "Inventory did not retain a valid enrollment baseline and project identity",
    });
    return target;
  }
  if (!entry.git) {
    conflicts.push({
      code: "inventory-stale",
      target: name,
      message: "Inventory did not capture a complete Git baseline",
    });
    return target;
  }
  try {
    const currentGit = readGitFacts(entry.canonicalRoot);
    if (
      currentGit.commonDir !== entry.git.commonDir ||
      currentGit.gitDir !== entry.git.gitDir ||
      currentGit.revision !== entry.git.revision ||
      currentGit.status !== entry.git.status
    ) {
      conflicts.push({
        code: "inventory-stale",
        target: name,
        message:
          "Git revision, worktree identity or status changed after inventory",
      });
      return target;
    }
  } catch (error) {
    conflicts.push({
      code: "inventory-stale",
      target: name,
      message: `Git baseline could not be rechecked: ${error instanceof Error ? error.message : String(error)}`,
    });
    return target;
  }
  if (
    entry.git?.statusPaths.includes(".rill/project.json") ||
    (() => {
      try {
        const now = currentFile(entry);
        return !now || now.sha256 !== before.sha256 || now.mode !== before.mode;
      } catch {
        return true;
      }
    })()
  ) {
    conflicts.push({
      code: "local-drift",
      target: name,
      message:
        "Project enrollment has local changes or differs from the captured inventory baseline",
    });
    return target;
  }

  let enrollment: unknown;
  try {
    enrollment = JSON.parse(before.bytes);
  } catch {
    conflicts.push({
      code: "target-invalid",
      target: name,
      message: "Captured project enrollment is not valid JSON",
    });
    return target;
  }

  let afterEnrollment: ProjectEnrollmentV2;
  if (entry.classification === "legacy") {
    const choices =
      input.migrationChoices?.[entry.canonicalRoot] ??
      input.migrationChoices?.[name];
    if (!choices) {
      conflicts.push({
        code: "migration-choices-required",
        target: name,
        message:
          "Schema-1 migration requires explicit standard, tool and exception choices",
      });
      return target;
    }
    if (
      choices.standard.version !== input.targetRelease.manifest.version ||
      choices.standard.digest !== input.targetRelease.manifestDigest
    ) {
      conflicts.push({
        code: "migration-choices-mismatch",
        target: name,
        message:
          "Schema-1 migration choices must pin the explicitly selected target release",
      });
      return target;
    }
    try {
      afterEnrollment = migrateSchema1Enrollment(enrollment, choices);
    } catch (error) {
      conflicts.push({
        code: "target-invalid",
        target: name,
        message: error instanceof Error ? error.message : String(error),
      });
      return target;
    }
  } else {
    if (!validateProjectEnrollment(enrollment)) {
      conflicts.push({
        code: "target-invalid",
        target: name,
        message:
          "Captured project enrollment failed the shared schema-2 validator",
      });
      return target;
    }
    const currentProject = entry.resolution.project;
    if (
      currentProject.schemaVersion !== 2 ||
      enrollment.repository.toLowerCase() !== currentProject.repository
    ) {
      conflicts.push({
        code: "inventory-stale",
        target: name,
        message:
          "Captured project identity does not match the resolved enrollment",
      });
      return target;
    }
    if (
      entry.classification === "enrolled" &&
      (!entry.resolution.release ||
        entry.resolution.release.manifest.version !==
          enrollment.standard.version ||
        entry.resolution.release.manifestDigest !== enrollment.standard.digest)
    ) {
      conflicts.push({
        code: "inventory-stale",
        target: name,
        message: "Resolved release does not match the captured project pin",
      });
      return target;
    }
    afterEnrollment = {
      ...enrollment,
      standard: {
        version: input.targetRelease.manifest.version,
        digest: input.targetRelease.manifestDigest,
      },
    };
  }

  if (!validateProjectEnrollment(afterEnrollment)) {
    conflicts.push({
      code: "target-invalid",
      target: name,
      message: "Planned enrollment failed the shared schema-2 validator",
    });
    return target;
  }
  const releaseIssues = validateEnrollmentAgainstRelease(
    afterEnrollment,
    input.targetRelease,
  );
  if (releaseIssues.length) {
    conflicts.push(
      ...releaseIssues.map((issue) => ({
        code: "release-incompatible" as const,
        target: name,
        message: issue,
      })),
    );
    return target;
  }
  const afterBytes = `${JSON.stringify(afterEnrollment, null, 2)}\n`;
  const after = fileState(before.path, afterBytes, before.mode);
  target.action = before.bytes === after.bytes ? "unchanged" : "update";
  target.changes =
    target.action === "update"
      ? [
          {
            path: ".rill/project.json",
            expectedCurrent: before,
            expectedAfter: after,
            diff: { before: before.bytes, after: after.bytes },
          },
        ]
      : [];
  target.checks = [
    "Recheck enrollment bytes and mode against the inventory baseline before writing",
    "Validate the resulting schema-2 enrollment with the shared resolver",
  ];
  target.rollbackPrerequisites = [
    "Back up exact prior bytes and mode before each write",
    "Restore only while current bytes and mode still equal this plan's after-state",
    "Keep owner edits and unrelated worktree changes intact",
  ];
  return target;
}

export function buildPlan(input: BuildPlanInput): DistributionPlan {
  const requestedTargets = [...new Set(input.namedTargets)].sort();
  const selected = selectTargets(input.inventory, requestedTargets);
  const releaseConflicts = compatibleTarget(input);
  const targets = selected.targets
    .map(({ entry, name }) => targetPlan(entry, name, input, releaseConflicts))
    .sort((a, b) => a.name.localeCompare(b.name));
  const conflicts = [
    ...selected.conflicts,
    ...targets.flatMap((target) => target.conflicts),
  ];
  const planContent = {
    requestedTargets,
    targetRelease: {
      version: input.targetRelease.manifest.version,
      manifestDigest: input.targetRelease.manifestDigest,
      sourceRevision: input.targetRelease.manifest.sourceRevision,
    },
    runtime: {
      version: input.runtimeFacts.runtimeVersion,
      compatibleStandards: input.runtimeFacts.compatibleStandards,
    },
    targets,
    conflicts,
    checks: [
      "Confirm every selected project is an exact named inventory target",
      "Confirm runtime compatibility for the selected immutable release",
      "Review the exact enrollment diff and conflicts before any apply operation",
    ],
    rollbackPrerequisites: [
      "Keep before-state bytes and modes for each selected file",
      "Stop on changed target bytes, mode, revision or configuration before any write",
      "Do not restore over edits made after apply",
    ],
  };
  const planId = sha256(stableJson(planContent));
  return {
    planId,
    ...planContent,
    nativeConfigEffects: {
      status: "not-planned",
      reason:
        "This plan changes project pins only; shared native installation, enablement and trust require separate observed preflight.",
    },
  };
}
