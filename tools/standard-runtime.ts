import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import {
  projectBindingDigest,
  projectExceptionDigest,
} from "./project-enrollment.ts";
import { checkedProjectPath } from "./project-path-boundary.ts";
import { isStrictSemVer, loadRelease } from "./standard-release.ts";
import {
  type ProjectResolutionStatus,
  type RuntimeFacts,
  resolveProject,
} from "./standard-resolution.ts";
import type { ProjectContext } from "./task-context.ts";

const compatibilityPath = "standards/runtime-compatibility.json";
const releasesPath = "standards/releases";

interface RuntimeCompatibilityMap {
  schemaVersion: 1;
  runtimePluginVersion: string;
  compatibleStandards: Record<string, string>;
}

export interface PackagedRuntime {
  pluginRoot: string;
  runtimePluginVersion: string | null;
  status: "ready" | "partial" | "unavailable";
  compatibilityPath: string;
  artifactRoot: string;
  compatibleStandards: Record<string, string>;
  facts: RuntimeFacts | null;
  issues: string[];
}

export interface EffectiveStandard {
  status: ProjectResolutionStatus;
  dependentActivation: "available" | "blocked";
  version: string | null;
  digest: string | null;
  policyEntry: string | null;
  bindingDigest: string;
  exceptionDigest: string;
  runtimePluginVersion: string | null;
  runtimeStatus: PackagedRuntime["status"];
  issues: string[];
  policyPath: string | null;
}

const ajv = new Ajv({ allErrors: true });
const validateCompatibilityMap = ajv.compile<RuntimeCompatibilityMap>({
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "runtimePluginVersion", "compatibleStandards"],
  properties: {
    schemaVersion: { const: 1 },
    runtimePluginVersion: { type: "string", minLength: 1 },
    compatibleStandards: {
      type: "object",
      additionalProperties: { type: "string", pattern: "^[a-f0-9]{64}$" },
    },
  },
});

const sourcePluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJsonFile(path: string): unknown {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`Packaged runtime file must be a regular file: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function unavailable(
  pluginRoot: string,
  runtimePluginVersion: string | null,
  issue: string,
): PackagedRuntime {
  const artifactRoot = join(pluginRoot, releasesPath);
  const facts = runtimePluginVersion
    ? {
        runtimeVersion: runtimePluginVersion,
        compatibleStandards: {},
        artifactRoot,
      }
    : null;
  return {
    pluginRoot,
    runtimePluginVersion,
    status: "unavailable",
    compatibilityPath: join(pluginRoot, compatibilityPath),
    artifactRoot,
    compatibleStandards: {},
    facts,
    issues: [issue],
  };
}

export function loadPackagedRuntime(
  pluginRootInput = sourcePluginRoot,
): PackagedRuntime {
  let pluginRoot: string;
  try {
    pluginRoot = realpathSync(resolve(pluginRootInput));
  } catch {
    return unavailable(
      resolve(pluginRootInput),
      null,
      "Packaged Rill plugin root is missing or inaccessible",
    );
  }
  let artifactRoot: string;
  let mapPath: string;
  let pluginMetadataPath: string;
  try {
    pluginMetadataPath = checkedProjectPath(
      pluginRoot,
      ".codex-plugin/plugin.json",
    );
    mapPath = checkedProjectPath(pluginRoot, compatibilityPath);
    artifactRoot = checkedProjectPath(pluginRoot, releasesPath);
  } catch (error) {
    return unavailable(
      pluginRoot,
      null,
      "Packaged plugin path boundary is invalid: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  let runtimePluginVersion: string;
  try {
    const plugin: unknown = readJsonFile(pluginMetadataPath);
    if (
      !plugin ||
      typeof plugin !== "object" ||
      !("version" in plugin) ||
      typeof plugin.version !== "string" ||
      !isStrictSemVer(plugin.version)
    )
      return unavailable(
        pluginRoot,
        null,
        "Packaged plugin metadata has no valid runtime SemVer",
      );
    runtimePluginVersion = plugin.version;
  } catch (error) {
    return unavailable(
      pluginRoot,
      null,
      `Cannot read packaged plugin metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (existsSync(join(pluginRoot, ".git")))
    return unavailable(
      pluginRoot,
      null,
      "Runtime version is unknown for an unbuilt source checkout",
    );

  let parsedMap: unknown;
  try {
    parsedMap = readJsonFile(mapPath);
  } catch (error) {
    const detail =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
        ? "compatibility map is absent"
        : `compatibility map cannot be read: ${error instanceof Error ? error.message : String(error)}`;
    return unavailable(
      pluginRoot,
      runtimePluginVersion,
      `Packaged Rill ${detail}: ${compatibilityPath}`,
    );
  }
  if (!validateCompatibilityMap(parsedMap))
    return unavailable(
      pluginRoot,
      runtimePluginVersion,
      `Packaged compatibility map is invalid: ${ajv.errorsText(validateCompatibilityMap.errors)}`,
    );
  if (!isStrictSemVer(parsedMap.runtimePluginVersion))
    return unavailable(
      pluginRoot,
      runtimePluginVersion,
      "Compatibility map runtimePluginVersion is not strict SemVer",
    );
  if (parsedMap.runtimePluginVersion !== runtimePluginVersion)
    return unavailable(
      pluginRoot,
      runtimePluginVersion,
      "Compatibility map runtimePluginVersion does not match packaged plugin metadata",
    );

  const compatibleStandards: Record<string, string> = {};
  const issues: string[] = [];
  for (const [version, digest] of Object.entries(
    parsedMap.compatibleStandards,
  ).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
    if (!isStrictSemVer(version)) {
      issues.push(`Compatibility map has invalid standard version: ${version}`);
      continue;
    }
    try {
      const release = loadRelease({ version, digest, artifactRoot });
      if (!release.manifest.runtimeVersions.includes(runtimePluginVersion)) {
        issues.push(
          `Standard ${version} does not declare compatibility with runtime ${runtimePluginVersion}`,
        );
        continue;
      }
      compatibleStandards[version] = release.manifestDigest;
    } catch (error) {
      issues.push(
        `Standard ${version} is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (Object.keys(compatibleStandards).length === 0)
    issues.push(
      "Packaged runtime has no verified compatible standard artifacts",
    );
  return {
    pluginRoot,
    runtimePluginVersion,
    status:
      Object.keys(compatibleStandards).length === 0
        ? "unavailable"
        : issues.length > 0
          ? "partial"
          : "ready",
    compatibilityPath: mapPath,
    artifactRoot,
    compatibleStandards,
    facts: {
      runtimeVersion: runtimePluginVersion,
      compatibleStandards,
      artifactRoot,
    },
    issues,
  };
}

export function effectiveStandardForProject(
  context: ProjectContext,
  runtime: PackagedRuntime = loadPackagedRuntime(),
): EffectiveStandard {
  const emptyBindings = projectBindingDigest(context.tools ?? []);
  const emptyExceptions = projectExceptionDigest(context.exceptions ?? []);
  const base = {
    runtimePluginVersion: runtime.runtimePluginVersion,
    runtimeStatus: runtime.status,
    policyPath: null,
  } as const;
  if (!runtime.facts) {
    const legacy = context.schemaVersion === 1;
    return {
      ...base,
      status: legacy ? "legacy" : "unsupported",
      dependentActivation: legacy ? "available" : "blocked",
      version: context.standard?.version ?? null,
      digest: context.standard?.digest ?? null,
      policyEntry: null,
      bindingDigest: emptyBindings,
      exceptionDigest: emptyExceptions,
      issues: runtime.issues,
    };
  }
  const resolution = resolveProject(context.root, runtime.facts);
  const release = resolution.release;
  return {
    status: resolution.status,
    dependentActivation:
      resolution.status === "ready" || resolution.status === "legacy"
        ? "available"
        : "blocked",
    version: release?.manifest.version ?? context.standard?.version ?? null,
    digest: release?.manifestDigest ?? context.standard?.digest ?? null,
    policyEntry: release?.manifest.policyEntry ?? null,
    bindingDigest: emptyBindings,
    exceptionDigest: emptyExceptions,
    runtimePluginVersion: runtime.runtimePluginVersion,
    runtimeStatus: runtime.status,
    issues: [...runtime.issues, ...resolution.issues],
    policyPath: release
      ? join(release.artifactDirectory, release.manifest.policyEntry)
      : null,
  };
}
