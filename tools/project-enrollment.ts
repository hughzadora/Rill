import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { Ajv } from "ajv";
import projectEnrollmentSchema from "../schemas/project-enrollment.schema.json" with {
  type: "json",
};
import { setProjectPluginEnabled } from "./native-config.ts";
import { isStrictSemVer } from "./standard-release.ts";
import {
  atomicJson,
  pendingRecords,
  projectContext,
  trustedPublisherIds,
} from "./task-context.ts";

export interface ProjectToolBinding {
  capability: string;
  argv: string[];
  cwd: string;
  version: string | null;
  inapplicability: string | null;
}

export interface ProjectStandardException {
  ruleId: string;
  disposition: "replace" | "inapplicable";
  replacement?: string;
  reason: string;
  source: string;
  reviewTrigger: string;
}

export interface ProjectEnrollmentV2 {
  schemaVersion: 2;
  repository: string;
  standard: { version: string; digest: string };
  tools: ProjectToolBinding[];
  exceptions: ProjectStandardException[];
}

export interface Schema1Enrollment {
  schemaVersion: 1;
  repository: string;
}

export interface Schema1MigrationChoices {
  standard: ProjectEnrollmentV2["standard"];
  tools: ProjectToolBinding[];
  exceptions: ProjectStandardException[];
}

const enrollmentAjv = new Ajv({ allErrors: true });
const validateProjectEnrollmentSchema =
  enrollmentAjv.compile<ProjectEnrollmentV2>(projectEnrollmentSchema);
const validateSchema1Enrollment = enrollmentAjv.compile<Schema1Enrollment>({
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "repository"],
  properties: {
    schemaVersion: { const: 1 },
    repository: {
      type: "string",
      pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$",
    },
  },
});

function validToolPaths(enrollment: ProjectEnrollmentV2) {
  return enrollment.tools.every((tool) => {
    if (
      tool.cwd.includes("\\") ||
      tool.cwd.includes("\0") ||
      isAbsolute(tool.cwd) ||
      (tool.cwd !== "." &&
        (tool.cwd
          .split("/")
          .some((part) => part === "" || part === "." || part === "..") ||
          normalize(tool.cwd) !== tool.cwd))
    )
      return false;
    if (tool.argv.some((arg) => arg.includes("\0"))) return false;
    return tool.version === null
      ? tool.argv.length === 0 && Boolean(tool.inapplicability)
      : tool.argv.length > 0 && tool.inapplicability === null;
  });
}

export function validateProjectEnrollment(
  value: unknown,
): value is ProjectEnrollmentV2 {
  return (
    validateProjectEnrollmentSchema(value) &&
    validToolPaths(value as ProjectEnrollmentV2)
  );
}

export function isSchema1Enrollment(
  value: unknown,
): value is Schema1Enrollment {
  return validateSchema1Enrollment(value);
}

export function migrateSchema1Enrollment(
  value: unknown,
  choices: Schema1MigrationChoices,
): ProjectEnrollmentV2 {
  if (!isSchema1Enrollment(value))
    throw new Error("Explicit migration requires a valid schema-1 enrollment");
  if (
    !choices ||
    typeof choices !== "object" ||
    !choices.standard ||
    typeof choices.standard.version !== "string" ||
    !isStrictSemVer(choices.standard.version)
  )
    throw new Error(
      "Migration requires an exact strict SemVer standard version",
    );
  if (!Array.isArray(choices.tools) || !Array.isArray(choices.exceptions))
    throw new Error("Migration requires explicit tool bindings and exceptions");
  const migrated: ProjectEnrollmentV2 = {
    schemaVersion: 2,
    repository: value.repository,
    standard: { ...choices.standard },
    tools: choices.tools.map((tool) => ({ ...tool, argv: [...tool.argv] })),
    exceptions: choices.exceptions.map((exception) => ({ ...exception })),
  };
  if (!validateProjectEnrollmentSchema(migrated))
    throw new Error(
      `Migration choices are invalid: ${enrollmentAjv.errorsText(validateProjectEnrollmentSchema.errors)}`,
    );
  if (!validToolPaths(migrated))
    throw new Error(
      "Migration choices contain an invalid relative path or argv",
    );
  return migrated;
}

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
    !trustedPublisherIds({ root, repository, recoveryRoot: "" }).includes(
      principal.id,
    )
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
