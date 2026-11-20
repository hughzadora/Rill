import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { RillCommandError } from "./command-error.js";

export interface InitReceipt {
  status: "CREATED_NOT_VERIFIED";
  version: string;
  path: string;
  nativePlugin: "REQUIRES_NATIVE_INSTALL";
  nativeTrust: "REQUIRES_USER_APPROVAL";
}

const GOAL_PLACEHOLDER = "[Describe the user-facing product result.]";
const ROLE_NAMES = ["explorer.toml", "worker.toml", "reviewer.toml"] as const;

function requireAbsent(target: string): void {
  try {
    lstatSync(target);
    throw new RillCommandError(
      "Target already exists. Use the separate brownfield enrollment workflow.",
      1,
    );
  } catch (error) {
    if (error instanceof RillCommandError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function copyAssets(source: string, target: string): void {
  cpSync(source, target, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
    filter: (path) => {
      if (lstatSync(path).isSymbolicLink()) {
        throw new RillCommandError("The Rill source contains an unsupported symbolic link.", 2);
      }
      return true;
    },
  });
}

function requireSources(root: string, version: string): void {
  for (const path of ["templates", "templates/consumer", ".codex", ".codex/agents"]) {
    const directory = join(root, path);
    if (!existsSync(directory) || !lstatSync(directory).isDirectory()) {
      throw new RillCommandError("The Rill source has missing or unsafe project directories.", 2);
    }
  }
  const paths = [
    "plugin.json",
    "templates/consumer/PRD.md",
    "templates/consumer/AGENTS.md",
    ".codex/config.toml",
    ...ROLE_NAMES.map((name) => join(".codex/agents", name)),
  ];
  for (const path of paths) {
    const source = join(root, path);
    if (!existsSync(source) || !lstatSync(source).isFile()) {
      throw new RillCommandError("The Rill source is missing or has unsafe project assets.", 2);
    }
  }
  const manifest: unknown = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("name" in manifest) ||
    manifest.name !== "rill" ||
    !("version" in manifest) ||
    manifest.version !== version
  ) {
    throw new RillCommandError("Rill's native Plugin manifest differs from canonical VERSION.", 2);
  }
}

export function initializeProject(
  root: string,
  path: string,
  goal: string,
  version: string,
): InitReceipt {
  const destination = resolve(path);
  const normalizedGoal = goal.replace(/\s+/g, " ").trim();
  if (!normalizedGoal) {
    throw new RillCommandError("A product goal is required for non-interactive initialization.", 2);
  }
  requireAbsent(destination);
  const parent = dirname(destination);
  if (!existsSync(parent) || !lstatSync(parent).isDirectory()) {
    throw new RillCommandError("The destination parent directory must already exist.", 2);
  }
  requireSources(root, version);

  const stagingParent = mkdtempSync(join(parent, ".rill-init-"));
  const staging = join(stagingParent, "project");
  try {
    copyAssets(join(root, "templates/consumer"), staging);
    const spec = readFileSync(join(staging, "PRD.md"), "utf8");
    if (!spec.includes(GOAL_PLACEHOLDER)) {
      throw new RillCommandError("The PRD template has no expected product-goal placeholder.", 2);
    }
    writeFileSync(
      join(staging, "PRD.md"),
      spec.replace(GOAL_PLACEHOLDER, normalizedGoal.replace(/</g, "&lt;").replace(/>/g, "&gt;")),
    );
    mkdirSync(join(staging, ".codex/agents"), { recursive: true });
    copyAssets(join(root, ".codex/config.toml"), join(staging, ".codex/config.toml"));
    for (const name of ROLE_NAMES) {
      copyAssets(join(root, ".codex/agents", name), join(staging, ".codex/agents", name));
    }

    const result = spawnSync("git", ["init", "--quiet", "--initial-branch=main", staging], {
      encoding: "utf8",
      env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
    });
    if (result.error || result.status !== 0) {
      throw new RillCommandError(
        `Native Git initialization failed: ${result.error?.message ?? result.stderr?.trim() ?? "unknown error"}`,
        2,
      );
    }
    requireAbsent(destination);
    renameSync(staging, destination);
    return {
      status: "CREATED_NOT_VERIFIED",
      version,
      path: destination,
      nativePlugin: "REQUIRES_NATIVE_INSTALL",
      nativeTrust: "REQUIRES_USER_APPROVAL",
    };
  } finally {
    rmSync(stagingParent, { recursive: true, force: true });
  }
}
