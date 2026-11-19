import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { buildStandardRelease } from "../tools/standard-release-build.ts";

const roots: string[] = [];
const fixedSources = [
  "skills/rill-preferences/references/personal-policy.md",
  "skills/rill-preferences/references/shared-entry.md",
  ".codex/agents/default.toml",
  ".codex/agents/explorer.toml",
  ".codex/agents/reviewer.toml",
  ".codex/agents/risk-reviewer.toml",
  ".codex/agents/worker.toml",
  "hooks/hooks.json",
  ".mcp.json",
];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "rill-standard-build-"));
  roots.push(root);
  return root;
}

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function sourceFixture() {
  const sourceRoot = join(temporaryRoot(), "source");
  mkdirSync(sourceRoot, { recursive: true });
  for (const file of fixedSources) {
    const destination = join(sourceRoot, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(process.cwd(), file), destination);
  }
  git(sourceRoot, "init", "-q");
  git(sourceRoot, "config", "user.name", "Rill fixture");
  git(sourceRoot, "config", "user.email", "rill-fixture@example.invalid");
  git(sourceRoot, "add", ...fixedSources);
  git(
    sourceRoot,
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "standard fixture",
  );
  return { sourceRoot, revision: git(sourceRoot, "rev-parse", "HEAD") };
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("builds an immutable release with the fixed Rill sources and accepts an identical rebuild", () => {
  const root = temporaryRoot();
  const { sourceRoot, revision } = sourceFixture();
  const artifactRoot = join(root, "artifacts");
  const request = {
    version: "0.2.0-rc.1",
    sourceRoot,
    artifactRoot,
    runtimeVersions: ["0.2.0-rc.1"],
  };
  const first = buildStandardRelease(request);
  expect(first).toMatchObject({
    sourceRevision: revision,
    sourceTreeState: "clean",
    created: true,
    release: {
      manifest: {
        policyEntry: "policy/shared-entry.md",
        nativeEntries: { hooks: ["hooks/hooks.json"], mcp: [".mcp.json"] },
        runtimeVersions: ["0.2.0-rc.1"],
      },
    },
  });
  expect(first.release.manifest.files).toHaveLength(fixedSources.length);
  const second = buildStandardRelease(request);
  expect(second.created).toBe(false);
  expect(second.release.manifestDigest).toBe(first.release.manifestDigest);

  const standard = readFileSync(
    join(first.release.artifactDirectory, "policy/personal-policy.md"),
  );
  expect(createHash("sha256").update(standard).digest("hex")).toBe(
    first.release.manifest.files.find(
      (file) => file.path === "policy/personal-policy.md",
    )?.sha256,
  );
});

test("reports dirty source state and refuses to replace a tampered existing release", () => {
  const root = temporaryRoot();
  const { sourceRoot, revision } = sourceFixture();
  writeFileSync(
    join(sourceRoot, "skills/rill-preferences/references/personal-policy.md"),
    "dirty source\n",
    { flag: "a" },
  );
  const artifactRoot = join(root, "artifacts");
  const result = buildStandardRelease({
    version: "0.2.0-rc.1",
    sourceRoot,
    artifactRoot,
    sourceRevision: revision,
    runtimeVersions: ["0.2.0-rc.1"],
  });
  expect(result.sourceTreeState).toBe("dirty");
  writeFileSync(
    join(result.release.artifactDirectory, "policy/shared-entry.md"),
    "tampered release\n",
  );
  expect(() =>
    buildStandardRelease({
      version: "0.2.0-rc.1",
      sourceRoot,
      artifactRoot,
      sourceRevision: revision,
      runtimeVersions: ["0.2.0-rc.1"],
    }),
  ).toThrow(/Refusing to overwrite/);
});

test("aborts if a fixed source changes after the initial Git status scan", () => {
  const root = temporaryRoot();
  const { sourceRoot } = sourceFixture();
  const artifactRoot = join(root, "artifacts");
  const wrapperDirectory = join(root, "bin");
  mkdirSync(wrapperDirectory);
  const wrapper = join(wrapperDirectory, "git");
  const marker = join(root, "git-status-ran");
  const policyPath = join(
    sourceRoot,
    "skills/rill-preferences/references/personal-policy.md",
  );
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  writeFileSync(
    wrapper,
    `#!/bin/sh\n"${realGit}" "$@"\nstatus=$?\nif [ "$1" = "status" ] && [ ! -e "$RILL_TEST_MARKER" ]; then\n  : > "$RILL_TEST_MARKER"\n  printf '\\n# changed after status scan\\n' >> "$RILL_TEST_POLICY_PATH"\nfi\nexit "$status"\n`,
  );
  chmodSync(wrapper, 0o755);
  vi.stubEnv("PATH", `${wrapperDirectory}:${process.env.PATH ?? ""}`);
  vi.stubEnv("RILL_TEST_MARKER", marker);
  vi.stubEnv("RILL_TEST_POLICY_PATH", policyPath);
  expect(() =>
    buildStandardRelease({
      version: "0.2.0-rc.1",
      sourceRoot,
      artifactRoot,
      runtimeVersions: ["0.2.0-rc.1"],
    }),
  ).toThrow(/Source changed during standard build/);
  expect(existsSync(join(artifactRoot, "0.2.0-rc.1"))).toBe(false);
});
