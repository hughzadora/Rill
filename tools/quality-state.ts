import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { resolve } from "node:path";
import { readBoundProfile } from "./quality-binding.js";

export type GateStatus =
  | "pass"
  | "fail"
  | "blocked"
  | "unknown"
  | "not-applicable";

export type QualityCommandInput =
  | {
      operation: "profile" | "conflicts" | "status" | "readiness" | "reconcile";
      root: string;
    }
  | {
      operation: "audit";
      root: string;
      mode?: "baseline" | "proposed";
      execute?: boolean;
    }
  | { operation: "run"; root: string; gate: string }
  | { operation: "plan"; root: string; release?: string }
  | { operation: "setup"; root: string; planId?: string; release: string }
  | {
      operation: "debt";
      root: string;
      action?: "list" | "show";
      findingId?: string;
    };

export interface GateResult {
  id: string;
  status: GateStatus;
  command: string[] | null;
  cwd: string;
  exitCode: number | null;
  signal: string | null;
  durationMs: number | null;
  stdoutSha256: string | null;
  stderrSha256: string | null;
  reason: string | null;
}

export interface QualityResult {
  schemaVersion: 1;
  operation: string;
  projectRoot: string;
  revision: string | null;
  workingTree: {
    state: "clean" | "dirty" | "unknown";
    changedFiles: number | null;
    untrackedFiles: number | null;
    contentSha256: string;
  };
  standardDigest: string | null;
  profileDigest: string | null;
  toolVersions: Record<string, string | null>;
  gateResults: GateResult[];
  coverage: { status: GateStatus; knownRoots: string[]; unknowns: string[] };
  conflicts: Array<{
    code: string;
    status: GateStatus;
    sources: string[];
    reason: string;
  }>;
  debt: { status: GateStatus; findings: Array<{ id: string; status: string }> };
  externalRequirements: Array<{
    id: string;
    status: GateStatus;
    reason: string;
  }>;
  readiness: { state: string; ready: boolean; blockers: string[] };
  nextActions: string[];
  plan?: {
    planId: string;
    status: "blocked" | "ready" | "conflict";
    changes: unknown[];
  };
  execution?: { started: boolean; error: string | null };
}

export interface CommandOutcome {
  exitCode: number | null;
  signal: string | null;
  error: string | null;
  stdout: string;
  stderr: string;
}

export interface QualityCommandDependencies {
  runCommand?: (
    cwd: string,
    argv: string[],
    options: { shell: false },
  ) => CommandOutcome;
  allowLocalApply?: boolean;
  mcpReadOnly?: boolean;
}

export class QualityCommandError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = "QualityCommandError";
  }
}

export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new QualityCommandError(`Not a readable Git project: ${root}`, 64);
  }
}

function treeContentDigest(root: string): string {
  const files = runGit(root, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ])
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    const path = resolve(root, file);
    hash.update(JSON.stringify(file));
    try {
      const stat = lstatSync(path);
      hash.update(String(stat.mode));
      if (stat.isFile()) hash.update(readFileSync(path));
      else if (stat.isSymbolicLink()) hash.update(readlinkSync(path));
      else
        throw new QualityCommandError("Unsupported project entry: " + file, 64);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        hash.update("deleted");
      else throw error;
    }
  }
  return hash.digest("hex");
}

export function projectFacts(requestedRoot: string) {
  if (!requestedRoot || !resolve(requestedRoot)) {
    throw new QualityCommandError("An explicit project root is required", 64);
  }
  let realRequestedRoot: string;
  try {
    realRequestedRoot = realpathSync(requestedRoot);
  } catch {
    throw new QualityCommandError(
      `Project root does not exist: ${requestedRoot}`,
      64,
    );
  }
  const projectRoot = runGit(realRequestedRoot, [
    "rev-parse",
    "--show-toplevel",
  ]);
  const revision = runGit(projectRoot, ["rev-parse", "HEAD"]);
  const status = runGit(projectRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const records = status.split("\0").filter(Boolean);
  const untrackedFiles = records.filter((item) =>
    item.startsWith("?? "),
  ).length;
  const changedFiles = records.length;
  return {
    projectRoot: realpathSync(projectRoot),
    revision,
    workingTree: {
      state: changedFiles === 0 ? ("clean" as const) : ("dirty" as const),
      changedFiles,
      untrackedFiles,
      contentSha256: treeContentDigest(projectRoot),
    },
  };
}

function emptyResult(
  operation: string,
  facts: ReturnType<typeof projectFacts>,
  markers: string[],
): QualityResult {
  return {
    schemaVersion: 1,
    operation,
    ...facts,
    standardDigest: null,
    profileDigest: null,
    toolVersions: { node: process.version, pnpm: null, mise: null },
    gateResults: [],
    coverage: {
      status: "unknown",
      knownRoots: markers,
      unknowns: [
        "No verified immutable quality profile is available for this project.",
      ],
    },
    conflicts: [
      {
        code: "profile-unavailable",
        status: "blocked",
        sources: markers,
        reason:
          "The installed standard/profile cannot be verified, so rule and file conflicts are unknown.",
      },
    ],
    debt: { status: "unknown", findings: [] },
    externalRequirements: [
      {
        id: "native-approval",
        status: "blocked",
        reason:
          "This CLI has no native approval adapter; setup cannot apply changes.",
      },
    ],
    readiness: {
      state: "unprofiled",
      ready: false,
      blockers: [
        "No verified immutable standard/profile is bound to this project.",
      ],
    },
    nextActions: [
      "Review and bind an owner-approved immutable quality profile before planning setup.",
    ],
  };
}

function updateBinding(result: QualityResult, root: string) {
  const binding = readBoundProfile(root);
  if (binding?.valid && binding.bound) {
    result.standardDigest = binding.bound.standardDigest;
    result.profileDigest = binding.digest;
    result.conflicts = [];
    result.coverage.unknowns = [
      "Binding recorded; effective gate coverage is not yet verified.",
    ];
    result.readiness.state = "profiled-unverified";
    result.readiness.blockers = [
      "No verified full-spec gate receipt for this project revision.",
    ];
    result.nextActions = [
      "Install and validate project-specific gates before claiming readiness.",
    ];
  } else if (binding) {
    result.conflicts[0] = {
      code: "binding-invalid",
      status: "blocked",
      sources: [resolve(root, ".quality-standard/profile.json")],
      reason: "Profile content or its release digest is invalid.",
    };
    result.readiness.state = "profile-conflict";
  }
}

export function baseResult(operation: string, root: string): QualityResult {
  const facts = projectFacts(root);
  const markers = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"]
    .filter((name) => existsSync(resolve(facts.projectRoot, name)))
    .map((name) => resolve(facts.projectRoot, name));
  const result = emptyResult(operation, facts, markers);
  updateBinding(result, facts.projectRoot);
  return result;
}
