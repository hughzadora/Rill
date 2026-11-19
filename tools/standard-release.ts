import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { Ajv } from "ajv";
import releaseSchema from "../schemas/standard-release.schema.json" with {
  type: "json",
};

export interface StandardReleaseManifest {
  schemaVersion: 1;
  version: string;
  /** Full Git object ID identifying the source revision; it does not assert publisher trust. */
  sourceRevision: string;
  policyEntry: string;
  nativeEntries: { hooks: string[]; mcp: string[] };
  projectSchemaVersions: number[];
  runtimeVersions: string[];
  toolCapabilities: string[];
  rules: Array<{ id: string }>;
  files: Array<{ path: string; sha256: string }>;
}

export interface LoadedStandardRelease {
  artifactDirectory: string;
  manifestDigest: string;
  manifest: StandardReleaseManifest;
}

export class StandardReleaseError extends Error {
  readonly code: "missing" | "invalid" | "digest-mismatch";

  constructor(
    message: string,
    code: "missing" | "invalid" | "digest-mismatch",
  ) {
    super(message);
    this.name = "StandardReleaseError";
    this.code = code;
  }
}

const ajv = new Ajv({ allErrors: true });
export const validateStandardRelease =
  ajv.compile<StandardReleaseManifest>(releaseSchema);
const strictSemVer =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-((0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export function isStrictSemVer(value: string) {
  return strictSemVer.test(value);
}

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function regularFileWithoutSymlinks(root: string, path: string) {
  const resolvedRoot = realpathSync(root);
  const candidate = resolve(root, path);
  if (isAbsolute(path) || relative(root, candidate).startsWith(`..${sep}`))
    throw new StandardReleaseError(
      `Release path escapes artifact: ${path}`,
      "invalid",
    );
  const components = relative(root, candidate).split(sep);
  let current = root;
  for (const [index, component] of components.entries()) {
    current = resolve(current, component);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink())
      throw new StandardReleaseError(
        `Release path contains a symlink: ${path}`,
        "invalid",
      );
    if (index < components.length - 1 && !stat.isDirectory())
      throw new StandardReleaseError(
        `Release path parent is not a directory: ${path}`,
        "invalid",
      );
    if (index === components.length - 1 && !stat.isFile())
      throw new StandardReleaseError(
        `Release path is not a regular file: ${path}`,
        "invalid",
      );
  }
  const resolvedFile = realpathSync(candidate);
  const fromRoot = relative(resolvedRoot, resolvedFile);
  if (
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  )
    throw new StandardReleaseError(
      `Release path escapes artifact: ${path}`,
      "invalid",
    );
  return resolvedFile;
}

export function loadRelease(input: {
  version: string;
  digest: string;
  artifactRoot: string;
}): LoadedStandardRelease {
  if (!isStrictSemVer(input.version))
    throw new StandardReleaseError(
      "Invalid strict SemVer release version",
      "invalid",
    );
  if (!/^[a-f0-9]{64}$/.test(input.digest))
    throw new StandardReleaseError(
      "Invalid release manifest digest",
      "invalid",
    );

  const artifactDirectory = resolve(input.artifactRoot, input.version);
  try {
    const directoryStat = lstatSync(artifactDirectory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
      throw new StandardReleaseError(
        "Release artifact directory is invalid",
        "invalid",
      );
  } catch (error) {
    if (error instanceof StandardReleaseError) throw error;
    throw new StandardReleaseError(
      `Release artifact is missing: ${input.version}`,
      "missing",
    );
  }

  let manifestBytes: Buffer;
  try {
    const manifestPath = regularFileWithoutSymlinks(
      artifactDirectory,
      "manifest.json",
    );
    manifestBytes = readFileSync(manifestPath);
  } catch (error) {
    if (error instanceof StandardReleaseError) throw error;
    throw new StandardReleaseError(
      `Release manifest is missing: ${input.version}`,
      "missing",
    );
  }
  const manifestDigest = sha256(manifestBytes);
  if (manifestDigest !== input.digest)
    throw new StandardReleaseError(
      "Release manifest digest does not match pin",
      "digest-mismatch",
    );

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new StandardReleaseError(
      "Release manifest is not valid JSON",
      "invalid",
    );
  }
  if (!validateStandardRelease(parsed))
    throw new StandardReleaseError(
      `Invalid release manifest: ${ajv.errorsText(validateStandardRelease.errors)}`,
      "invalid",
    );
  if (parsed.version !== input.version)
    throw new StandardReleaseError(
      "Release manifest version does not match requested version",
      "invalid",
    );
  if (!parsed.projectSchemaVersions.includes(2))
    throw new StandardReleaseError(
      "Release does not support project enrollment schema 2",
      "invalid",
    );
  if (
    new Set(parsed.rules.map((rule) => rule.id)).size !== parsed.rules.length ||
    new Set(parsed.toolCapabilities).size !== parsed.toolCapabilities.length
  )
    throw new StandardReleaseError(
      "Release contains duplicate rule or tool capability IDs",
      "invalid",
    );
  const declaredPaths = new Set(parsed.files.map((file) => file.path));
  const entryPaths = [
    parsed.policyEntry,
    ...parsed.nativeEntries.hooks,
    ...parsed.nativeEntries.mcp,
  ];
  if (entryPaths.some((entryPath) => !declaredPaths.has(entryPath)))
    throw new StandardReleaseError(
      "Policy and native entry references must name declared release files",
      "invalid",
    );

  const filePaths = new Set<string>();
  for (const file of parsed.files) {
    if (
      file.path === "manifest.json" ||
      file.path.includes("\0") ||
      file.path.includes("\\") ||
      isAbsolute(file.path) ||
      file.path
        .split("/")
        .some((part) => part === "" || part === "." || part === "..") ||
      filePaths.has(file.path)
    )
      throw new StandardReleaseError(
        `Invalid or duplicate release file path: ${file.path}`,
        "invalid",
      );
    filePaths.add(file.path);
    let fileBytes: Buffer;
    try {
      fileBytes = readFileSync(
        regularFileWithoutSymlinks(artifactDirectory, file.path),
      );
    } catch (error) {
      if (error instanceof StandardReleaseError) throw error;
      throw new StandardReleaseError(
        `Release file is missing: ${file.path}`,
        "missing",
      );
    }
    if (sha256(fileBytes) !== file.sha256)
      throw new StandardReleaseError(
        `Release file digest mismatch: ${file.path}`,
        "digest-mismatch",
      );
  }

  return {
    artifactDirectory,
    manifestDigest,
    manifest: parsed,
  };
}
