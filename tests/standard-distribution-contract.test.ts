import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  migrateSchema1Enrollment,
  validateProjectEnrollment,
} from "../tools/project-enrollment.ts";
import { loadRelease } from "../tools/standard-release.ts";
import { resolveProject } from "../tools/standard-resolution.ts";

const roots: string[] = [];
function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "rill-standard-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function makeRelease(store: string, version = "1.2.3") {
  const releaseRoot = join(store, version);
  mkdirSync(releaseRoot, { recursive: true });
  const standardText = "# Stable Rill method\n";
  const hooksText = '{"hooks":[]}\n';
  const mcpText = '{"servers":[]}\n';
  writeFileSync(join(releaseRoot, "standard.md"), standardText);
  writeFileSync(join(releaseRoot, "hooks.json"), hooksText);
  writeFileSync(join(releaseRoot, "mcp.json"), mcpText);
  const manifest = {
    schemaVersion: 1,
    version,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    policyEntry: "standard.md",
    nativeEntries: { hooks: ["hooks.json"], mcp: ["mcp.json"] },
    projectSchemaVersions: [2],
    runtimeVersions: ["0.1.0"],
    toolCapabilities: ["check.unit"],
    rules: [{ id: "rill.source-check" }],
    files: [
      { path: "standard.md", sha256: sha256(standardText) },
      { path: "hooks.json", sha256: sha256(hooksText) },
      { path: "mcp.json", sha256: sha256(mcpText) },
    ],
  };
  return {
    digest: writeManifest(releaseRoot, manifest),
    manifest,
    releaseRoot,
  };
}

function writeManifest(releaseRoot: string, manifest: unknown) {
  const bytes = JSON.stringify(manifest);
  writeFileSync(join(releaseRoot, "manifest.json"), bytes);
  return sha256(bytes);
}

function enrollment(version = "1.2.3", digest = "a".repeat(64)) {
  return {
    schemaVersion: 2,
    repository: "example/project",
    standard: { version, digest },
    tools: [
      {
        capability: "check.unit",
        argv: ["pnpm", "test"],
        cwd: ".",
        version: "pnpm 12.18.0",
        inapplicability: null,
      },
    ],
    exceptions: [
      {
        ruleId: "rill.source-check",
        disposition: "replace",
        replacement: "check.unit",
        reason: "Project has an equivalent check",
        source: "owner decision #17",
        reviewTrigger: "When test tooling changes",
      },
    ],
  };
}

function runtimeFacts(
  artifactRoot: string,
  version = "1.2.3",
  digest = "a".repeat(64),
) {
  return {
    runtimeVersion: "0.1.0",
    compatibleStandards: { [version]: digest },
    artifactRoot,
  };
}

test("loads an exact immutable release and verifies manifest and declared file digests", () => {
  const store = join(temporaryRoot(), "standards");
  const release = makeRelease(store);
  expect(
    loadRelease({
      version: "1.2.3",
      digest: release.digest,
      artifactRoot: store,
    }),
  ).toMatchObject({
    manifestDigest: release.digest,
    manifest: { version: "1.2.3", rules: [{ id: "rill.source-check" }] },
  });
  expect(() =>
    loadRelease({
      version: "01.2.3",
      digest: release.digest,
      artifactRoot: store,
    }),
  ).toThrow(/SemVer/);
  expect(() =>
    loadRelease({
      version: "1.2.3",
      digest: "0".repeat(64),
      artifactRoot: store,
    }),
  ).toThrow(/pin/);
  expect(() =>
    loadRelease({
      version: "9.9.9",
      digest: release.digest,
      artifactRoot: store,
    }),
  ).toThrow(/missing/);
  writeFileSync(join(release.releaseRoot, "standard.md"), "tampered\n");
  expect(() =>
    loadRelease({
      version: "1.2.3",
      digest: release.digest,
      artifactRoot: store,
    }),
  ).toThrow(/digest/i);
});

test("release manifest requires policy and native entry references to be hashed files", () => {
  const store = join(temporaryRoot(), "standards");
  const release = makeRelease(store);
  const { policyEntry: _policyEntry, ...withoutPolicyEntry } = release.manifest;
  const missingEntryDigest = writeManifest(
    release.releaseRoot,
    withoutPolicyEntry,
  );
  expect(() =>
    loadRelease({
      version: "1.2.3",
      digest: missingEntryDigest,
      artifactRoot: store,
    }),
  ).toThrow(/Invalid release manifest/);

  const undeclaredEntry = {
    ...release.manifest,
    nativeEntries: { hooks: ["hooks.json"], mcp: ["missing-mcp.json"] },
  };
  const undeclaredEntryDigest = writeManifest(
    release.releaseRoot,
    undeclaredEntry,
  );
  expect(() =>
    loadRelease({
      version: "1.2.3",
      digest: undeclaredEntryDigest,
      artifactRoot: store,
    }),
  ).toThrow(/must name declared release files/);
});

test("project resolver distinguishes ready, unsupported, legacy, unenrolled, and invalid projects", () => {
  const root = temporaryRoot();
  const artifactRoot = join(root, "standards");
  const release = makeRelease(artifactRoot);
  mkdirSync(join(root, "project", ".rill"), { recursive: true });
  const projectRoot = join(root, "project");
  const projectPath = join(projectRoot, ".rill/project.json");
  writeFileSync(
    projectPath,
    JSON.stringify(enrollment("1.2.3", release.digest)),
  );
  const ready = resolveProject(
    projectRoot,
    runtimeFacts(artifactRoot, "1.2.3", release.digest),
  );
  expect(ready).toMatchObject({
    status: "ready",
    project: { repository: "example/project", schemaVersion: 2 },
    release: { manifest: { version: "1.2.3" } },
  });
  expect(ready.bindingDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(ready.exceptionDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(
    resolveProject(
      projectRoot,
      runtimeFacts(artifactRoot, "2.0.0", "b".repeat(64)),
    ).status,
  ).toBe("unsupported");
  writeFileSync(
    projectPath,
    JSON.stringify({ schemaVersion: 1, repository: "example/project" }),
  );
  expect(resolveProject(projectRoot, runtimeFacts(artifactRoot)).status).toBe(
    "legacy",
  );
  rmSync(projectPath);
  expect(resolveProject(projectRoot, runtimeFacts(artifactRoot)).status).toBe(
    "unenrolled",
  );
  symlinkSync(join(projectRoot, ".rill/missing-target.json"), projectPath);
  expect(resolveProject(projectRoot, runtimeFacts(artifactRoot)).status).toBe(
    "invalid",
  );
  rmSync(projectPath);
  writeFileSync(
    projectPath,
    JSON.stringify({
      ...enrollment(),
      tools: [
        {
          capability: "unknown",
          argv: ["../escape"],
          cwd: "../outside",
          version: "1",
        },
      ],
    }),
  );
  expect(resolveProject(projectRoot, runtimeFacts(artifactRoot)).status).toBe(
    "invalid",
  );
  const unknownRule = enrollment("1.2.3", release.digest);
  const unknownException = unknownRule.exceptions[0];
  if (unknownException) unknownException.ruleId = "unknown.rule";
  writeFileSync(projectPath, JSON.stringify(unknownRule));
  expect(
    resolveProject(
      projectRoot,
      runtimeFacts(artifactRoot, "1.2.3", release.digest),
    ),
  ).toMatchObject({
    status: "invalid",
    issues: [expect.stringContaining("unknown standard rule")],
  });
});

test("schema 2 rejects unknown exception rules and invalid command paths, and schema 1 migration requires an exact pin", () => {
  const invalidPath = enrollment();
  const invalidPathBinding = invalidPath.tools[0];
  if (invalidPathBinding) invalidPathBinding.cwd = "../outside";
  expect(validateProjectEnrollment(invalidPath)).toBe(false);
  const invalidArgv = enrollment();
  const invalidArgvBinding = invalidArgv.tools[0];
  if (invalidArgvBinding) invalidArgvBinding.argv = [""];
  expect(validateProjectEnrollment(invalidArgv)).toBe(false);
  const unknownRule = enrollment();
  const unknownException = unknownRule.exceptions[0];
  if (unknownException) unknownException.ruleId = "unknown.rule";
  expect(validateProjectEnrollment(unknownRule)).toBe(true);

  const legacy = { schemaVersion: 1, repository: "example/project" };
  expect(() => migrateSchema1Enrollment(legacy, {} as never)).toThrow();
  expect(
    migrateSchema1Enrollment(legacy, {
      standard: { version: "1.2.3", digest: "c".repeat(64) },
      tools: enrollment().tools,
      exceptions: [],
    }),
  ).toMatchObject({
    schemaVersion: 2,
    standard: { version: "1.2.3", digest: "c".repeat(64) },
  });
});
