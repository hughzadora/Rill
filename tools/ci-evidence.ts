import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { atomicJson } from "./task-context.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" });

export function candidate(cwd: string) {
  const root = git(cwd, "rev-parse", "--show-toplevel").trim();
  const paths = [
    ...new Set(
      git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
  const digest = createHash("sha256");
  for (const path of paths) {
    digest.update(JSON.stringify(path));
    try {
      const full = join(root, path);
      const stat = lstatSync(full);
      digest.update(String(stat.mode));
      if (stat.isSymbolicLink()) digest.update(readlinkSync(full));
      else if (stat.isFile()) digest.update(readFileSync(full));
      else throw new Error(`Unsupported candidate entry: ${path}`);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        digest.update("deleted");
      else throw error;
    }
  }
  return {
    root,
    revision: git(root, "rev-parse", "--verify", "HEAD").trim(),
    status: git(root, "status", "--porcelain=v1", "--untracked-files=all"),
    contentSha256: digest.digest("hex"),
    mergeBases: git(root, "merge-base", "--all", "HEAD", "main")
      .trim()
      .split("\n"),
    mainRevision: git(root, "rev-parse", "main").trim(),
  };
}

function version(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    command: [command, ...args],
    exitCode: result.status,
    output: result.stdout?.trim(),
    error: result.error?.message ?? null,
  };
}

export function environment() {
  return {
    platform: platform(),
    release: release(),
    arch: arch(),
    node: process.version,
    tools: [
      version("pnpm", ["--version"]),
      version("just", ["--version"]),
      version("git", ["--version"]),
    ],
    // Do not persist process.env: it can contain credentials.
    scope:
      "OS and tool versions; external services and ignored files require separate evidence",
  };
}

export function runEvidence(
  cwd: string,
  command: string[],
  unverified: string[],
) {
  if (!command[0]) throw new Error("A check command is required");
  const before = candidate(cwd);
  const env = environment();
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: before.root,
    stdio: "inherit",
  });
  const after = candidate(cwd);
  const receipt = {
    schemaVersion: 1,
    id: randomUUID(),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: performance.now() - start,
    command,
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    before,
    after,
    environment: env,
    candidateUnchanged: isDeepStrictEqual(before, after),
    unverified,
    acceptance:
      "command-result-only; compare approved acceptance before delivery",
  };
  const path = resolve(
    before.root,
    git(before.root, "rev-parse", "--git-path", "rill-recovery/ci").trim(),
    `${receipt.id}.json`,
  );
  atomicJson(path, receipt);
  return { receipt, path };
}

export function verifyEvidence(cwd: string, path: string) {
  const receipt = JSON.parse(readFileSync(path, "utf8"));
  if (
    receipt.schemaVersion !== 1 ||
    receipt.exitCode !== 0 ||
    receipt.candidateUnchanged !== true ||
    !isDeepStrictEqual(receipt.after, candidate(cwd)) ||
    !isDeepStrictEqual(receipt.environment, environment())
  )
    throw new Error(
      "Evidence failed, changed during execution, or does not match the current candidate/environment",
    );
  return {
    matchingCandidate: true,
    unverified: receipt.unverified,
    acceptance: receipt.acceptance,
  };
}

if (import.meta.main) {
  try {
    if (process.argv[2] === "verify")
      console.log(
        JSON.stringify(verifyEvidence(process.cwd(), process.argv[3] ?? "")),
      );
    else if (process.argv[2] === "run") {
      const { receipt, path } = runEvidence(
        process.cwd(),
        process.argv.slice(3),
        [
          "Approved acceptance mapping and human acceptance require separate verification",
        ],
      );
      console.log(
        JSON.stringify({
          evidence: path,
          exitCode: receipt.exitCode,
          durationMs: receipt.durationMs,
          candidateUnchanged: receipt.candidateUnchanged,
          unverified: receipt.unverified,
        }),
      );
      process.exitCode =
        receipt.exitCode === 0 && receipt.candidateUnchanged ? 0 : 1;
    } else
      throw new Error(
        "Usage: ci-evidence.ts run <command> [args...] | verify <receipt.json>",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
