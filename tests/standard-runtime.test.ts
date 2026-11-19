import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { evaluateEvent, taskStatus } from "../tools/control-event.ts";
import {
  effectiveStandardForProject,
  loadPackagedRuntime,
} from "../tools/standard-runtime.ts";
import { projectContext } from "../tools/task-context.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

const roots: string[] = [];
const fixtures: ReturnType<typeof fixtureProject>[] = [];
function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "rill-runtime-test-"));
  roots.push(root);
  return root;
}
function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}
function writeText(path: string, value: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function runtimePackage(
  options: { map?: unknown; mapRuntimeVersion?: string } = {},
) {
  const pluginRoot = temporaryRoot();
  writeJson(join(pluginRoot, ".codex-plugin/plugin.json"), {
    name: "rill",
    version: "0.1.3",
  });
  const compatibility: Record<string, string> = {};
  const releases = new Map<string, { digest: string; policy: string }>();
  for (const [version, policy] of [
    ["1.2.3", "Pinned standard one policy\n"],
    ["2.3.4", "Pinned standard two policy\n"],
  ]) {
    const directory = join(pluginRoot, "standards/releases", version);
    const policyPath = "policy/policy.md";
    const hooksPath = "hooks/hooks.json";
    const mcpPath = ".mcp.json";
    const hooks = '{"hooks":[]}\n';
    const mcp = '{"mcpServers":{}}\n';
    writeText(join(directory, policyPath), policy);
    writeText(join(directory, hooksPath), hooks);
    writeText(join(directory, mcpPath), mcp);
    const files = [
      { path: policyPath, sha256: sha256(policy) },
      { path: hooksPath, sha256: sha256(hooks) },
      { path: mcpPath, sha256: sha256(mcp) },
    ];
    const manifest = {
      schemaVersion: 1,
      version,
      sourceRevision: "a".repeat(40),
      policyEntry: policyPath,
      nativeEntries: { hooks: [hooksPath], mcp: [mcpPath] },
      projectSchemaVersions: [2],
      runtimeVersions: ["0.1.3"],
      toolCapabilities: [],
      rules: [{ id: "rill.task-scope" }],
      files,
    };
    const manifestBytes = JSON.stringify(manifest);
    writeFileSync(join(directory, "manifest.json"), manifestBytes);
    const digest = sha256(manifestBytes);
    compatibility[version] = digest;
    releases.set(version, { digest, policy });
  }
  const map = {
    schemaVersion: 1,
    runtimePluginVersion: options.mapRuntimeVersion ?? "0.1.3",
    compatibleStandards: compatibility,
  };
  if (options.map !== null)
    writeJson(
      join(pluginRoot, "standards/runtime-compatibility.json"),
      options.map ?? map,
    );
  return { pluginRoot, releases };
}

function enrolledV2(
  version: string,
  digest: string,
): ReturnType<typeof fixtureProject> {
  const fixture = fixtureProject();
  fixtures.push(fixture);
  const sync = fixture.run("sync", taskUrl);
  if (sync.status !== 0) throw new Error(sync.stderr);
  writeJson(join(fixture.root, ".rill/project.json"), {
    schemaVersion: 2,
    repository: "example/project",
    standard: { version, digest },
    tools: [],
    exceptions: [],
  });
  return fixture;
}

function effectiveFor(
  root: string,
  runtime: ReturnType<typeof loadPackagedRuntime>,
) {
  const status = taskStatus(root, runtime);
  if (!status.enrolled)
    throw new Error("Fixture project unexpectedly unenrolled");
  return status.effectiveStandard;
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("one packaged runtime resolves two exact project pins and activates each pinned policy", () => {
  const packaged = runtimePackage();
  const runtime = loadPackagedRuntime(packaged.pluginRoot);
  expect(runtime.status).toBe("ready");
  const firstRelease = packaged.releases.get("1.2.3");
  const secondRelease = packaged.releases.get("2.3.4");
  if (!firstRelease || !secondRelease)
    throw new Error("Fixture releases missing");
  const first = enrolledV2("1.2.3", firstRelease.digest);
  const second = enrolledV2("2.3.4", secondRelease.digest);
  expect(projectContext(first.root)).toMatchObject({
    schemaVersion: 2,
    standard: { version: "1.2.3", digest: firstRelease.digest },
  });
  expect(taskStatus(first.root, runtime)).toMatchObject({
    effectiveStandard: {
      status: "ready",
      dependentActivation: "available",
      version: "1.2.3",
      digest: firstRelease.digest,
      policyEntry: "policy/policy.md",
    },
  });
  expect(taskStatus(second.root, runtime)).toMatchObject({
    effectiveStandard: {
      status: "ready",
      dependentActivation: "available",
      version: "2.3.4",
      digest: secondRelease.digest,
      policyEntry: "policy/policy.md",
    },
  });
  expect(effectiveFor(first.root, runtime).bindingDigest).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(effectiveFor(first.root, runtime).exceptionDigest).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(
    evaluateEvent(
      { hook_event_name: "SessionStart", cwd: first.root, session_id: "test" },
      runtime,
    ),
  ).toMatchObject({
    hookSpecificOutput: {
      additionalContext: expect.stringContaining(firstRelease.policy),
    },
  });
  expect(
    evaluateEvent(
      { hook_event_name: "SessionStart", cwd: second.root, session_id: "test" },
      runtime,
    ),
  ).toMatchObject({
    hookSpecificOutput: {
      additionalContext: expect.stringContaining(secondRelease.policy),
    },
  });
});

test("missing or mismatched compatibility maps block v2 activation but keep legacy projects readable", () => {
  const packageWithArtifacts = runtimePackage();
  const pin = packageWithArtifacts.releases.get("1.2.3");
  if (!pin) throw new Error("Fixture release missing");
  const project = enrolledV2("1.2.3", pin.digest);

  const noMapPackage = runtimePackage({ map: null });
  const missingMapRuntime = loadPackagedRuntime(noMapPackage.pluginRoot);
  expect(missingMapRuntime).toMatchObject({ status: "unavailable" });
  const missingMapContext = projectContext(project.root);
  expect(
    effectiveStandardForProject(missingMapContext, missingMapRuntime),
  ).toMatchObject({
    status: "unsupported",
    dependentActivation: "blocked",
    version: "1.2.3",
    digest: pin.digest,
  });
  const blockedHook = evaluateEvent(
    { hook_event_name: "SessionStart", cwd: project.root, session_id: "test" },
    missingMapRuntime,
  );
  expect(JSON.stringify(blockedHook)).toContain("activation is blocked");
  expect(JSON.stringify(blockedHook)).toContain(
    "diagnostics and recovery remain available",
  );
  expect(JSON.stringify(blockedHook)).not.toContain(pin.policy);
  expect(
    evaluateEvent(
      {
        hook_event_name: "PreToolUse",
        cwd: project.root,
        session_id: "test",
        tool_name: "apply_patch",
        tool_input: { patch: "change" },
      },
      missingMapRuntime,
    ),
  ).toMatchObject({
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: expect.stringContaining("standard 1.2.3"),
    },
  });
  expect(
    evaluateEvent(
      {
        hook_event_name: "PreToolUse",
        cwd: project.root,
        session_id: "test",
        tool_name: "Bash",
        tool_input: { command: "diagnose" },
      },
      missingMapRuntime,
    ),
  ).toEqual({});
  expect(
    evaluateEvent(
      {
        hook_event_name: "UserPromptSubmit",
        cwd: project.root,
        session_id: "test",
      },
      missingMapRuntime,
    ),
  ).toMatchObject({
    hookSpecificOutput: {
      additionalContext: expect.stringContaining(
        "Rill dependent project activation is blocked",
      ),
    },
  });

  const mismatchPackage = runtimePackage({ mapRuntimeVersion: "0.1.2" });
  const mismatchRuntime = loadPackagedRuntime(mismatchPackage.pluginRoot);
  expect(mismatchRuntime).toMatchObject({ status: "unavailable" });
  expect(
    effectiveStandardForProject(projectContext(project.root), mismatchRuntime),
  ).toMatchObject({ status: "unsupported", dependentActivation: "blocked" });

  const wrongPin = enrolledV2("1.2.3", "c".repeat(64));
  expect(
    effectiveFor(
      wrongPin.root,
      loadPackagedRuntime(packageWithArtifacts.pluginRoot),
    ),
  ).toMatchObject({
    status: "unsupported",
    dependentActivation: "blocked",
    version: "1.2.3",
    digest: "c".repeat(64),
  });

  const legacy = fixtureProject();
  fixtures.push(legacy);
  const sync = legacy.run("sync", taskUrl);
  if (sync.status !== 0) throw new Error(sync.stderr);
  expect(effectiveFor(legacy.root, missingMapRuntime)).toMatchObject({
    status: "legacy",
    dependentActivation: "available",
  });
  expect(
    JSON.stringify(
      evaluateEvent(
        {
          hook_event_name: "SessionStart",
          cwd: legacy.root,
          session_id: "test",
        },
        missingMapRuntime,
      ),
    ),
  ).toContain("Owner working agreements");
});

test("an unbuilt source checkout reports its actual runtime version as unknown", () => {
  const runtime = loadPackagedRuntime();
  expect(runtime).toMatchObject({
    status: "unavailable",
    runtimePluginVersion: null,
    facts: null,
  });
  expect(runtime.issues.join(" ")).toContain(
    "unknown for an unbuilt source checkout",
  );
});

test("rejects symlinked plugin-metadata ancestor before loading a runtime", () => {
  const packaged = runtimePackage();
  const metadataRoot = join(packaged.pluginRoot, ".codex-plugin");
  const outside = join(temporaryRoot(), ".codex-plugin");
  cpSync(metadataRoot, outside, { recursive: true });
  rmSync(metadataRoot, { recursive: true });
  symlinkSync(outside, metadataRoot, "dir");
  const runtime = loadPackagedRuntime(packaged.pluginRoot);
  expect(runtime).toMatchObject({
    status: "unavailable",
    runtimePluginVersion: null,
    facts: null,
  });
  expect(runtime.issues.join(" ")).toContain("symlink");
});

test("rejects symlinked standards ancestors that redirect map and artifacts outside the package", () => {
  const packaged = runtimePackage();
  const standardsPath = join(packaged.pluginRoot, "standards");
  const externalStandards = join(temporaryRoot(), "standards");
  cpSync(standardsPath, externalStandards, { recursive: true });
  rmSync(standardsPath, { recursive: true });
  symlinkSync(externalStandards, standardsPath, "dir");
  expect(loadPackagedRuntime(packaged.pluginRoot)).toMatchObject({
    status: "unavailable",
    compatibleStandards: {},
  });
  expect(loadPackagedRuntime(packaged.pluginRoot).issues.join(" ")).toContain(
    "symlink",
  );
});
