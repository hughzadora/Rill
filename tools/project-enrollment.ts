import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type {
  ProjectStandardException,
  ProjectToolBinding,
} from "./project-contract.ts";

export {
  isSchema1Enrollment,
  migrateSchema1Enrollment,
  type ProjectEnrollmentV2,
  type ProjectStandardException,
  type ProjectToolBinding,
  type Schema1Enrollment,
  type Schema1MigrationChoices,
  validateProjectEnrollment,
} from "./project-contract.ts";

import { atomicJson } from "./atomic-files.ts";
import { setProjectPluginEnabled } from "./native-config.ts";
import {
  pendingRecords,
  projectContext,
  trustedPublisherIds,
} from "./task-context.ts";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function projectBindingDigest(bindings: ProjectToolBinding[]) {
  return digest(
    [...bindings].sort((a, b) =>
      a.capability < b.capability ? -1 : a.capability > b.capability ? 1 : 0,
    ),
  );
}

export function projectExceptionDigest(exceptions: ProjectStandardException[]) {
  return digest(
    [...exceptions].sort((a, b) =>
      a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0,
    ),
  );
}

function rootAt(cwd: string) {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  }).trim();
}
export async function enrollProject(
  cwd: string,
  repository: string,
  signal: AbortSignal,
) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new Error("Invalid repository identity");
  const root = rootAt(cwd),
    marker = join(root, ".rill/project.json"),
    authority = join(root, ".rill/authority.json");
  const existing = existsSync(marker) ? projectContext(root) : null;
  if (existing && existing.repository !== repository.toLowerCase())
    throw new Error("Existing repository enrollment conflicts");
  const principal: unknown = JSON.parse(
    execFileSync("gh", ["api", "--hostname", "github.com", "user"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  if (
    !principal ||
    typeof principal !== "object" ||
    !("id" in principal) ||
    typeof principal.id !== "number" ||
    !Number.isSafeInteger(principal.id) ||
    principal.id < 1
  )
    throw new Error("Cannot resolve GitHub publisher identity");
  if (
    existsSync(authority) &&
    !trustedPublisherIds({
      root,
      repository,
      recoveryRoot: "",
      schemaVersion: 1,
    }).includes(principal.id)
  )
    throw new Error(
      "Existing authorized publisher conflicts; owner decision required",
    );
  const config = await setProjectPluginEnabled(
    join(root, ".codex/config.toml"),
    true,
    signal,
  );
  if (!existsSync(authority))
    atomicJson(authority, { schemaVersion: 1, githubUserIds: [principal.id] });
  if (!existing) atomicJson(marker, { schemaVersion: 1, repository });
  return {
    root,
    repository,
    publisherId: principal.id,
    config,
    nativeTrust: "review_required_if_definition_changed",
    taskBinding: "use task-sync",
    existingTools: "preserved",
  };
}
export async function leaveProject(cwd: string, signal: AbortSignal) {
  const context = projectContext(cwd);
  if (
    existsSync(join(context.recoveryRoot, "active.json")) &&
    pendingRecords(context).length
  )
    throw new Error(
      "Publish and read back pending facts before exiting enrollment",
    );
  const marker = join(context.root, ".rill/project.json"),
    disabled = join(context.root, ".rill/project.disabled.json");
  if (
    existsSync(disabled) &&
    readFileSync(disabled, "utf8") !== readFileSync(marker, "utf8")
  )
    throw new Error(
      "Previous disabled enrollment conflicts; preserve both and reconcile",
    );
  const config = await setProjectPluginEnabled(
    join(context.root, ".codex/config.toml"),
    false,
    signal,
  );
  renameSync(marker, disabled);
  return {
    root: context.root,
    enrolled: false,
    config,
    recoveryCache: "retained",
    authority: "retained",
    behavior:
      "unenrolled hooks return without task processing; native plugin disable applies after reload where this project config layer is loaded",
    sharedPersonalPolicy: "retained",
  };
}
if (import.meta.main) {
  try {
    const [operation, repository] = process.argv.slice(2);
    const signal = AbortSignal.timeout(10_000);
    if (operation === "enroll" && repository)
      console.log(
        JSON.stringify(await enrollProject(process.cwd(), repository, signal)),
      );
    else if (operation === "leave")
      console.log(JSON.stringify(await leaveProject(process.cwd(), signal)));
    else
      throw new Error(
        "Usage: project-enrollment.ts enroll <owner/repository> | leave",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
