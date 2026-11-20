import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import semver from "semver";
import { RillCommandError } from "./command-error.js";

export interface UpdateReceipt {
  status: "PLAN_ONLY" | "PREPARED_NOT_VERIFIED";
  path: string;
  sourceHead: string;
  fromVersion: string;
  toVersion: string;
  pendingReview: string[];
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
    throw new RillCommandError(
      `Native Git failed: ${result.error?.message ?? result.stderr?.trim() ?? "unknown error"}`,
      2,
    );
  }
  return result.stdout.trim();
}

function isPresent(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function regularFiles(path: string, base = path): string[] {
  if (lstatSync(path).isSymbolicLink()) {
    throw new RillCommandError(`Refusing symbolic link in Rill-managed plugin: ${path}`, 1);
  }
  if (lstatSync(path).isFile()) return [relative(base, path)];
  if (!lstatSync(path).isDirectory()) {
    throw new RillCommandError(`Refusing unsupported managed asset: ${path}`, 1);
  }
  const names: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const nested = join(path, entry.name);
    names.push(...regularFiles(nested, base));
  }
  return names.sort();
}

function pluginVersion(path: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(path, "plugin.json"), "utf8"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("version" in manifest) ||
    !("name" in manifest)
  ) {
    throw new RillCommandError("Rill Plugin manifest is missing name or version.", 1);
  }
  if (
    manifest.name !== "rill" ||
    typeof manifest.version !== "string" ||
    !semver.valid(manifest.version)
  ) {
    throw new RillCommandError("Rill Plugin manifest has an unsupported identity or SemVer.", 1);
  }
  return manifest.version;
}

function checkTrackedPlugin(repo: string): void {
  const result = spawnSync(
    "git",
    ["-C", repo, "ls-files", "--error-unmatch", "--", ".rill/plugin/plugin.json"],
    {
      encoding: "utf8",
      env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
    },
  );
  if (result.error || result.status !== 0) {
    throw new RillCommandError(
      "The installed Rill Plugin is not tracked by Git. Commit and verify its provenance before preparing an update.",
      1,
    );
  }
}

/**
 * Prepare a native Git review worktree. Never update the consumer's original
 * worktree or claim that native plugin cache / Hook trust has been upgraded.
 */
export function planUpdate(
  factoryRoot: string,
  rawTarget: string,
  version: string,
  prepare: boolean,
): UpdateReceipt {
  const target = resolve(rawTarget);
  if (
    !isPresent(target) ||
    lstatSync(target).isSymbolicLink() ||
    !lstatSync(target).isDirectory()
  ) {
    throw new RillCommandError("A real existing product Git root is required.", 1);
  }
  if (realpathSync(target) !== target || git(target, "rev-parse", "--show-toplevel") !== target) {
    throw new RillCommandError("Update must target the real root of an existing Git worktree.", 1);
  }
  if (git(target, "status", "--porcelain=v1", "--untracked-files=all")) {
    throw new RillCommandError(
      "Existing product changes must be preserved before update review.",
      1,
    );
  }
  const sourceHead = git(target, "rev-parse", "--verify", "HEAD");
  const consumerPlugin = join(target, ".rill/plugin");
  const sourcePlugin = join(factoryRoot, "plugin");
  if (!isPresent(consumerPlugin) || !isPresent(sourcePlugin)) {
    throw new RillCommandError("Both the installed and source Rill Plugins must exist.", 1);
  }
  const oldFiles = regularFiles(consumerPlugin);
  const newFiles = regularFiles(sourcePlugin);
  checkTrackedPlugin(target);
  const fromVersion = pluginVersion(consumerPlugin);
  const toVersion = pluginVersion(sourcePlugin);
  if (toVersion !== version) {
    throw new RillCommandError("Source Plugin and canonical VERSION differ.", 2);
  }
  const sourceHookConfig = join(factoryRoot, "templates/consumer/.codex/hooks.json");
  const projectCodexConfig = join(target, ".codex");
  const projectHookConfig = join(projectCodexConfig, "hooks.json");
  if (!isPresent(sourceHookConfig) || lstatSync(sourceHookConfig).isSymbolicLink()) {
    throw new RillCommandError("The source project Hook configuration is missing or unsafe.", 2);
  }
  if (
    isPresent(projectCodexConfig) &&
    (lstatSync(projectCodexConfig).isSymbolicLink() || !lstatSync(projectCodexConfig).isDirectory())
  ) {
    throw new RillCommandError("The consumer .codex path is not a real directory.", 1);
  }
  if (
    isPresent(projectHookConfig) &&
    (lstatSync(projectHookConfig).isSymbolicLink() || !lstatSync(projectHookConfig).isFile())
  ) {
    throw new RillCommandError("The consumer .codex/hooks.json path is not a regular file.", 1);
  }
  const needsHookIntegration = !isPresent(projectHookConfig);
  if (!semver.gt(toVersion, fromVersion) && !(toVersion === fromVersion && needsHookIntegration)) {
    throw new RillCommandError(
      "No newer source Plugin version is available, and the native Hook is already present; downgrade is not automatic.",
      1,
    );
  }

  const pendingReview = [
    ...new Set([
      ...newFiles.filter((path) => oldFiles.includes(path)),
      ...oldFiles.filter((path) => !newFiles.includes(path)),
    ]),
  ]
    .map((path) => `.rill/plugin/${path}`)
    .sort();
  if (needsHookIntegration) pendingReview.push(".codex/hooks.json");
  const receipt: UpdateReceipt = {
    status: "PLAN_ONLY",
    path: target,
    sourceHead,
    fromVersion,
    toVersion,
    pendingReview,
    nativeTrust: "REQUIRES_USER_APPROVAL",
  };
  if (!prepare) return receipt;

  const scratch = mkdtempSync(join(tmpdir(), "rill-update-"));
  const worktree = join(scratch, "review");
  const branch = `chatgpt/rill-update-${randomUUID()}`;
  let attached = false;
  try {
    git(target, "worktree", "add", "--quiet", "-b", branch, worktree, sourceHead);
    attached = true;
    for (const file of newFiles) {
      const from = join(sourcePlugin, file);
      const destination = join(worktree, ".rill/plugin", file);
      if (isPresent(destination) && !lstatSync(destination).isFile()) {
        throw new RillCommandError(`Managed asset type conflict: ${file}`, 1);
      }
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(from, destination);
    }
    if (needsHookIntegration) {
      const destination = join(worktree, ".codex/hooks.json");
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(sourceHookConfig, destination);
    }
    // Files not present upstream are intentionally retained for human review.
    // Do not stage, commit, merge or install; protected authorization is separate.
    return { ...receipt, status: "PREPARED_NOT_VERIFIED", branch, worktree };
  } catch (error) {
    if (attached) {
      git(target, "worktree", "remove", "--force", worktree);
      git(target, "branch", "-D", branch);
    }
    throw error;
  } finally {
    if (!attached || !isPresent(worktree)) rmSync(scratch, { recursive: true, force: true });
  }
}
