import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { buildPlan } from "../tools/distribution-plan.ts";
import type { ProjectEnrollmentV2 } from "../tools/project-enrollment.ts";
import { inventory } from "../tools/project-inventory.ts";
import { loadRelease } from "../tools/standard-release.ts";

const roots: string[] = [];
const runtimeVersion = "0.1.3";

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "rill-plan-"));
  roots.push(root);
  return root;
}

function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeRelease(
  store: string,
  version: string,
  capabilities = ["check.unit"],
  rules = [{ id: "rill.source-check" }],
) {
  const directory = join(store, version);
  mkdirSync(directory, { recursive: true });
  const standard = `# Rill standard ${version}\n`;
  const hooks = JSON.stringify({ hooks: [] });
  const mcp = JSON.stringify({ mcpServers: {} });
  writeFileSync(join(directory, "standard.md"), standard);
  writeFileSync(join(directory, "hooks.json"), hooks);
  writeFileSync(join(directory, "mcp.json"), mcp);
  const manifest = {
    schemaVersion: 1,
    version,
    sourceRevision: "a".repeat(40),
    policyEntry: "standard.md",
    nativeEntries: { hooks: ["hooks.json"], mcp: ["mcp.json"] },
    projectSchemaVersions: [2],
    runtimeVersions: [runtimeVersion],
    toolCapabilities: capabilities,
    rules,
    files: [
      { path: "standard.md", sha256: sha256(standard) },
      { path: "hooks.json", sha256: sha256(hooks) },
      { path: "mcp.json", sha256: sha256(mcp) },
    ],
  };
  const manifestBytes = JSON.stringify(manifest);
  writeFileSync(join(directory, "manifest.json"), manifestBytes);
  const digest = sha256(manifestBytes);
  return loadRelease({ version, digest, artifactRoot: store });
}

function enrollment(version: string, digest: string): ProjectEnrollmentV2 {
  return {
    schemaVersion: 2,
    repository: "example/fixture",
    standard: { version, digest },
    tools: [
      {
        capability: "check.unit",
        argv: ["pnpm", "test"],
        cwd: ".",
        version: "pnpm 12",
        inapplicability: null,
      },
    ],
    exceptions: [
      {
        ruleId: "rill.source-check",
        disposition: "inapplicable",
        reason: "The fixture uses no additional source rule",
        source: "fixture choice",
        reviewTrigger: "fixture changes",
      },
    ],
  };
}

function gitProject(
  root: string,
  name: string,
  pin: ProjectEnrollmentV2 | { schemaVersion: 1; repository: string },
) {
  const project = join(root, name);
  mkdirSync(join(project, ".rill"), { recursive: true });
  writeFileSync(
    join(project, ".rill", "project.json"),
    `${JSON.stringify(pin, null, 2)}\n`,
  );
  writeFileSync(join(project, "README.md"), "fixture\n");
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", project]);
  execFileSync("git", ["-C", project, "config", "core.hooksPath", "/dev/null"]);
  execFileSync("git", [
    "-C",
    project,
    "config",
    "user.email",
    "fixture@example.test",
  ]);
  execFileSync("git", ["-C", project, "config", "user.name", "Plan fixture"]);
  execFileSync("git", [
    "-C",
    project,
    "add",
    ".rill/project.json",
    "README.md",
  ]);
  execFileSync("git", ["-C", project, "commit", "--quiet", "-m", "fixture"]);
  return project;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("builds a stable pin plan for only the named project and preserves unrelated dirty files", () => {
  const root = temporaryRoot();
  const store = join(root, "standards");
  const current = makeRelease(store, "1.0.0");
  const target = makeRelease(store, "1.1.0");
  const project = gitProject(
    root,
    "production",
    enrollment("1.0.0", current.manifestDigest),
  );
  const unrelated = join(project, "notes.txt");
  writeFileSync(unrelated, "owner note remains\n");
  const runtimeFacts = {
    runtimeVersion,
    compatibleStandards: {
      "1.0.0": current.manifestDigest,
      "1.1.0": target.manifestDigest,
    },
    artifactRoot: store,
  };
  const snapshot = inventory({
    registeredProjects: [{ name: "production", path: project }],
    explicitRoots: [],
    runtimeFacts,
  });
  const original = readFileSync(join(project, ".rill/project.json"), "utf8");
  const first = buildPlan({
    inventory: snapshot,
    namedTargets: ["production"],
    targetRelease: target,
    runtimeFacts,
  });
  const second = buildPlan({
    inventory: snapshot,
    namedTargets: ["production"],
    targetRelease: target,
    runtimeFacts,
  });

  expect(first.planId).toBe(second.planId);
  expect(first.targetRelease.sourceRevision).toBe("a".repeat(40));
  expect(first.targets.map((entry) => entry.name)).toEqual(["production"]);
  expect(first.targets[0]?.gitBaseline?.revision).not.toBeNull();
  expect(first.targets[0]?.gitBaseline?.dirty).toBe(true);
  expect(first.targets[0]?.action).toBe("update");
  expect(first.targets[0]?.changes).toHaveLength(1);
  expect(first.targets[0]?.changes[0]?.expectedCurrent.bytes).toBe(original);
  expect(first.targets[0]?.changes[0]?.expectedAfter.mode).toBe(
    first.targets[0]?.changes[0]?.expectedCurrent.mode,
  );
  expect(
    JSON.parse(first.targets[0]?.changes[0]?.expectedAfter.bytes ?? "{}")
      .standard,
  ).toEqual({
    version: "1.1.0",
    digest: target.manifestDigest,
  });
  expect(readFileSync(join(project, ".rill/project.json"), "utf8")).toBe(
    original,
  );
  expect(readFileSync(unrelated, "utf8")).toBe("owner note remains\n");
});

test("blocks dirty enrollment bytes and refuses discovered-but-unnamed or legacy targets", () => {
  const root = temporaryRoot();
  const store = join(root, "standards");
  const current = makeRelease(store, "1.0.0");
  const target = makeRelease(store, "1.1.0");
  const enrolled = gitProject(
    root,
    "production",
    enrollment("1.0.0", current.manifestDigest),
  );
  const legacy = gitProject(root, "legacy-project", {
    schemaVersion: 1,
    repository: "example/fixture",
  });
  const unenrolled = join(root, "unenrolled");
  mkdirSync(unenrolled);
  execFileSync("git", ["init", "--quiet", unenrolled]);
  const dirtyBytes = `${JSON.stringify(
    {
      ...enrollment("1.0.0", current.manifestDigest),
      tools: [
        {
          capability: "check.unit",
          argv: ["pnpm", "test"],
          cwd: ".",
          version: "owner-local-version",
          inapplicability: null,
        },
      ],
    },
    null,
    2,
  )}\n`;
  writeFileSync(join(enrolled, ".rill/project.json"), dirtyBytes);
  const runtimeFacts = {
    runtimeVersion,
    compatibleStandards: {
      "1.0.0": current.manifestDigest,
      "1.1.0": target.manifestDigest,
    },
    artifactRoot: store,
  };
  const snapshot = inventory({
    registeredProjects: [],
    explicitRoots: [
      { name: "production", path: enrolled },
      { name: "legacy-project", path: legacy },
      { name: "discovered-only", path: unenrolled },
    ],
    runtimeFacts,
  });
  const plan = buildPlan({
    inventory: snapshot,
    namedTargets: ["production", "legacy-project"],
    targetRelease: target,
    runtimeFacts,
  });

  expect(plan.targets.map((entry) => entry.name)).toEqual([
    "legacy-project",
    "production",
  ]);
  expect(
    plan.targets
      .find((entry) => entry.name === "production")
      ?.conflicts.map((entry) => entry.code),
  ).toContain("local-drift");
  expect(
    plan.targets
      .find((entry) => entry.name === "legacy-project")
      ?.conflicts.map((entry) => entry.code),
  ).toContain("migration-choices-required");
  expect(plan.targets.some((entry) => entry.name === "discovered-only")).toBe(
    false,
  );
  expect(readFileSync(join(enrolled, ".rill/project.json"), "utf8")).toBe(
    dirtyBytes,
  );
});

test("uses the shared resolver's unsupported classification and only plans the explicitly named upgrade", () => {
  const root = temporaryRoot();
  const store = join(root, "standards");
  const target = makeRelease(store, "1.1.0");
  const unsupported = gitProject(
    root,
    "unsupported",
    enrollment("0.9.0", "f".repeat(64)),
  );
  const unenrolled = join(root, "discovered-only");
  mkdirSync(unenrolled);
  execFileSync("git", ["init", "--quiet", unenrolled]);
  const runtimeFacts = {
    runtimeVersion,
    compatibleStandards: { "1.1.0": target.manifestDigest },
    artifactRoot: store,
  };
  const snapshot = inventory({
    registeredProjects: [],
    explicitRoots: [
      { name: "pin-upgrade", path: unsupported },
      { name: "discovered-only", path: unenrolled },
    ],
    runtimeFacts,
  });

  expect(
    snapshot.entries.find((entry) => entry.name === "pin-upgrade")
      ?.classification,
  ).toBe("unsupported");
  expect(
    snapshot.entries.find((entry) => entry.name === "discovered-only")
      ?.classification,
  ).toBe("unenrolled");
  const plan = buildPlan({
    inventory: snapshot,
    namedTargets: ["pin-upgrade"],
    targetRelease: target,
    runtimeFacts,
  });
  expect(plan.targets.map((entry) => entry.name)).toEqual(["pin-upgrade"]);
  expect(plan.targets[0]?.action).toBe("update");
  expect(plan.targets[0]?.conflicts).toEqual([]);
});

test.each([
  {
    issue: "capability",
    capabilities: ["check.other"],
    rules: [{ id: "rill.source-check" }],
    expectedMessage: /capability/i,
  },
  {
    issue: "exception rule",
    capabilities: ["check.unit"],
    rules: [{ id: "rill.other-rule" }],
    expectedMessage: /rule/i,
  },
])(
  "blocks a target release that drops a project's bound $issue",
  ({ capabilities, rules, expectedMessage }) => {
    const root = temporaryRoot();
    const store = join(root, "standards");
    const current = makeRelease(store, "1.0.0");
    const target = makeRelease(store, "1.1.0", capabilities, rules);
    const project = gitProject(
      root,
      "production",
      enrollment("1.0.0", current.manifestDigest),
    );
    const runtimeFacts = {
      runtimeVersion,
      compatibleStandards: {
        "1.0.0": current.manifestDigest,
        "1.1.0": target.manifestDigest,
      },
      artifactRoot: store,
    };
    const snapshot = inventory({
      registeredProjects: [],
      explicitRoots: [{ name: "production", path: project }],
      runtimeFacts,
    });
    const plan = buildPlan({
      inventory: snapshot,
      namedTargets: ["production"],
      targetRelease: target,
      runtimeFacts,
    });

    expect(plan.targets[0]?.action).toBe("blocked");
    expect(plan.targets[0]?.changes).toEqual([]);
    expect(
      plan.targets[0]?.conflicts.map((conflict) => conflict.code),
    ).toContain("release-incompatible");
    expect(
      plan.targets[0]?.conflicts.map((conflict) => conflict.message).join(" "),
    ).toMatch(expectedMessage);
  },
);
