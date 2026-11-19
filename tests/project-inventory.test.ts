import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { inventory } from "../tools/project-inventory.ts";
import type { ProjectResolution } from "../tools/standard-resolution.ts";

const directories: string[] = [];
const runtimeFacts = {
  runtimeVersion: "0.1.3",
  compatibleStandards: { "0.1.3": "a".repeat(64) },
  artifactRoot: "/unused-inventory-fixture",
};

function gitProject(name: string) {
  const root = join(
    mkdtempSync(join(tmpdir(), `rill-inventory-${name}-`)),
    name,
  );
  directories.push(root.slice(0, root.lastIndexOf("/")));
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
  execFileSync("git", ["-C", root, "config", "core.hooksPath", "/dev/null"]);
  execFileSync("git", [
    "-C",
    root,
    "config",
    "user.email",
    "fixture@example.test",
  ]);
  execFileSync("git", ["-C", root, "config", "user.name", "Inventory fixture"]);
  writeFileSync(join(root, "README.md"), `${name}\n`);
  execFileSync("git", ["-C", root, "add", "README.md"]);
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"]);
  return root;
}

function resolver(root: string): ProjectResolution {
  if (basename(root) === "unsupported")
    return {
      status: "unsupported",
      project: null,
      release: null,
      issues: ["runtime pin unsupported"],
      bindings: [],
      exceptions: [],
      bindingDigest: "b".repeat(64),
      exceptionDigest: "c".repeat(64),
    };
  const marker = join(root, ".rill", "project.json");
  try {
    const project = JSON.parse(readFileSync(marker, "utf8"));
    return {
      status: project.schemaVersion === 1 ? "legacy" : "ready",
      project: {
        root,
        repository: project.repository,
        schemaVersion: project.schemaVersion,
      },
      release: null,
      bindings: [],
      exceptions: [],
      bindingDigest: "b".repeat(64),
      exceptionDigest: "c".repeat(64),
      issues: [],
    };
  } catch {
    return {
      status: "unenrolled",
      project: null,
      release: null,
      issues: [],
      bindings: [],
      exceptions: [],
      bindingDigest: "b".repeat(64),
      exceptionDigest: "c".repeat(64),
    };
  }
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

test("deduplicates path aliases but preserves separate worktrees and their local config", () => {
  const root = gitProject("primary");
  const worktree = join(root, "..", "worktree");
  const alias = join(root, "..", "primary-alias");
  writeFileSync(join(root, "README.md"), "committed root\n");
  mkdirSync(join(root, ".rill"), { recursive: true });
  const rootConfig = JSON.stringify(
    {
      schemaVersion: 2,
      repository: "owner/primary",
      standard: { version: "0.1.3", digest: "a".repeat(64) },
    },
    null,
    2,
  );
  writeFileSync(join(root, ".rill", "project.json"), rootConfig);
  execFileSync("git", ["-C", root, "add", "README.md", ".rill/project.json"]);
  execFileSync("git", [
    "-C",
    root,
    "commit",
    "--quiet",
    "-m",
    "enroll primary",
  ]);
  execFileSync("git", ["-C", root, "branch", "worktree-branch"]);
  execFileSync("git", [
    "-C",
    root,
    "worktree",
    "add",
    "--quiet",
    worktree,
    "worktree-branch",
  ]);
  symlinkSync(root, alias, "dir");
  const localConfig = JSON.stringify(
    {
      schemaVersion: 2,
      repository: "owner/primary",
      standard: { version: "0.1.2", digest: "d".repeat(64) },
    },
    null,
    2,
  );
  writeFileSync(join(worktree, ".rill", "project.json"), localConfig);

  const result = inventory(
    {
      registeredProjects: [{ name: "registered-primary", path: root }],
      explicitRoots: [
        { name: "primary-alias", path: alias, trustPath: root },
        { name: "feature-worktree", path: worktree },
      ],
      runtimeFacts,
    },
    { resolveProject: resolver },
  );

  expect(result.entries).toHaveLength(2);
  const primary = result.entries.find((entry) => entry.canonicalRoot === root);
  const feature = result.entries.find(
    (entry) => entry.canonicalRoot === worktree,
  );
  expect(primary?.names).toEqual(["primary-alias", "registered-primary"]);
  expect(primary?.sources).toEqual(["explicit", "registered"]);
  expect(feature?.git?.commonDir).toBe(primary?.git?.commonDir);
  expect(feature?.canonicalRoot).not.toBe(primary?.canonicalRoot);
  expect(feature?.git?.linkedWorktree).toBe(true);
  expect(primary?.git?.linkedWorktree).toBe(false);
  expect(feature?.git?.status).toContain(".rill/project.json");
  expect(feature?.classification).toBe("enrolled");
  expect(
    JSON.parse(readFileSync(join(root, ".rill", "project.json"), "utf8"))
      .standard.version,
  ).toBe("0.1.3");
  expect(readFileSync(join(worktree, ".rill", "project.json"), "utf8")).toBe(
    localConfig,
  );
});

test("discovers every linked worktree from the registered primary root", () => {
  const root = gitProject("registered-primary");
  mkdirSync(join(root, ".rill"), { recursive: true });
  const primaryConfig = JSON.stringify({
    schemaVersion: 2,
    repository: "owner/shared",
    standard: { version: "1.0.0", digest: "a".repeat(64) },
  });
  writeFileSync(join(root, ".rill", "project.json"), primaryConfig);
  execFileSync("git", ["-C", root, "add", ".rill/project.json"]);
  execFileSync("git", [
    "-C",
    root,
    "commit",
    "--quiet",
    "-m",
    "enroll primary",
  ]);
  execFileSync("git", ["-C", root, "branch", "linked-worktree"]);
  const worktree = join(root, "..", "linked-worktree");
  execFileSync("git", [
    "-C",
    root,
    "worktree",
    "add",
    "--quiet",
    worktree,
    "linked-worktree",
  ]);
  const worktreeConfig = JSON.stringify({
    schemaVersion: 2,
    repository: "owner/shared",
    standard: { version: "1.1.0", digest: "b".repeat(64) },
  });
  writeFileSync(join(worktree, ".rill", "project.json"), worktreeConfig);

  const result = inventory(
    {
      registeredProjects: [{ name: "registered-primary", path: root }],
      explicitRoots: [],
      runtimeFacts,
    },
    { resolveProject: resolver },
  );

  expect(result.entries).toHaveLength(2);
  expect(result.coverage.gapCount).toBe(0);
  expect(result.entries.map((entry) => entry.canonicalRoot)).toContain(root);
  expect(result.entries.map((entry) => entry.canonicalRoot)).toContain(
    worktree,
  );
  expect(
    result.entries.find((entry) => entry.canonicalRoot === worktree)?.sources,
  ).toEqual(["worktree"]);
  expect(readFileSync(join(worktree, ".rill/project.json"), "utf8")).toBe(
    worktreeConfig,
  );
});

test("rejects a committed metadata-directory symlink that escapes the project root", () => {
  const root = gitProject("metadata-symlink");
  const outsideMetadata = join(root, "..", "external-metadata");
  mkdirSync(outsideMetadata);
  writeFileSync(
    join(outsideMetadata, "project.json"),
    JSON.stringify({
      schemaVersion: 2,
      repository: "owner/external",
      standard: { version: "1.0.0", digest: "a".repeat(64) },
    }),
  );
  symlinkSync(outsideMetadata, join(root, ".rill"), "dir");
  execFileSync("git", ["-C", root, "add", ".rill"]);
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "metadata link"]);

  const result = inventory(
    {
      registeredProjects: [{ name: "metadata-symlink", path: root }],
      explicitRoots: [],
      runtimeFacts,
    },
    { resolveProject: resolver },
  );

  expect(result.entries[0]?.classification).toBe("invalid");
  expect(result.coverage.gapCount).toBe(1);
  expect(result.entries[0]?.issues.join(" ")).toMatch(/symlink|symbolic/i);
});

test("reports project states and never treats trust paths as enrollment", () => {
  const legacy = gitProject("legacy");
  const disabled = gitProject("disabled");
  const unenrolled = gitProject("unenrolled");
  const unsupported = gitProject("unsupported");
  for (const root of [legacy, disabled, unsupported])
    mkdirSync(join(root, ".rill"), { recursive: true });
  writeFileSync(
    join(legacy, ".rill", "project.json"),
    JSON.stringify({ schemaVersion: 1, repository: "owner/legacy" }),
  );
  writeFileSync(
    join(disabled, ".rill", "project.disabled.json"),
    JSON.stringify({ schemaVersion: 1, repository: "owner/disabled" }),
  );
  writeFileSync(
    join(unsupported, ".rill", "project.json"),
    JSON.stringify({ schemaVersion: 2, repository: "owner/unsupported" }),
  );
  const nonGit = join(mkdtempSync(join(tmpdir(), "rill-non-git-")), "plain");
  directories.push(nonGit.slice(0, nonGit.lastIndexOf("/")));
  mkdirSync(nonGit);
  const missing = join(nonGit, "missing");

  const result = inventory(
    {
      registeredProjects: [
        { name: "trusted-only", path: unenrolled, trustPath: legacy },
      ],
      explicitRoots: [legacy, disabled, unsupported, nonGit, missing],
      runtimeFacts,
    },
    { resolveProject: resolver },
  );
  const classification = (root: string) =>
    result.entries.find((entry) => entry.aliases.includes(root))
      ?.classification;

  expect(classification(legacy)).toBe("legacy");
  expect(classification(disabled)).toBe("disabled");
  expect(classification(unenrolled)).toBe("unenrolled");
  expect(classification(unsupported)).toBe("unsupported");
  expect(classification(nonGit)).toBe("nonGit");
  expect(classification(missing)).toBe("missing");
  expect(
    result.entries.find((entry) => entry.names.includes("trusted-only"))
      ?.classification,
  ).toBe("unenrolled");
  expect(result.coverage.gaps.map((gap) => gap.classification)).toContain(
    "missing",
  );
});

test("retains inaccessible roots as coverage gaps instead of silently dropping them", () => {
  const path = join(tmpdir(), "inaccessible-rill-project");
  const result = inventory(
    {
      registeredProjects: [{ name: "blocked", path }],
      explicitRoots: [],
      runtimeFacts,
    },
    {
      resolveProject: resolver,
      realpath: (candidate) => {
        if (candidate === path)
          throw Object.assign(new Error("denied"), { code: "EACCES" });
        return realpathSync(candidate);
      },
    },
  );
  expect(result.entries[0]?.classification).toBe("inaccessible");
  expect(result.coverage.gaps).toContainEqual(
    expect.objectContaining({
      name: "blocked",
      classification: "inaccessible",
    }),
  );
});
