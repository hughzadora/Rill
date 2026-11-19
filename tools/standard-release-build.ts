import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { atomicText } from "./atomic-files.ts";
import {
  isStrictSemVer,
  type LoadedStandardRelease,
  loadRelease,
  validateStandardRelease,
} from "./standard-release.ts";

const fixedSources = [
  {
    source: "skills/rill-preferences/references/personal-policy.md",
    path: "policy/personal-policy.md",
  },
  {
    source: "skills/rill-preferences/references/shared-entry.md",
    path: "policy/shared-entry.md",
  },
  { source: ".codex/agents/default.toml", path: "roles/default.toml" },
  { source: ".codex/agents/explorer.toml", path: "roles/explorer.toml" },
  { source: ".codex/agents/reviewer.toml", path: "roles/reviewer.toml" },
  {
    source: ".codex/agents/risk-reviewer.toml",
    path: "roles/risk-reviewer.toml",
  },
  { source: ".codex/agents/worker.toml", path: "roles/worker.toml" },
  { source: "hooks/hooks.json", path: "hooks/hooks.json" },
  { source: ".mcp.json", path: ".mcp.json" },
] as const;

const ruleIds = [
  "rill.owner-approval",
  "rill.workflow-reuse",
  "rill.recovery-preservation",
  "rill.risk-based-checks",
];

const toolCapabilities = ["check.lint", "check.targeted", "check.full-spec-ci"];

export interface BuildStandardReleaseOptions {
  version: string;
  sourceRoot: string;
  artifactRoot: string;
  sourceRevision?: string;
  runtimeVersions: string[];
}

export interface BuiltStandardRelease {
  created: boolean;
  sourceRevision: string;
  sourceTreeState: "clean" | "dirty";
  release: LoadedStandardRelease;
}

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function gitOutput(sourceRoot: string, args: string[]) {
  return execFileSync("git", args, {
    cwd: sourceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sourceIdentity(sourceRoot: string, requested?: string) {
  const revision = gitOutput(sourceRoot, ["rev-parse", "--verify", "HEAD"]);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision))
    throw new Error("Git did not return a full source revision identity");
  if (requested !== undefined && requested !== revision)
    throw new Error("Requested source revision does not match sourceRoot HEAD");
  const status = gitOutput(sourceRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  return {
    revision,
    status,
    treeState: status ? ("dirty" as const) : ("clean" as const),
  };
}

function readFixedSource(sourceRoot: string, sourcePath: string) {
  if (isAbsolute(sourcePath) || sourcePath.split("/").includes(".."))
    throw new Error(`Invalid fixed standard source path: ${sourcePath}`);
  const path = resolve(sourceRoot, sourcePath);
  const relativePath = relative(sourceRoot, path);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  )
    throw new Error(`Standard source escapes checkout: ${sourcePath}`);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`Standard source must be a regular file: ${sourcePath}`);
  const realPath = realpathSync(path);
  const realRelativePath = relative(sourceRoot, realPath);
  if (
    realRelativePath === ".." ||
    realRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(realRelativePath)
  )
    throw new Error(`Standard source escapes checkout: ${sourcePath}`);
  return readFileSync(realPath);
}

function missingPath(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function assertSourceUnchanged(
  sourceRoot: string,
  initial: ReturnType<typeof sourceIdentity>,
  initialFiles: Array<{ sourcePath: string; sha256: string }>,
) {
  const current = sourceIdentity(sourceRoot);
  const changedFiles: string[] = [];
  for (const file of initialFiles) {
    if (sha256(readFixedSource(sourceRoot, file.sourcePath)) !== file.sha256)
      changedFiles.push(file.sourcePath);
  }
  const changes: string[] = [];
  if (current.revision !== initial.revision) changes.push("Git HEAD");
  if (current.status !== initial.status) changes.push("Git status");
  if (changedFiles.length)
    changes.push(`fixed files: ${changedFiles.join(", ")}`);
  if (changes.length)
    throw new Error(
      `Source changed during standard build: ${changes.join("; ")} changed after the source scan`,
    );
  return current;
}

function existingRelease(
  destination: string,
  options: BuildStandardReleaseOptions,
  digest: string,
  sourceRoot: string,
  source: ReturnType<typeof sourceIdentity>,
  files: Array<{ sourcePath: string; sha256: string }>,
): BuiltStandardRelease | undefined {
  try {
    const stat = lstatSync(destination);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Existing release path is not a regular directory");
  } catch (error) {
    if (missingPath(error)) return undefined;
    throw error;
  }
  try {
    const release = loadRelease({
      version: options.version,
      digest,
      artifactRoot: options.artifactRoot,
    });
    const verifiedSource = assertSourceUnchanged(sourceRoot, source, files);
    return {
      created: false,
      sourceRevision: verifiedSource.revision,
      sourceTreeState: verifiedSource.treeState,
      release,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Refusing to overwrite existing release ${options.version}: ${message}`,
      { cause: error },
    );
  }
}

export function buildStandardRelease(
  options: BuildStandardReleaseOptions,
): BuiltStandardRelease {
  if (!isStrictSemVer(options.version))
    throw new Error("Release version must be strict SemVer");
  if (
    options.runtimeVersions.length === 0 ||
    options.runtimeVersions.some((version) => !isStrictSemVer(version)) ||
    new Set(options.runtimeVersions).size !== options.runtimeVersions.length
  )
    throw new Error(
      "Runtime compatibility must contain unique strict SemVer versions",
    );

  const sourceRoot = realpathSync(resolve(options.sourceRoot));
  const source = sourceIdentity(sourceRoot, options.sourceRevision);
  const files = fixedSources
    .map(({ source: sourcePath, path }) => {
      const bytes = readFixedSource(sourceRoot, sourcePath);
      return { sourcePath, path, bytes, sha256: sha256(bytes) };
    })
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  const manifest = {
    schemaVersion: 1 as const,
    version: options.version,
    sourceRevision: source.revision,
    policyEntry: "policy/shared-entry.md",
    nativeEntries: { hooks: ["hooks/hooks.json"], mcp: [".mcp.json"] },
    projectSchemaVersions: [2],
    runtimeVersions: [...options.runtimeVersions].sort(),
    toolCapabilities,
    rules: ruleIds.map((id) => ({ id })),
    files: files.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
  };
  if (!validateStandardRelease(manifest))
    throw new Error(
      "Release definition is invalid: standard manifest schema mismatch",
    );
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestDigest = sha256(manifestBytes);
  const artifactRoot = resolve(options.artifactRoot);
  const destination = join(artifactRoot, options.version);
  mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
  const existing = existingRelease(
    destination,
    options,
    manifestDigest,
    sourceRoot,
    source,
    files,
  );
  if (existing) return existing;

  const stageStore = mkdtempSync(join(artifactRoot, ".rill-standard-stage-"));
  const stageDirectory = join(stageStore, options.version);
  try {
    for (const file of files) {
      const path = join(stageDirectory, file.path);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      atomicText(path, file.bytes.toString("utf8"));
      if (sha256(readFileSync(path)) !== file.sha256)
        throw new Error(`Staged file bytes changed: ${file.path}`);
    }
    atomicText(join(stageDirectory, "manifest.json"), manifestBytes);
    const staged = loadRelease({
      version: options.version,
      digest: manifestDigest,
      artifactRoot: stageStore,
    });
    if (staged.manifestDigest !== manifestDigest)
      throw new Error("Staged release manifest digest changed");
    try {
      lstatSync(destination);
      throw new Error(`Release ${options.version} appeared during build`);
    } catch (error) {
      if (!missingPath(error)) throw error;
    }
    const verifiedSource = assertSourceUnchanged(sourceRoot, source, files);
    renameSync(stageDirectory, destination);
    const release = loadRelease({
      version: options.version,
      digest: manifestDigest,
      artifactRoot,
    });
    return {
      created: true,
      sourceRevision: verifiedSource.revision,
      sourceTreeState: verifiedSource.treeState,
      release,
    };
  } finally {
    rmSync(stageStore, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const [version, artifactRoot, sourceRoot = process.cwd(), runtimes] =
      process.argv.slice(2);
    if (!version || !artifactRoot)
      throw new Error(
        "Usage: standard-release-build.ts <version> <artifact-root> [source-root] [runtime-version,...]",
      );
    const result = buildStandardRelease({
      version,
      sourceRoot,
      artifactRoot,
      runtimeVersions: runtimes ? runtimes.split(",") : [version],
    });
    console.log(
      JSON.stringify({
        version: result.release.manifest.version,
        manifestDigest: result.release.manifestDigest,
        artifactDirectory: result.release.artifactDirectory,
        sourceRevision: result.sourceRevision,
        sourceTreeState: result.sourceTreeState,
        created: result.created,
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
