import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { RillCommandError } from "./command-error.js";

type EnrollmentStatus = "PLAN_ONLY" | "PREPARED_NOT_VERIFIED";

export interface AdoptionReceipt {
  status: EnrollmentStatus;
  sourceHead: string;
  path: string;
  version: string;
  preserved: string[];
  pendingIntegration: string[];
  nativeTrust: "REQUIRES_USER_APPROVAL";
  branch?: string;
  worktree?: string;
}

function git(repo: string, ...args: string[]): string {
  const result = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
  });
  if (result.error || result.status !== 0) {
    const message = result.error?.message ?? result.stderr?.trim() ?? "unknown Git failure";
    throw new RillCommandError(`Native Git failed: ${message}`, 2);
  }
  return result.stdout.trim();
}

function existing(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function rejectSymlinkAncestors(target: string, paths: string[]): void {
  for (const path of paths) {
    const absolute = join(target, path);
    if (existing(absolute) && lstatSync(absolute).isSymbolicLink()) {
      throw new RillCommandError(`Refusing product-owned symbolic link: ${path}`, 1);
    }
  }
}

function checkSource(root: string, version: string): void {
  const required = [
    "bundle/plugin/plugin.json",
    "bundle/repo-common/PRD.md",
    "bundle/repo-common/AGENTS.md",
    "bundle/repo-common/.agents/plugins/marketplace.json",
    "bundle/repo-common/.codex/config.toml",
  ];
  const [manifestPath] = required;
  if (manifestPath === undefined || required.some((path) => !existsSync(join(root, path)))) {
    throw new RillCommandError("The Rill distribution is missing maintained consumer assets.", 2);
  }
  const manifest: unknown = JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("version" in manifest) ||
    manifest.version !== version
  ) {
    throw new RillCommandError("The Rill bundle does not match the canonical VERSION.", 2);
  }
}

function copyNew(source: string, destination: string): void {
  if (existing(destination)) {
    throw new RillCommandError(`Managed target path already exists: ${destination}`, 1);
  }
  mkdirSync(dirname(destination), { recursive: true });
  if (lstatSync(source).isDirectory()) {
    cpSync(source, destination, {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
    });
  } else {
    copyFileSync(source, destination);
  }
}

function populate(root: string, worktree: string, goal: string, preserved: string[]): void {
  const bundle = join(root, "bundle");
  copyNew(join(bundle, "plugin"), join(worktree, ".rill/plugin"));
  if (!preserved.includes(".agents/plugins/marketplace.json")) {
    copyNew(
      join(bundle, "repo-common/.agents/plugins/marketplace.json"),
      join(worktree, ".agents/plugins/marketplace.json"),
    );
  }
  if (!preserved.includes("AGENTS.md")) {
    copyNew(join(bundle, "repo-common/AGENTS.md"), join(worktree, "AGENTS.md"));
  }
  if (!preserved.includes("PRD.md")) {
    const template = readFileSync(join(bundle, "repo-common/PRD.md"), "utf8");
    const marker = "[Describe the user-facing product result.]";
    if (!template.includes(marker)) {
      throw new RillCommandError("The canonical product PRD has no goal marker.", 2);
    }
    writeFileSync(
      join(worktree, "PRD.md"),
      template.replace(marker, goal.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")),
      { flag: "wx" },
    );
  }
  if (!preserved.includes(".codex/config.toml")) {
    copyNew(join(bundle, "repo-common/.codex/config.toml"), join(worktree, ".codex/config.toml"));
    const roles = ["explorer.toml", "worker.toml", "reviewer.toml"];
    for (const role of roles) {
      copyNew(
        join(bundle, "repo-common/.codex/agents", role),
        join(worktree, ".codex/agents", role),
      );
    }
  }
}

/** Prepare reviewed native Git changes; never mutate the existing consumer worktree. */
export function adoptProject(
  root: string,
  rawTarget: string,
  version: string,
  goal: string | undefined,
  apply: boolean,
): AdoptionReceipt {
  const target = resolve(rawTarget);
  if (!existing(target) || lstatSync(target).isSymbolicLink() || !lstatSync(target).isDirectory()) {
    throw new RillCommandError("A real existing product Git directory is required.", 1);
  }
  if (git(target, "rev-parse", "--show-toplevel") !== realpathSync(target)) {
    throw new RillCommandError(
      "The adoption path must be the root of its existing Git worktree.",
      1,
    );
  }
  const changed = git(target, "status", "--porcelain=v1", "--untracked-files=all");
  if (changed) {
    throw new RillCommandError(
      "Product worktree is not clean; preserve unrelated work before adoption.",
      1,
    );
  }
  const sourceHead = git(target, "rev-parse", "--verify", "HEAD");
  checkSource(root, version);

  const guarded = [
    ".rill",
    ".rill/plugin",
    ".agents",
    ".agents/plugins",
    ".agents/plugins/marketplace.json",
    "AGENTS.md",
    "PRD.md",
    ".codex",
    ".codex/agents",
    ".codex/config.toml",
    ".codex/agents/explorer.toml",
    ".codex/agents/worker.toml",
    ".codex/agents/reviewer.toml",
  ];
  rejectSymlinkAncestors(target, guarded);
  if (existing(join(target, ".rill/plugin"))) {
    throw new RillCommandError(
      "Existing .rill/plugin is consumer-owned or managed by another version. Refusing overwrite.",
      1,
    );
  }

  const preserved: string[] = [];
  const pendingIntegration: string[] = [];
  for (const path of [
    "AGENTS.md",
    "PRD.md",
    ".codex/config.toml",
    ".agents/plugins/marketplace.json",
  ]) {
    if (existing(join(target, path))) {
      preserved.push(path);
      // These native files cannot be silently combined with Rill's routing/trust configuration.
      pendingIntegration.push(path);
    }
  }
  for (const path of [
    ".codex/agents/explorer.toml",
    ".codex/agents/worker.toml",
    ".codex/agents/reviewer.toml",
  ]) {
    if (existing(join(target, path)) && !pendingIntegration.includes(".codex/config.toml")) {
      preserved.push(".codex/config.toml");
      pendingIntegration.push(".codex/config.toml");
    }
  }
  if (!preserved.includes("PRD.md") && !goal?.trim()) {
    throw new RillCommandError(
      "An explicit product goal is required when the existing repository has no PRD.md.",
      2,
      "USAGE",
    );
  }

  const receipt: AdoptionReceipt = {
    status: "PLAN_ONLY",
    sourceHead,
    path: target,
    version,
    preserved,
    pendingIntegration,
    nativeTrust: "REQUIRES_USER_APPROVAL",
  };
  if (!apply) return receipt;

  // Only a new ephemeral Git worktree and a new branch are created.
  // Original source, branch, worktree, CI and uncommitted files remain untouched.
  const scratch = mkdtempSync(join(tmpdir(), "rill-adopt-"));
  const worktree = join(scratch, "review");
  const branch = `chatgpt/rill-adopt-${randomUUID()}`;
  let attached = false;
  try {
    git(target, "worktree", "add", "--quiet", "-b", branch, worktree, sourceHead);
    attached = true;
    populate(root, worktree, goal ?? "", preserved);
    return { ...receipt, status: "PREPARED_NOT_VERIFIED", branch, worktree };
  } catch (error) {
    if (attached) {
      // Remove only the just-created isolated worktree, via native Git.
      git(target, "worktree", "remove", "--force", worktree);
      git(target, "branch", "-D", branch);
    }
    throw error;
  } finally {
    if (!attached || !existing(worktree)) {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
}
