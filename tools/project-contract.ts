import { isAbsolute, normalize } from "node:path";
import { Ajv } from "ajv";
import projectEnrollmentSchema from "../schemas/project-enrollment.schema.json" with {
  type: "json",
};
import { isStrictSemVer } from "./standard-release.ts";

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
