import { spawnSync } from "node:child_process";
import { applyBinding, type BindingPlan, bindingPlan } from "./quality-binding.js";
import { runProfileMetrics } from "./quality-proposed.js";
import type {
  CommandOutcome,
  GateResult,
  GateStatus,
  QualityCommandDependencies,
  QualityCommandInput,
  QualityResult,
} from "./quality-state.js";
import { baseResult, digest, projectFacts, QualityCommandError } from "./quality-state.js";

export const GATES = {
  lint: ["just", "lint"],
  "secret-scan": ["just", "secret-scan"],
  quality: ["just", "quality"],
  "full-spec-ci": ["just", "full-spec-ci"],
} as const;

type GateId = keyof typeof GATES;

function defaultRunCommand(cwd: string, argv: string[]): CommandOutcome {
  const started = performance.now();
  const result = spawnSync(argv[0] ?? "", argv.slice(1), {
    cwd,
    shell: false,
    encoding: "utf8",
    timeout: 30 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });
  const error = result.error?.message ?? null;
  return {
    exitCode: result.status,
    signal: result.signal,
    error:
      error ??
      (performance.now() - started >= 30 * 60 * 1000 ? "Command exceeded 30 minute limit." : null),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function nativeRecipeNames(root: string): Set<string> {
  const result = spawnSync("just", ["--summary"], {
    cwd: root,
    shell: false,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) return new Set();
  return new Set(result.stdout.trim().split(/\s+/).filter(Boolean));
}

function preferredBaselineGate(root: string) {
  const native = nativeRecipeNames(root);
  if (native.has("full-spec-ci")) return "full-spec-ci";
  if (native.has("quality")) return "quality";
  return null;
}

function runGate(
  result: QualityResult,
  id: string,
  dependencies: QualityCommandDependencies,
): GateResult {
  if (!Object.hasOwn(GATES, id)) throw new QualityCommandError(`Unknown gate: ${id}`, 64);
  const gateId = id as GateId;
  if (!nativeRecipeNames(result.projectRoot).has(gateId)) {
    return blockedGate(id, result.projectRoot, "Native Just gate is not declared.");
  }
  const argv = [...GATES[gateId]];
  const started = performance.now();
  const outcome = (dependencies.runCommand ?? defaultRunCommand)(result.projectRoot, argv, {
    shell: false,
  });
  const durationMs = Math.round(performance.now() - started);
  const observed = projectFacts(result.projectRoot);
  const candidateChanged =
    observed.revision !== result.revision ||
    observed.workingTree.contentSha256 !== result.workingTree.contentSha256;
  const status: GateStatus =
    outcome.error || candidateChanged ? "blocked" : outcome.exitCode === 0 ? "pass" : "fail";
  return {
    id,
    status,
    command: argv,
    cwd: result.projectRoot,
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    durationMs,
    stdoutSha256: digest(outcome.stdout),
    stderrSha256: digest(outcome.stderr),
    reason:
      outcome.error ??
      (candidateChanged ? "Project candidate changed while gate was running." : null),
  };
}

function blockedGate(id: string, projectRoot: string, reason: string): GateResult {
  return {
    id,
    status: "blocked",
    command: null,
    cwd: projectRoot,
    exitCode: null,
    signal: null,
    durationMs: null,
    stdoutSha256: null,
    stderrSha256: null,
    reason,
  };
}

function nativeAuditResult(
  result: QualityResult,
  gate: "quality" | "full-spec-ci",
  execute: boolean,
  dependencies: QualityCommandDependencies,
): GateResult {
  if (execute) return runGate(result, gate, dependencies);
  return {
    ...blockedGate(gate, result.projectRoot, "Preview only; pass --execute."),
    status: "unknown",
    command: [...GATES[gate]],
  };
}

function appendProposedMetrics(
  result: QualityResult,
  execute: boolean,
  dependencies: QualityCommandDependencies,
) {
  if (!result.standardDigest) return;
  result.gateResults.push(
    execute
      ? runProfileMetrics(result, dependencies)
      : {
          ...blockedGate("profile-metrics", result.projectRoot, "Preview only; pass --execute."),
          status: "unknown",
        },
  );
}

function handleAudit(
  result: QualityResult,
  input: Extract<QualityCommandInput, { operation: "audit" }>,
  dependencies: QualityCommandDependencies,
) {
  if (input.mode && !["baseline", "proposed"].includes(input.mode)) {
    throw new QualityCommandError("Unknown audit mode: " + input.mode, 64);
  }
  if (
    input.execute &&
    (dependencies.mcpReadOnly || (input.mode === "proposed" && !result.standardDigest))
  ) {
    result.gateResults = [
      blockedGate(
        "quality",
        result.projectRoot,
        dependencies.mcpReadOnly
          ? "MCP is read-only; use the native local CLI to execute gates."
          : "Proposed audit execution requires an owner-approved profile.",
      ),
    ];
    result.nextActions = ["Obtain an approved profile before executing proposed checks."];
    return;
  }
  const gate = preferredBaselineGate(result.projectRoot);
  if (!gate) {
    result.gateResults = [
      blockedGate(
        "full-spec-ci",
        result.projectRoot,
        "No native full-spec-ci or quality Just recipe is declared.",
      ),
    ];
    return;
  }
  result.gateResults = [nativeAuditResult(result, gate, !!input.execute, dependencies)];
  if (input.mode === "proposed") {
    appendProposedMetrics(result, !!input.execute, dependencies);
  }
  result.nextActions = input.execute
    ? ["Review actual gate result; it does not certify profile coverage."]
    : ["Review the project-native gate before explicitly executing it."];
}

function handlePlan(
  result: QualityResult,
  input: Extract<QualityCommandInput, { operation: "plan" }>,
) {
  if (!input.release) throw new QualityCommandError("A release is required", 64);
  const plan = bindingPlan(
    result.projectRoot,
    result.revision ?? "",
    input.release,
    result.workingTree,
  );
  result.plan = plan;
  result.standardDigest = plan.releaseDigest;
  result.nextActions =
    plan.status === "ready"
      ? ["Review exact change digest before explicit local CLI application."]
      : [plan.reason ?? "The profile plan is not ready."];
}

function rejectSetup(result: QualityResult, reason: string) {
  result.execution = { started: false, error: reason };
  result.nextActions = ["Resolve the plan conflict or use local CLI after review."];
}

function applySetup(
  result: QualityResult,
  input: Extract<QualityCommandInput, { operation: "setup" }>,
  plan: BindingPlan,
) {
  try {
    if (!applyBinding(result.projectRoot, plan, input.release)) {
      rejectSetup(result, "Binding target was not writable; nothing applied.");
      return;
    }
    Object.assign(result, baseResult(input.operation, result.projectRoot));
    result.execution = { started: true, error: null };
    result.externalRequirements = [];
    result.nextActions = [
      "Binding recorded; install and validate project-specific gates before feature work.",
    ];
  } catch (error) {
    rejectSetup(result, error instanceof Error ? error.message : "Profile apply failed.");
  }
}

function handleSetup(
  result: QualityResult,
  input: Extract<QualityCommandInput, { operation: "setup" }>,
  dependencies: QualityCommandDependencies,
) {
  const plan = bindingPlan(
    result.projectRoot,
    result.revision ?? "",
    input.release,
    result.workingTree,
  );
  result.plan = plan;
  if (!dependencies.allowLocalApply || dependencies.mcpReadOnly) {
    rejectSetup(result, "MCP is read-only; use the native local CLI with --apply.");
    return;
  }
  if (plan.status === "ready" && plan.planId === input.planId) {
    applySetup(result, input, plan);
    result.plan = plan;
    return;
  }
  result.plan.status = "conflict";
  result.conflicts.push({
    code: "stale-plan",
    status: "blocked",
    sources: [result.projectRoot],
    reason: "The reviewed plan is stale or its target conflicts with existing files.",
  });
  rejectSetup(result, "Plan or target changed; nothing applied.");
}

function handleRun(
  result: QualityResult,
  input: Extract<QualityCommandInput, { operation: "run" }>,
  dependencies: QualityCommandDependencies,
) {
  if (dependencies.mcpReadOnly) {
    result.gateResults = [
      blockedGate(
        input.gate,
        result.projectRoot,
        "MCP is read-only; run gates through the native local CLI.",
      ),
    ];
    return;
  }
  result.gateResults = [runGate(result, input.gate, dependencies)];
  result.nextActions =
    result.gateResults[0]?.status === "pass"
      ? ["Review gate evidence and profile coverage separately."]
      : ["Inspect the failing or blocked gate before claiming readiness."];
}

export function runQualityCommand(
  input: QualityCommandInput,
  dependencies: QualityCommandDependencies = {},
): QualityResult {
  const result = baseResult(input.operation, input.root);
  switch (input.operation) {
    case "profile":
      result.nextActions = ["Review markers and bind verified profile before claiming coverage."];
      break;
    case "audit":
      handleAudit(result, input, dependencies);
      break;
    case "conflicts":
      break;
    case "debt":
      if (input.action === "show" && !input.findingId)
        throw new QualityCommandError("debt show requires a finding ID", 64);
      result.nextActions = ["Bind an authoritative debt source; never infer findings."];
      break;
    case "plan":
      handlePlan(result, input);
      break;
    case "setup":
      handleSetup(result, input, dependencies);
      break;
    case "run":
      handleRun(result, input, dependencies);
      break;
    case "status":
    case "readiness":
      result.nextActions = ["Verify applicable gates before readiness can advance."];
      break;
    case "reconcile":
      result.nextActions = ["No managed baseline available; reconciliation is unknown."];
      break;
  }
  return result;
}
