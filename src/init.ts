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
  nativeTrust: "REQUIRES_USER_APPROVAL";
}

const GOAL_PLACEHOLDER = "[Describe the user-facing product result.]";

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
        throw new RillCommandError("The factory bundle contains an unsupported symbolic link.", 2);
      }
      return true;
    },
  });
}

export function initializeProject(
  root: string,
  path: string,
  goal: string,
  version: string,
): InitReceipt {
  const destination = resolve(path);
  const normalizedGoal = goal.replace(/\s+/g, " ").trim();
  if (!normalizedGoal)
    throw new RillCommandError("A product goal is required for non-interactive initialization.", 2);
  requireAbsent(destination);
  const parent = dirname(destination);
  if (!existsSync(parent) || !lstatSync(parent).isDirectory()) {
    throw new RillCommandError("The destination parent directory must already exist.", 2);
  }
  const template = join(root, "templates/consumer");
  const plugin = join(root, "plugin");
  if (![template, plugin].every(existsSync)) {
    throw new RillCommandError("The installed Rill distribution is missing versioned assets.", 2);
  }
  const stagingParent = mkdtempSync(join(parent, ".rill-init-"));
  const staging = join(stagingParent, "project");
  try {
    copyAssets(template, staging);
    const spec = readFileSync(join(staging, "PRD.md"), "utf8");
    if (!spec.includes(GOAL_PLACEHOLDER)) {
      throw new RillCommandError("The PRD template has no expected product-goal placeholder.", 2);
    }
    writeFileSync(
      join(staging, "PRD.md"),
      spec.replace(GOAL_PLACEHOLDER, normalizedGoal.replace(/</g, "&lt;").replace(/>/g, "&gt;")),
    );

    mkdirSync(join(staging, ".rill"), { recursive: true });
    copyAssets(plugin, join(staging, ".rill/plugin"));
    const pluginManifest = JSON.parse(
      readFileSync(join(staging, ".rill/plugin/plugin.json"), "utf8"),
    ) as {
      version?: string;
    };
    if (pluginManifest.version !== version) {
      throw new RillCommandError("The bundled plugin version does not match canonical VERSION.", 2);
    }
    const marketplace = JSON.parse(
      readFileSync(join(staging, ".agents/plugins/marketplace.json"), "utf8"),
    ) as { name?: string; plugins?: Array<{ source?: { path?: string } }> };
    if (
      marketplace.name !== "rill-consumer" ||
      marketplace.plugins?.length !== 1 ||
      marketplace.plugins[0]?.source?.path !== "./.rill/plugin"
    ) {
      throw new RillCommandError("The consumer Marketplace template is invalid.", 2);
    }
    const result = spawnSync("git", ["init", "--quiet", "--initial-branch=main", staging], {
      encoding: "utf8",
      env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
    });
    if (result.error) {
      throw new RillCommandError(`Native Git unavailable: ${result.error.message}`, 2);
    }
    if (result.status !== 0) {
      throw new RillCommandError(
        `Native Git initialization failed: ${result.stderr?.trim() ?? "unknown error"}`,
        2,
      );
    }
    requireAbsent(destination);
    renameSync(staging, destination);
    return {
      status: "CREATED_NOT_VERIFIED",
      version,
      path: destination,
      nativeTrust: "REQUIRES_USER_APPROVAL",
    };
  } finally {
    rmSync(stagingParent, { recursive: true, force: true });
  }
}
