import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import {
  type ProjectResolution,
  type RuntimeFacts,
  resolveProject as resolveStandardProject,
} from "./standard-resolution.ts";

export type InventoryClassification =
  | "enrolled"
  | "legacy"
  | "disabled"
  | "unenrolled"
  | "missing"
  | "inaccessible"
  | "nonGit"
  | "unsupported"
  | "invalid";

export interface ProjectReference {
  path: string;
  name?: string;
  trustPath?: string;
}

export interface InventoryGitFacts {
  commonDir: string;
  gitDir: string;
  linkedWorktree: boolean;
  branch: string | null;
  revision: string | null;
  status: string;
  statusPaths: string[];
  dirty: boolean;
}

export interface ProjectFileBaseline {
  path: string;
  bytes: string;
  sha256: string;
  mode: number;
}

export interface InventoryEntry {
  canonicalRoot: string | null;
  name: string;
  names: string[];
  aliases: string[];
  sources: Array<"explicit" | "registered" | "worktree">;
  trustPaths: string[];
  classification: InventoryClassification;
  git: InventoryGitFacts | null;
  resolution: ProjectResolution | null;
  enrollment: ProjectFileBaseline | null;
  issues: string[];
}

export interface ProjectInventory {
  entries: InventoryEntry[];
  coverage: {
    inputCount: number;
    inspectedCount: number;
    gapCount: number;
    gaps: Array<{
      name: string;
      path: string;
      classification: InventoryClassification;
      issue: string;
    }>;
  };
}

export interface InventoryInput {
  registeredProjects: readonly ProjectReference[];
  explicitRoots: readonly (string | ProjectReference)[];
  runtimeFacts: RuntimeFacts;
}

export interface InventoryDependencies {
  resolveProject?: typeof resolveStandardProject;
  realpath?(path: string): string;
}

interface Candidate {
  path: string;
  name: string;
  source: "explicit" | "registered" | "worktree";
  trustPath?: string;
}

function absolutePath(path: string) {
  return resolve(path);
}

function codeOf(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

function command(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trimEnd();
}

function listedWorktrees(root: string): string[] {
  const result = spawnSync("git", ["worktree", "list", "--porcelain", "-z"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr.trim() || "git worktree list failed");
  return result.stdout
    .split("\0")
    .filter((field) => field.startsWith("worktree "))
    .map((field) => field.slice("worktree ".length));
}

export function readGitFacts(root: string): InventoryGitFacts {
  const gitDir = command(root, ["rev-parse", "--absolute-git-dir"]);
  const commonDirValue = command(root, ["rev-parse", "--git-common-dir"]);
  const commonDir = isAbsolute(commonDirValue)
    ? resolve(commonDirValue)
    : resolve(root, commonDirValue);
  let branch: string | null = null;
  let revision: string | null = null;
  try {
    branch = command(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch {
    // A detached or unborn HEAD has no symbolic branch name.
  }
  try {
    revision = command(root, ["rev-parse", "--verify", "HEAD"]);
  } catch {
    // An unborn repository is still a Git project; its revision is unknown.
  }
  const status = command(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--ignore-submodules=none",
    "-z",
  ]);
  const statusPaths = status
    .split("\0")
    .filter(Boolean)
    .map((item) => item.slice(3));
  return {
    commonDir,
    gitDir: resolve(gitDir),
    linkedWorktree: resolve(gitDir) !== commonDir,
    branch,
    revision,
    status,
    statusPaths,
    dirty: status.length > 0,
  };
}

function enrollmentBaseline(root: string): ProjectFileBaseline | null {
  const path = join(root, ".rill", "project.json");
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (codeOf(error) === "ENOENT" || codeOf(error) === "ENOTDIR") return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  const bytes = readFileSync(path);
  return {
    path,
    bytes: bytes.toString("utf8"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mode: stat.mode & 0o777,
  };
}

function classificationForResolution(
  resolution: ProjectResolution,
): InventoryClassification {
  switch (resolution.status) {
    case "ready":
      return "enrolled";
    case "legacy":
    case "unenrolled":
    case "unsupported":
    case "invalid":
      return resolution.status;
  }
}

function coverageGap(entry: InventoryEntry) {
  return (
    entry.issues.length > 0 ||
    ["missing", "inaccessible", "nonGit", "unsupported", "invalid"].includes(
      entry.classification,
    )
  );
}

function createCandidate(
  value: string | ProjectReference,
  source: Candidate["source"],
): Candidate {
  const ref = typeof value === "string" ? { path: value } : value;
  const path = absolutePath(ref.path);
  return {
    path,
    name: ref.name?.trim() || basename(path) || path,
    source,
    ...(ref.trustPath ? { trustPath: absolutePath(ref.trustPath) } : {}),
  };
}

export function inventory(
  input: InventoryInput,
  dependencies: InventoryDependencies = {},
): ProjectInventory {
  const resolveEnrollment =
    dependencies.resolveProject ?? resolveStandardProject;
  const candidates = [
    ...input.registeredProjects.map((ref) =>
      createCandidate(ref, "registered"),
    ),
    ...input.explicitRoots.map((ref) => createCandidate(ref, "explicit")),
  ];
  const expandedCommonDirs = new Set<string>();
  const discoveryIssues = new Map<string, string[]>();
  const entriesByIdentity = new Map<string, InventoryEntry>();

  for (
    let candidateIndex = 0;
    candidateIndex < candidates.length;
    candidateIndex++
  ) {
    const candidate = candidates[candidateIndex];
    if (!candidate) continue;
    let canonicalInput: string;
    try {
      canonicalInput = (dependencies.realpath ?? realpathSync)(candidate.path);
      accessSync(canonicalInput, constants.R_OK | constants.X_OK);
      if (!statSync(canonicalInput).isDirectory())
        throw Object.assign(new Error("Project root is not a directory"), {
          code: "ENOTDIR",
        });
    } catch (error) {
      const code = codeOf(error);
      const classification: InventoryClassification =
        code === "ENOENT" || code === "ENOTDIR" ? "missing" : "inaccessible";
      const identity = candidate.path;
      const existing = entriesByIdentity.get(identity);
      if (existing) {
        existing.names.push(candidate.name);
        existing.aliases.push(candidate.path);
        existing.sources.push(candidate.source);
        if (candidate.trustPath) existing.trustPaths.push(candidate.trustPath);
        continue;
      }
      entriesByIdentity.set(identity, {
        canonicalRoot: null,
        name: candidate.name,
        names: [candidate.name],
        aliases: [candidate.path],
        sources: [candidate.source],
        trustPaths: candidate.trustPath ? [candidate.trustPath] : [],
        classification,
        git: null,
        resolution: null,
        enrollment: null,
        issues: [error instanceof Error ? error.message : String(error)],
      });
      continue;
    }

    let gitRoot: string;
    try {
      gitRoot = (dependencies.realpath ?? realpathSync)(
        command(canonicalInput, ["rev-parse", "--show-toplevel"]),
      );
    } catch (error) {
      const code = codeOf(error);
      const classification =
        code === "EACCES" || code === "EPERM" ? "inaccessible" : "nonGit";
      const identity = canonicalInput;
      const existing = entriesByIdentity.get(identity);
      if (existing) {
        existing.names.push(candidate.name);
        existing.aliases.push(candidate.path);
        existing.sources.push(candidate.source);
        if (candidate.trustPath) existing.trustPaths.push(candidate.trustPath);
        continue;
      }
      entriesByIdentity.set(identity, {
        canonicalRoot: canonicalInput,
        name: candidate.name,
        names: [candidate.name],
        aliases: [candidate.path],
        sources: [candidate.source],
        trustPaths: candidate.trustPath ? [candidate.trustPath] : [],
        classification,
        git: null,
        resolution: null,
        enrollment: null,
        issues: [error instanceof Error ? error.message : String(error)],
      });
      continue;
    }

    try {
      const commonDir = resolve(
        gitRoot,
        command(canonicalInput, ["rev-parse", "--git-common-dir"]),
      );
      if (!expandedCommonDirs.has(commonDir)) {
        expandedCommonDirs.add(commonDir);
        for (const worktreePath of listedWorktrees(gitRoot)) {
          let canonicalWorktree: string;
          try {
            canonicalWorktree = (dependencies.realpath ?? realpathSync)(
              worktreePath,
            );
          } catch {
            canonicalWorktree = resolve(worktreePath);
          }
          if (canonicalWorktree === gitRoot) continue;
          candidates.push({
            path: worktreePath,
            name: basename(worktreePath) || worktreePath,
            source: "worktree",
          });
        }
      }
    } catch (error) {
      discoveryIssues.set(gitRoot, [
        `Linked worktrees could not be enumerated: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }

    const existing = entriesByIdentity.get(gitRoot);
    if (existing) {
      existing.names.push(candidate.name);
      existing.aliases.push(candidate.path);
      existing.sources.push(candidate.source);
      if (candidate.trustPath) existing.trustPaths.push(candidate.trustPath);
      continue;
    }

    const enrollment = join(gitRoot, ".rill", "project.json");
    const disabled = join(gitRoot, ".rill", "project.disabled.json");
    let resolution: ProjectResolution | null = null;
    let enrollmentState: ProjectFileBaseline | null = null;
    let classification: InventoryClassification;
    const issues: string[] = [...(discoveryIssues.get(gitRoot) ?? [])];
    let activeStat: ReturnType<typeof lstatSync> | null = null;
    let disabledStat: ReturnType<typeof lstatSync> | null = null;
    try {
      try {
        activeStat = lstatSync(enrollment);
      } catch (error) {
        if (codeOf(error) !== "ENOENT" && codeOf(error) !== "ENOTDIR")
          throw error;
      }
      try {
        disabledStat = lstatSync(disabled);
      } catch (error) {
        if (codeOf(error) !== "ENOENT" && codeOf(error) !== "ENOTDIR")
          throw error;
      }
    } catch (error) {
      classification = "inaccessible";
      issues.push(error instanceof Error ? error.message : String(error));
      entriesByIdentity.set(gitRoot, {
        canonicalRoot: gitRoot,
        name: candidate.name,
        names: [candidate.name],
        aliases: [candidate.path],
        sources: [candidate.source],
        trustPaths: candidate.trustPath ? [candidate.trustPath] : [],
        classification,
        git: null,
        resolution: null,
        enrollment: null,
        issues,
      });
      continue;
    }
    if (disabledStat) {
      if (disabledStat.isFile() && !disabledStat.isSymbolicLink()) {
        if (activeStat) {
          classification = "invalid";
          issues.push("Both active and disabled enrollment markers exist");
        } else classification = "disabled";
      } else {
        classification = "invalid";
        issues.push("Disabled enrollment marker is not a regular file");
      }
    } else if (!activeStat) {
      classification = "unenrolled";
    } else if (!activeStat.isFile() || activeStat.isSymbolicLink()) {
      classification = "invalid";
      issues.push("Active enrollment marker is not a regular file");
    } else {
      try {
        enrollmentState = enrollmentBaseline(gitRoot);
        if (!enrollmentState) {
          classification = "invalid";
          issues.push(
            "Active enrollment marker could not be read as a regular file",
          );
        } else {
          resolution = resolveEnrollment(gitRoot, input.runtimeFacts);
          classification = classificationForResolution(resolution);
          if (resolution.issues.length) issues.push(...resolution.issues);
        }
        const current = enrollmentBaseline(gitRoot);
        if (
          current?.sha256 !== enrollmentState?.sha256 ||
          current?.mode !== enrollmentState?.mode
        ) {
          classification = "invalid";
          issues.push("Enrollment changed while inventory was being read");
        }
      } catch (error) {
        classification = "invalid";
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
    let git: InventoryGitFacts;
    try {
      git = readGitFacts(gitRoot);
    } catch (error) {
      git = {
        commonDir: "",
        gitDir: "",
        linkedWorktree: false,
        branch: null,
        revision: null,
        status: "",
        statusPaths: [],
        dirty: false,
      };
      classification = "inaccessible";
      issues.push(error instanceof Error ? error.message : String(error));
    }
    entriesByIdentity.set(gitRoot, {
      canonicalRoot: gitRoot,
      name: candidate.name,
      names: [candidate.name],
      aliases: [candidate.path],
      sources: [candidate.source],
      trustPaths: candidate.trustPath ? [candidate.trustPath] : [],
      classification,
      git,
      resolution,
      enrollment: enrollmentState,
      issues,
    });
  }

  const entries = [...entriesByIdentity.values()]
    .map((entry) => ({
      ...entry,
      names: [...new Set(entry.names)].sort(),
      aliases: [...new Set(entry.aliases)].sort(),
      sources: [...new Set(entry.sources)].sort(),
      trustPaths: [...new Set(entry.trustPaths)].sort(),
      name: [...new Set(entry.names)].sort()[0] ?? entry.name,
    }))
    .sort((a, b) =>
      (a.canonicalRoot ?? a.aliases[0] ?? "").localeCompare(
        b.canonicalRoot ?? b.aliases[0] ?? "",
      ),
    );
  const gaps = entries.flatMap((entry) =>
    coverageGap(entry)
      ? [
          {
            name: entry.name,
            path: entry.aliases[0] ?? "",
            classification: entry.classification,
            issue: entry.issues[0] ?? entry.classification,
          },
        ]
      : [],
  );
  return {
    entries,
    coverage: {
      inputCount: candidates.length,
      inspectedCount: entries.length,
      gapCount: gaps.length,
      gaps,
    },
  };
}
