import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { applyDistributionPlan } from "../tools/distribution-apply.ts";
import { buildPlan } from "../tools/distribution-plan.ts";
import {
  inspectDistributionRecovery,
  rollbackDistributionPlan,
} from "../tools/distribution-recovery.ts";
import type { ProjectEnrollmentV2 } from "../tools/project-enrollment.ts";
import { inventory } from "../tools/project-inventory.ts";
import { loadRelease } from "../tools/standard-release.ts";

const roots: string[] = [];
const runtimeVersion = "0.1.3";

function projectAt(
  projects: Array<{ name: string; project: string }>,
  index: number,
) {
  const project = projects[index];
  if (!project) throw new Error(`Fixture project ${index} is missing`);
  return project;
}

function fixture(
  projectCount = 1,
  targetIsCurrent = false,
  dirty = false,
  metadataSymlink = false,
) {
  const root = mkdtempSync(join(tmpdir(), "rill-apply-"));
  roots.push(root);
  const store = join(root, "standards");
  const oldRelease = release(store, "1.0.0");
  const targetRelease = targetIsCurrent ? oldRelease : release(store, "1.1.0");
  const projects = Array.from({ length: projectCount }, (_, index) => {
    const name = `project-${index + 1}`;
    const project = join(root, name);
    mkdirSync(project, { recursive: true });
    const pin: ProjectEnrollmentV2 = {
      schemaVersion: 2,
      repository: `example/${name}`,
      standard: {
        version: oldRelease.manifest.version,
        digest: oldRelease.manifestDigest,
      },
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
          reason: "Fixture choice",
          source: "test fixture",
          reviewTrigger: "fixture changes",
        },
      ],
    };
    if (metadataSymlink) {
      const outsideMetadata = join(root, `${name}-external-metadata`);
      mkdirSync(outsideMetadata);
      writeFileSync(
        join(outsideMetadata, "project.json"),
        `${JSON.stringify(pin, null, 2)}\n`,
      );
      symlinkSync(outsideMetadata, join(project, ".rill"), "dir");
    } else {
      mkdirSync(join(project, ".rill"));
      writeFileSync(
        join(project, ".rill/project.json"),
        `${JSON.stringify(pin, null, 2)}\n`,
      );
    }
    writeFileSync(join(project, "README.md"), "fixture\n");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", project]);
    execFileSync("git", [
      "-C",
      project,
      "config",
      "core.hooksPath",
      "/dev/null",
    ]);
    execFileSync("git", [
      "-C",
      project,
      "config",
      "user.email",
      "fixture@example.test",
    ]);
    execFileSync("git", [
      "-C",
      project,
      "config",
      "user.name",
      "Apply fixture",
    ]);
    execFileSync("git", ["-C", project, "add", "."]);
    execFileSync("git", ["-C", project, "commit", "--quiet", "-m", "fixture"]);
    return { name, project };
  });
  if (dirty)
    writeFileSync(
      join(projectAt(projects, 0).project, "notes.txt"),
      "owner note\n",
    );
  const runtimeFacts = {
    runtimeVersion,
    compatibleStandards: {
      [oldRelease.manifest.version]: oldRelease.manifestDigest,
      [targetRelease.manifest.version]: targetRelease.manifestDigest,
    },
    artifactRoot: store,
  };
  const plan = buildPlan({
    inventory: inventory({
      registeredProjects: projects.map(({ name, project }) => ({
        name,
        path: project,
      })),
      explicitRoots: [],
      runtimeFacts,
    }),
    namedTargets: projects.map(({ name }) => name),
    targetRelease,
    runtimeFacts,
  });
  return { root, projects, plan };
}

function release(store: string, version: string) {
  const directory = join(store, version);
  mkdirSync(directory, { recursive: true });
  const standard = `# Standard ${version}\n`;
  const hooks = '{"hooks":[]}\n';
  const mcp = '{"servers":[]}\n';
  writeFileSync(join(directory, "standard.md"), standard);
  writeFileSync(join(directory, "hooks.json"), hooks);
  writeFileSync(join(directory, "mcp.json"), mcp);
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const manifest = {
    schemaVersion: 1,
    version,
    sourceRevision: "a".repeat(40),
    policyEntry: "standard.md",
    nativeEntries: { hooks: ["hooks.json"], mcp: ["mcp.json"] },
    projectSchemaVersions: [2],
    runtimeVersions: [runtimeVersion],
    toolCapabilities: ["check.unit"],
    rules: [{ id: "rill.source-check" }],
    files: [
      { path: "standard.md", sha256: hash(standard) },
      { path: "hooks.json", sha256: hash(hooks) },
      { path: "mcp.json", sha256: hash(mcp) },
    ],
  };
  const bytes = JSON.stringify(manifest);
  writeFileSync(join(directory, "manifest.json"), bytes);
  return loadRelease({
    version,
    digest: hash(bytes),
    artifactRoot: store,
  });
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("applies named project updates and leaves unrelated dirty work intact", () => {
  const { root, projects, plan } = fixture(2, false, true);
  const unrelated = join(projectAt(projects, 0).project, "notes.txt");

  const result = applyDistributionPlan(plan, join(root, "private-state"));

  expect(result.status, result.issues.join("; ")).toBe("complete");
  expect(result.nativeConfigEffects.status).toBe("not-planned");
  expect(result.targets.map((target) => target.state)).toEqual([
    "applied",
    "applied",
  ]);
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 0).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.1.0");
  expect(readFileSync(unrelated, "utf8")).toBe("owner note\n");
  const rollback = rollbackDistributionPlan(plan, join(root, "private-state"));
  expect(rollback.status).toBe("rolled-back");
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 0).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.0.0");
  expect(readFileSync(unrelated, "utf8")).toBe("owner note\n");
  const unchanged = fixture(1, true);
  const unchangedResult = applyDistributionPlan(
    unchanged.plan,
    join(unchanged.root, "private-state"),
  );
  expect(unchangedResult.status).toBe("complete");
  expect(unchangedResult.targets[0]?.state).toBe("unchanged");
});

test("rejects a stale plan before writing any target", () => {
  const { root, projects, plan } = fixture(2);
  const changed = join(projectAt(projects, 1).project, ".rill/project.json");
  writeFileSync(changed, `${readFileSync(changed, "utf8")}\nowner change\n`);
  const beforeFirst = readFileSync(
    join(projectAt(projects, 0).project, ".rill/project.json"),
    "utf8",
  );

  const result = applyDistributionPlan(plan, join(root, "private-state"));

  expect(result.status).toBe("stale");
  expect(result.targets.every((target) => target.state === "pending")).toBe(
    true,
  );
  expect(
    readFileSync(
      join(projectAt(projects, 0).project, ".rill/project.json"),
      "utf8",
    ),
  ).toBe(beforeFirst);
});

test("does not plan a committed metadata-directory symlink", () => {
  const { root, projects, plan } = fixture(1, false, false, true);
  const outsideFile = join(root, "project-1-external-metadata/project.json");
  const before = readFileSync(outsideFile, "utf8");
  expect(plan.conflicts.map((conflict) => conflict.code)).toContain(
    "target-invalid",
  );
  expect(() =>
    applyDistributionPlan(plan, join(root, "private-state")),
  ).toThrow(/conflicted/);
  expect(readFileSync(outsideFile, "utf8")).toBe(before);
  expect(
    readFileSync(
      join(projectAt(projects, 0).project, ".rill/project.json"),
      "utf8",
    ),
  ).toBe(before);
});

test("does not write through a metadata symlink introduced after planning", () => {
  const { root, projects, plan } = fixture();
  const project = projectAt(projects, 0).project;
  const externalMetadata = join(root, "external-metadata");
  mkdirSync(externalMetadata);
  const outsideFile = join(externalMetadata, "project.json");
  const plannedBefore = plan.targets[0]?.changes[0]?.expectedCurrent.bytes;
  if (!plannedBefore) throw new Error("Fixture plan has no before-state bytes");
  writeFileSync(outsideFile, plannedBefore);
  rmSync(join(project, ".rill"), { recursive: true });
  symlinkSync(externalMetadata, join(project, ".rill"), "dir");

  expect(() =>
    applyDistributionPlan(plan, join(root, "private-state")),
  ).toThrow(/symlink|symbolic/i);
  expect(readFileSync(outsideFile, "utf8")).toBe(plannedBefore);
});

test("rejects plan-content drift before creating an apply journal", () => {
  const { root, projects, plan } = fixture();
  const path = join(projectAt(projects, 0).project, ".rill/project.json");
  const before = readFileSync(path, "utf8");
  const change = plan.targets[0]?.changes[0];
  if (!change) throw new Error("Fixture plan has no enrollment change");
  change.expectedAfter.bytes += "\nowner edit\n";

  expect(() =>
    applyDistributionPlan(plan, join(root, "private-state")),
  ).toThrow(/plan content does not match/i);
  expect(readFileSync(path, "utf8")).toBe(before);
});

test("journals a write failure and recovery classifies actual target state", () => {
  const { root, projects, plan } = fixture(2);
  let writes = 0;
  const result = applyDistributionPlan(plan, join(root, "private-state"), {
    writeEnrollment(path, bytes, mode) {
      writes += 1;
      if (writes === 2) throw new Error("fixture write failure");
      writeFileSync(path, bytes, { mode });
    },
  });

  expect(result.status).toBe("failed");
  expect(result.targets.map((target) => target.state)).toEqual([
    "applied",
    "failed",
  ]);
  const recovery = inspectDistributionRecovery(
    plan,
    join(root, "private-state"),
  );
  expect(recovery.status).toBe("interrupted");
  expect(recovery.targets.map((target) => target.observed)).toEqual([
    "after",
    "before",
  ]);
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 0).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.1.0");
  const resumed = applyDistributionPlan(plan, join(root, "private-state"), {
    resume: true,
  });
  expect(resumed.status).toBe("complete");
  expect(resumed.targets.map((target) => target.state)).toEqual([
    "applied",
    "applied",
  ]);
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 1).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.1.0");
});

test("does not resume when a required before-state backup is missing", () => {
  const { root, projects, plan } = fixture(2);
  const stateRoot = join(root, "private-state");
  let writes = 0;
  const partial = applyDistributionPlan(plan, stateRoot, {
    writeEnrollment(path, bytes, mode) {
      writes += 1;
      if (writes === 2) throw new Error("fixture write failure");
      writeFileSync(path, bytes, { mode });
    },
  });
  const journalPath = partial.journalPath;
  if (!journalPath) throw new Error("Partial apply did not create a journal");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  rmSync(journal.targets[0].before.backupPath);

  const resumed = applyDistributionPlan(plan, stateRoot, { resume: true });

  expect(resumed.status).toBe("conflict");
  expect(resumed.issues.join(" ")).toMatch(/backup/i);
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 1).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.0.0");
});

test("keeps rollback conflict visible when its before-state backup is missing", () => {
  const { root, projects, plan } = fixture();
  const stateRoot = join(root, "private-state");
  const applied = applyDistributionPlan(plan, stateRoot);
  const journalPath = applied.journalPath;
  if (!journalPath) throw new Error("Apply did not create a journal");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  rmSync(journal.targets[0].before.backupPath);

  const rollback = rollbackDistributionPlan(plan, stateRoot);

  expect(rollback.status).toBe("conflict");
  expect(rollback.issues.join(" ")).toMatch(/backup/i);
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 0).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.1.0");
  expect(inspectDistributionRecovery(plan, stateRoot).status).toBe("conflict");
});

test("rolls back only the exact operation after-state and preserves later owner edits", () => {
  const { root, projects, plan } = fixture(2);
  const result = applyDistributionPlan(plan, join(root, "private-state"), {
    writeEnrollment(path, bytes, mode) {
      if (path === plan.targets[1]?.changes[0]?.expectedCurrent.path)
        throw new Error("fixture write failure");
      writeFileSync(path, bytes, { mode });
    },
  });
  const first = join(projectAt(projects, 0).project, ".rill/project.json");
  const ownerEdit = `${readFileSync(first, "utf8")}\nowner edit\n`;
  writeFileSync(first, ownerEdit);

  const rollback = rollbackDistributionPlan(plan, join(root, "private-state"));

  expect(result.status).toBe("failed");
  expect(rollback.status).toBe("conflict");
  expect(readFileSync(first, "utf8")).toBe(ownerEdit);
});

test("does not roll back through a metadata symlink introduced after apply", () => {
  const { root, projects, plan } = fixture();
  const stateRoot = join(root, "private-state");
  const applied = applyDistributionPlan(plan, stateRoot);
  expect(applied.status).toBe("complete");
  const project = projectAt(projects, 0).project;
  const externalMetadata = join(root, "external-metadata");
  mkdirSync(externalMetadata);
  const outsideFile = join(externalMetadata, "project.json");
  const plannedAfter = plan.targets[0]?.changes[0]?.expectedAfter.bytes;
  if (!plannedAfter) throw new Error("Fixture plan has no after-state bytes");
  writeFileSync(outsideFile, plannedAfter);
  rmSync(join(project, ".rill"), { recursive: true });
  symlinkSync(externalMetadata, join(project, ".rill"), "dir");

  const rollback = rollbackDistributionPlan(plan, stateRoot);

  expect(rollback.status).toBe("conflict");
  expect(readFileSync(outsideFile, "utf8")).toBe(plannedAfter);
});

test("rejects a journal whose file path no longer matches the plan", () => {
  const { root, projects, plan } = fixture();
  const stateRoot = join(root, "private-state");
  const result = applyDistributionPlan(plan, stateRoot);
  const journalPath = result.journalPath;
  if (!journalPath) throw new Error("Apply did not create its journal");
  const ownerFile = join(root, "owner-file.txt");
  writeFileSync(ownerFile, "keep this file\n");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  journal.targets[0].path = ownerFile;
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

  const recovery = rollbackDistributionPlan(plan, stateRoot);

  expect(recovery.status).toBe("conflict");
  expect(readFileSync(ownerFile, "utf8")).toBe("keep this file\n");
  expect(
    JSON.parse(
      readFileSync(
        join(projectAt(projects, 0).project, ".rill/project.json"),
        "utf8",
      ),
    ).standard.version,
  ).toBe("1.1.0");
});
