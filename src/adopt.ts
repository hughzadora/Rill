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
  nativePlugin: "REQUIRES_NATIVE_INSTALL";
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
  for (const path of ["templates", "templates/consumer", ".codex", ".codex/agents"]) {
    const directory = join(root, path);
    if (!existing(directory) || !lstatSync(directory).isDirectory()) {
      throw new RillCommandError("The Rill source has missing or unsafe project directories.", 2);
    }
  }
  const required = [
    "plugin.json",
    "templates/consumer/PRD.md",
    "templates/consumer/AGENTS.md",
    ".codex/config.toml",
    ".codex/agents/explorer.toml",
    ".codex/agents/worker.toml",
    ".codex/agents/reviewer.toml",
  ];
  const [manifestPath] = required;
  if (
    manifestPath === undefined ||
    required.some((path) => !existing(join(root, path)) || !lstatSync(join(root, path)).isFile())
  ) {
    throw new RillCommandError("The Rill distribution has missing or unsafe consumer assets.", 2);
  }
  const manifest: unknown = JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("version" in manifest) ||
    !("name" in manifest) ||
    manifest.name !== "rill" ||
    manifest.version !== version
  ) {
    throw new RillCommandError("The native Rill Plugin does not match canonical VERSION.", 2);
  }
}

function copyNew(source: string, destination: string): void {
  if (lstatSync(source).isSymbolicLink()) {
    throw new RillCommandError(`Refusing a symlink in Rill-managed assets: ${source}`, 2);
  }
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
      filter: (path) => {
        if (lstatSync(path).isSymbolicLink()) {
          throw new RillCommandError(`Refusing a symlink in Rill-managed assets: ${path}`, 2);
        }
        return true;
      },
    });
  } else {
    copyFileSync(source, destination);
  }
}

function populate(root: string, worktree: string, goal: string, preserved: string[]): void {
  const template = join(root, "templates/consumer");
  if (!preserved.includes("AGENTS.md")) {
    copyNew(join(template, "AGENTS.md"), join(worktree, "AGENTS.md"));
  }
  if (!preserved.includes("PRD.md")) {
    const prdTemplate = readFileSync(join(template, "PRD.md"), "utf8");
    const marker = "[Describe the user-facing product result.]";
    if (!prdTemplate.includes(marker)) {
      throw new RillCommandError("The canonical product PRD has no goal marker.", 2);
    }
    writeFileSync(
      join(worktree, "PRD.md"),
      prdTemplate.replace(marker, goal.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")),
      { flag: "wx" },
    );
  }
  if (!preserved.includes(".codex/config.toml")) {
    copyNew(join(root, ".codex/config.toml"), join(worktree, ".codex/config.toml"));
    const roles = ["explorer.toml", "worker.toml", "reviewer.toml"];
    for (const role of roles) {
      copyNew(join(root, ".codex/agents", role), join(worktree, ".codex/agents", role));
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

  const preserved: string[] = [];
  const pendingIntegration: string[] = [];
  for (const path of ["AGENTS.md", "PRD.md", ".codex/config.toml"]) {
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
    nativePlugin: "REQUIRES_NATIVE_INSTALL",
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
