import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  isSchema1Enrollment,
  type ProjectEnrollmentV2,
  type ProjectStandardException,
  type ProjectToolBinding,
  projectBindingDigest,
  projectExceptionDigest,
  validateProjectEnrollment,
} from "./project-enrollment.ts";
import {
  isStrictSemVer,
  type LoadedStandardRelease,
  loadRelease,
  StandardReleaseError,
} from "./standard-release.ts";

export interface RuntimeFacts {
  runtimeVersion: string;
  compatibleStandards: Readonly<Record<string, string>>;
  /** Versioned artifact store containing `<version>/manifest.json`. */
  artifactRoot: string;
}

export type ProjectResolutionStatus =
  | "ready"
  | "legacy"
  | "unenrolled"
  | "unsupported"
  | "invalid";

export interface ProjectIdentity {
  root: string;
  repository: string;
  schemaVersion: 1 | 2;
}

export interface ProjectResolution {
  status: ProjectResolutionStatus;
  project: ProjectIdentity | null;
  release: LoadedStandardRelease | null;
  issues: string[];
  bindings: ProjectToolBinding[];
  exceptions: ProjectStandardException[];
  bindingDigest: string;
  exceptionDigest: string;
}

function emptyResolution(
  status: ProjectResolutionStatus,
  project: ProjectIdentity | null,
  issues: string[] = [],
): ProjectResolution {
  return {
    status,
    project,
    release: null,
    issues,
    bindings: [],
    exceptions: [],
    bindingDigest: projectBindingDigest([]),
    exceptionDigest: projectExceptionDigest([]),
  };
}

export function validateEnrollmentAgainstRelease(
  enrollment: ProjectEnrollmentV2,
  release: LoadedStandardRelease,
): string[] {
  const issues: string[] = [];
  const manifest = release.manifest;
  if (!manifest.projectSchemaVersions.includes(enrollment.schemaVersion))
    issues.push(
      `Standard ${manifest.version} does not support project schema ${enrollment.schemaVersion}`,
    );
  if (enrollment.standard.version !== manifest.version)
    issues.push("Project standard version does not match the loaded release");
  if (enrollment.standard.digest !== release.manifestDigest)
    issues.push("Project standard digest does not match the loaded release");

  const capabilitySet = new Set(manifest.toolCapabilities);
  const bindingIds = enrollment.tools.map((binding) => binding.capability);
  if (new Set(bindingIds).size !== bindingIds.length)
    issues.push("Project has duplicate tool capability bindings");
  if (bindingIds.some((id) => !capabilitySet.has(id)))
    issues.push(
      "Project binds a tool capability unknown to its pinned standard",
    );
  if (
    capabilitySet.size !== bindingIds.length ||
    [...capabilitySet].some((id) => !bindingIds.includes(id))
  )
    issues.push(
      "Project must bind or mark inapplicable every standard tool capability",
    );

  const ruleSet = new Set(manifest.rules.map((rule) => rule.id));
  const exceptionIds = enrollment.exceptions.map(
    (exception) => exception.ruleId,
  );
  if (new Set(exceptionIds).size !== exceptionIds.length)
    issues.push("Project has duplicate standard rule exceptions");
  for (const exception of enrollment.exceptions) {
    if (!ruleSet.has(exception.ruleId))
      issues.push(
        `Project exception names unknown standard rule ${exception.ruleId}`,
      );
    if (
      exception.disposition === "replace" &&
      !capabilitySet.has(exception.replacement ?? "")
    )
      issues.push(
        `Replacement capability is unknown for rule ${exception.ruleId}`,
      );
  }
  return issues;
}

export function resolveProject(
  root: string,
  runtimeFacts: RuntimeFacts,
): ProjectResolution {
  if (
    !isStrictSemVer(runtimeFacts.runtimeVersion) ||
    Object.entries(runtimeFacts.compatibleStandards).some(
      ([version, digest]) =>
        !isStrictSemVer(version) || !/^[a-f0-9]{64}$/.test(digest),
    )
  )
    return emptyResolution("invalid", null, [
      "Runtime compatibility facts are invalid",
    ]);
  let projectRoot: string;
  try {
    projectRoot = realpathSync(resolve(root));
  } catch {
    return emptyResolution("invalid", null, [
      "Project root is missing or inaccessible",
    ]);
  }
  const marker = join(projectRoot, ".rill/project.json");
  let markerStat: ReturnType<typeof lstatSync>;
  try {
    markerStat = lstatSync(marker);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return emptyResolution("unenrolled", null);
    return emptyResolution("invalid", null, [
      "Project enrollment is inaccessible",
    ]);
  }
  if (!markerStat.isFile() || markerStat.isSymbolicLink())
    return emptyResolution("invalid", null, [
      "Project enrollment must be a regular file",
    ]);

  let enrollment: unknown;
  try {
    enrollment = JSON.parse(readFileSync(marker, "utf8"));
  } catch {
    return emptyResolution("invalid", null, [
      "Project enrollment is not valid JSON",
    ]);
  }
  if (isSchema1Enrollment(enrollment)) {
    return emptyResolution(
      "legacy",
      {
        root: projectRoot,
        repository: enrollment.repository.toLowerCase(),
        schemaVersion: 1,
      },
      ["Schema-1 enrollment requires an explicit standard migration"],
    );
  }
  if (!validateProjectEnrollment(enrollment))
    return emptyResolution("invalid", null, [
      "Project enrollment does not satisfy schema 2",
    ]);

  const project: ProjectIdentity = {
    root: projectRoot,
    repository: enrollment.repository.toLowerCase(),
    schemaVersion: 2,
  };
  const pin = enrollment.standard;
  const runtimeDigest = runtimeFacts.compatibleStandards[pin.version];
  if (!runtimeDigest)
    return emptyResolution("unsupported", project, [
      `Runtime does not support standard ${pin.version}`,
    ]);
  if (runtimeDigest !== pin.digest)
    return emptyResolution("unsupported", project, [
      `Runtime compatibility digest differs for standard ${pin.version}`,
    ]);

  let release: LoadedStandardRelease;
  try {
    release = loadRelease({
      version: pin.version,
      digest: pin.digest,
      artifactRoot: runtimeFacts.artifactRoot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      error instanceof StandardReleaseError && error.code === "missing"
        ? "unsupported"
        : "invalid";
    return emptyResolution(status, project, [message]);
  }
  if (!release.manifest.runtimeVersions.includes(runtimeFacts.runtimeVersion))
    return emptyResolution("unsupported", project, [
      `Standard ${pin.version} does not support runtime ${runtimeFacts.runtimeVersion}`,
    ]);

  const issues = validateEnrollmentAgainstRelease(enrollment, release);
  if (issues.length) return emptyResolution("invalid", project, issues);

  return {
    status: "ready",
    project,
    release,
    issues: [],
    bindings: enrollment.tools,
    exceptions: enrollment.exceptions,
    bindingDigest: projectBindingDigest(enrollment.tools),
    exceptionDigest: projectExceptionDigest(enrollment.exceptions),
  };
}
