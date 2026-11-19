import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  digest,
  type GateResult,
  type GateStatus,
  projectFacts,
  type QualityCommandDependencies,
  type QualityResult,
} from "./quality-state.js";

function defaultProfileCommand(
  cwd: string,
  argv: string[],
  _options: { shell: false },
) {
  void _options;
  const process = spawnSync(argv[0] ?? "", argv.slice(1), {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    exitCode: process.status,
    signal: process.signal,
    error: process.error?.message ?? null,
    stdout: process.stdout ?? "",
    stderr: process.stderr ?? "",
  };
}

export function runProfileMetrics(
  result: QualityResult,
  dependencies: QualityCommandDependencies,
): GateResult {
  const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
  const argv = [
    "just",
    "--justfile",
    resolve(sourceRoot, "justfile"),
    "project-metrics",
    result.projectRoot,
  ];
  const start = performance.now();
  const outcome = (dependencies.runCommand ?? defaultProfileCommand)(
    sourceRoot,
    argv,
    { shell: false },
  );
  const current = projectFacts(result.projectRoot);
  const changed =
    current.revision !== result.revision ||
    current.workingTree.contentSha256 !== result.workingTree.contentSha256;
  const status: GateStatus =
    changed || outcome.error
      ? "blocked"
      : outcome.exitCode === 0
        ? "pass"
        : "fail";
  return {
    id: "profile-metrics",
    status,
    command: argv,
    cwd: sourceRoot,
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    durationMs: Math.round(performance.now() - start),
    stdoutSha256: digest(outcome.stdout),
    stderrSha256: digest(outcome.stderr),
    reason: changed
      ? "Project candidate changed during profile metrics."
      : outcome.error,
  };
}
