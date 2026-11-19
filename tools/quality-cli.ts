#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  applyBinding,
  bindingPlan,
  readBoundProfile,
} from "./quality-binding.js";

const GATES = {
  lint: ["mise", "exec", "--locked", "just", "--", "just", "lint"],
  "secret-scan": [
    "mise",
    "exec",
    "--locked",
    "just",
    "--",
    "just",
    "secret-scan",
  ],
  quality: ["mise", "exec", "--locked", "just", "--", "just", "quality"],
} as const;

type GateId = keyof typeof GATES;
type GateStatus = "pass" | "fail" | "blocked" | "unknown" | "not-applicable";

export type QualityCommandInput =
  | {
      operation: "profile" | "conflicts" | "status" | "readiness" | "reconcile";
      root: string;
    }
  | {
      operation: "audit";
      root: string;
      mode?: "baseline" | "proposed";
      execute?: boolean;
    }
  | { operation: "run"; root: string; gate: string }
  | { operation: "plan"; root: string; release?: string }
  | { operation: "setup"; root: string; planId?: string; release: string }
  | {
      operation: "debt";
      root: string;
      action?: "list" | "show";
      findingId?: string;
    };

export interface GateResult {
  id: string;
  status: GateStatus;
  command: string[] | null;
  cwd: string;
  exitCode: number | null;
  signal: string | null;
  durationMs: number | null;
  stdoutSha256: string | null;
  stderrSha256: string | null;
  reason: string | null;
}

export interface QualityResult {
  schemaVersion: 1;
  operation: string;
  projectRoot: string;
  revision: string | null;
  workingTree: {
    state: "clean" | "dirty" | "unknown";
    changedFiles: number | null;
    untrackedFiles: number | null;
  };
  standardDigest: string | null;
  profileDigest: string | null;
  toolVersions: Record<string, string | null>;
  gateResults: GateResult[];
  coverage: { status: GateStatus; knownRoots: string[]; unknowns: string[] };
  conflicts: Array<{
    code: string;
    status: GateStatus;
    sources: string[];
    reason: string;
  }>;
  debt: { status: GateStatus; findings: Array<{ id: string; status: string }> };
  externalRequirements: Array<{
    id: string;
    status: GateStatus;
    reason: string;
  }>;
  readiness: { state: string; ready: boolean; blockers: string[] };
  nextActions: string[];
  plan?: {
    planId: string;
    status: "blocked" | "ready" | "conflict";
    changes: unknown[];
  };
  execution?: { started: boolean; error: string | null };
}

interface CommandOutcome {
  exitCode: number | null;
  signal: string | null;
  error: string | null;
  stdout: string;
  stderr: string;
}

export interface QualityCommandDependencies {
  runCommand?: (
    cwd: string,
    argv: string[],
    options: { shell: false },
  ) => CommandOutcome;
  allowLocalApply?: boolean;
  mcpReadOnly?: boolean;
}

export class QualityCommandError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = "QualityCommandError";
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new QualityCommandError(`Not a readable Git project: ${root}`, 64);
  }
}

function projectFacts(requestedRoot: string) {
  if (!requestedRoot || !resolve(requestedRoot)) {
    throw new QualityCommandError("An explicit project root is required", 64);
  }
  let realRequestedRoot: string;
  try {
    realRequestedRoot = realpathSync(requestedRoot);
  } catch {
    throw new QualityCommandError(
      `Project root does not exist: ${requestedRoot}`,
      64,
    );
  }
  const projectRoot = runGit(realRequestedRoot, [
    "rev-parse",
    "--show-toplevel",
  ]);
  const revision = runGit(projectRoot, ["rev-parse", "HEAD"]);
  const status = runGit(projectRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const records = status.split("\0").filter(Boolean);
  const untrackedFiles = records.filter((item) =>
    item.startsWith("?? "),
  ).length;
  const changedFiles = records.length;
  return {
    projectRoot: realpathSync(projectRoot),
    revision,
    workingTree: {
      state: changedFiles === 0 ? ("clean" as const) : ("dirty" as const),
      changedFiles,
      untrackedFiles,
    },
  };
}

function baseResult(operation: string, root: string): QualityResult {
  const facts = projectFacts(root);
  const markers = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"]
    .filter((name) => existsSync(resolve(facts.projectRoot, name)))
    .map((name) => resolve(facts.projectRoot, name));
  const binding = readBoundProfile(facts.projectRoot);
  const result: QualityResult = {
    schemaVersion: 1,
    operation,
    ...facts,
    standardDigest: null,
    profileDigest: null,
    toolVersions: { node: process.version, pnpm: null, mise: null },
    gateResults: [],
    coverage: {
      status: "unknown",
      knownRoots: markers,
      unknowns: [
        "No verified immutable quality profile is available for this project.",
      ],
    },
    conflicts: [
      {
        code: "profile-unavailable",
        status: "blocked",
        sources: markers,
        reason:
          "The installed standard/profile cannot be verified, so rule and file conflicts are unknown.",
      },
    ],
    debt: { status: "unknown", findings: [] },
    externalRequirements: [
      {
        id: "native-approval",
        status: "blocked",
        reason:
          "This CLI has no native approval adapter; setup cannot apply changes.",
      },
    ],
    readiness: {
      state: "unprofiled",
      ready: false,
      blockers: [
        "No verified immutable standard/profile is bound to this project.",
      ],
    },
    nextActions: [
      "Review and bind an owner-approved immutable quality profile before planning setup.",
    ],
  };
  if (binding?.valid && binding.bound) {
    result.standardDigest = binding.bound.standardDigest;
    result.profileDigest = binding.digest;
    result.conflicts = [];
    result.coverage.unknowns = [
      "Binding recorded; effective gate coverage is not yet verified.",
    ];
    result.readiness.state = "profiled-unverified";
    result.readiness.blockers = [
      "No verified full-spec gate receipt for this project revision.",
    ];
    result.nextActions = [
      "Install and validate project-specific gates before claiming readiness.",
    ];
  } else if (binding) {
    result.conflicts[0] = {
      code: "binding-invalid",
      status: "blocked",
      sources: [resolve(facts.projectRoot, ".quality-standard/profile.json")],
      reason: "Profile content or its release digest is invalid.",
    };
    result.readiness.state = "profile-conflict";
  }
  return result;
}

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
      (performance.now() - started >= 30 * 60 * 1000
        ? "Command exceeded 30 minute limit."
        : null),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runGate(
  result: QualityResult,
  id: string,
  dependencies: QualityCommandDependencies,
): GateResult {
  if (!Object.hasOwn(GATES, id))
    throw new QualityCommandError(`Unknown gate: ${id}`, 64);
  const gateId = id as GateId;
  const argv = [...GATES[gateId]];
  const started = performance.now();
  const outcome = (dependencies.runCommand ?? defaultRunCommand)(
    result.projectRoot,
    argv,
    { shell: false },
  );
  const durationMs = Math.round(performance.now() - started);
  const status: GateStatus = outcome.error
    ? "blocked"
    : outcome.exitCode === 0
      ? "pass"
      : "fail";
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
    reason: outcome.error ?? null,
  };
}

export function runQualityCommand(
  input: QualityCommandInput,
  dependencies: QualityCommandDependencies = {},
): QualityResult {
  const result = baseResult(input.operation, input.root);

  switch (input.operation) {
    case "profile":
      result.nextActions = [
        "Review detected project markers and provide a verified profile before relying on coverage.",
      ];
      break;
    case "audit":
      if (input.mode && !["baseline", "proposed"].includes(input.mode)) {
        throw new QualityCommandError(`Unknown audit mode: ${input.mode}`, 64);
      }
      if (
        (input.mode === "proposed" || dependencies.mcpReadOnly) &&
        input.execute
      ) {
        result.gateResults = [
          {
            id: "quality",
            status: "blocked",
            command: null,
            cwd: result.projectRoot,
            exitCode: null,
            signal: null,
            durationMs: null,
            stdoutSha256: null,
            stderrSha256: null,
            reason: dependencies.mcpReadOnly
              ? "MCP is read-only; use the native local CLI to execute gates."
              : "Proposed audit execution requires an owner-approved profile and is unavailable here.",
          },
        ];
        result.nextActions = [
          "Obtain an approved profile before executing proposed checks.",
        ];
        break;
      }
      result.gateResults = input.execute
        ? [runGate(result, "quality", dependencies)]
        : [
            {
              id: "quality",
              status: "unknown",
              command: [...GATES.quality],
              cwd: result.projectRoot,
              exitCode: null,
              signal: null,
              durationMs: null,
              stdoutSha256: null,
              stderrSha256: null,
              reason:
                "Audit preview does not execute gates; pass --execute to run the declared quality command.",
            },
          ];
      result.nextActions = input.execute
        ? [
            "Review the captured gate result; baseline does not imply profile coverage.",
          ]
        : [
            "Use --execute to run the fixed project-native quality gate after confirming that is intended.",
          ];
      break;
    case "conflicts":
      break;
    case "debt":
      if (input.action === "show" && !input.findingId)
        throw new QualityCommandError("debt show requires a finding ID", 64);
      result.debt.status = "unknown";
      result.nextActions = [
        "Bind an authoritative profile and debt source; no findings are inferred from missing data.",
      ];
      break;
    case "plan": {
      if (!input.release)
        throw new QualityCommandError("A release is required", 64);
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
          ? [
              "Review the exact change digest, then explicitly apply the plan through the local CLI.",
            ]
          : [plan.reason ?? "The profile plan is not ready."];
      break;
    }
    case "setup": {
      const plan = bindingPlan(
        result.projectRoot,
        result.revision ?? "",
        input.release,
        result.workingTree,
      );
      result.plan = plan;
      if (!dependencies.allowLocalApply || dependencies.mcpReadOnly) {
        result.execution = {
          started: false,
          error:
            "MCP is read-only; use the native local CLI with --apply after reviewing a fresh plan.",
        };
      } else if (plan.status !== "ready" || plan.planId !== input.planId) {
        result.plan.status = "conflict";
        result.conflicts.push({
          code: "stale-plan",
          status: "blocked",
          sources: [result.projectRoot],
          reason:
            "The reviewed plan is stale or its target conflicts with existing files.",
        });
        result.execution = {
          started: false,
          error: "Plan or target changed; nothing applied.",
        };
      } else {
        try {
          applyBinding(result.projectRoot, plan, input.release);
          Object.assign(
            result,
            baseResult(input.operation, result.projectRoot),
          );
          result.plan = plan;
          result.execution = { started: true, error: null };
          result.externalRequirements = [];
        } catch (error) {
          result.execution = {
            started: false,
            error:
              error instanceof Error ? error.message : "Profile apply failed.",
          };
        }
      }
      result.nextActions = result.execution?.started
        ? [
            "Binding recorded; install and validate all applicable gates before functional work.",
          ]
        : [
            "Resolve the plan conflict or use the native local CLI after explicit review.",
          ];
      break;
    }
    case "run": {
      if (dependencies.mcpReadOnly) {
        result.gateResults = [
          {
            id: input.gate,
            status: "blocked",
            command: null,
            cwd: result.projectRoot,
            exitCode: null,
            signal: null,
            durationMs: null,
            stdoutSha256: null,
            stderrSha256: null,
            reason: "MCP is read-only; run gates through the native local CLI.",
          },
        ];
        break;
      }
      result.gateResults = [runGate(result, input.gate, dependencies)];
      result.nextActions =
        result.gateResults[0]?.status === "pass"
          ? ["Review gate evidence and profile coverage separately."]
          : ["Inspect the failing or blocked gate before claiming readiness."];
      break;
    }
    case "status":
    case "readiness":
      result.nextActions = [
        "Bind a verified immutable profile before readiness can advance.",
      ];
      break;
    case "reconcile":
      result.nextActions = [
        "No managed baseline is available; reconcile remains unknown until a profile is bound.",
      ];
      break;
  }
  return result;
}

function parseArgs(args: string[]): {
  input: QualityCommandInput;
  format: "json" | "text";
} {
  const [operationRaw, ...rest] = args;
  if (!operationRaw) throw new QualityCommandError("Expected an operation", 64);
  if (operationRaw === "mcp")
    throw new QualityCommandError("MCP mode is not a CLI operation", 64);
  const values = new Map<string, string>();
  let execute = false;
  let apply = false;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (!argument?.startsWith("--")) {
      if (operationRaw === "debt" && !values.has("action")) {
        values.set("action", argument ?? "");
        continue;
      }
      if (operationRaw === "debt" && !values.has("findingId")) {
        values.set("findingId", argument ?? "");
        continue;
      }
      throw new QualityCommandError(`Unexpected argument: ${argument}`, 64);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--"))
      throw new QualityCommandError(`Missing value for ${argument}`, 64);
    values.set(argument.slice(2), value);
    index += 1;
  }
  const root = values.get("root");
  if (!root) throw new QualityCommandError("--root is required", 64);
  const format = values.get("format") ?? "json";
  if (format !== "json" && format !== "text")
    throw new QualityCommandError("--format must be json or text", 64);
  let input: QualityCommandInput;
  switch (operationRaw) {
    case "profile":
    case "conflicts":
    case "status":
    case "readiness":
    case "reconcile":
      input = { operation: operationRaw, root };
      break;
    case "audit":
      input = {
        operation: "audit",
        root,
        mode: values.get("mode") as "baseline" | "proposed" | undefined,
        execute,
      };
      break;
    case "run":
      input = { operation: "run", root, gate: values.get("gate") ?? "" };
      break;
    case "plan":
      if (!values.has("release"))
        throw new QualityCommandError("plan requires --release", 64);
      input = { operation: "plan", root, release: values.get("release") };
      break;
    case "setup":
      if (!values.has("plan") || !values.has("release"))
        throw new QualityCommandError(
          "setup requires --plan and --release",
          64,
        );
      if (!apply) throw new QualityCommandError("setup requires --apply", 64);
      input = {
        operation: "setup",
        root,
        planId: values.get("plan"),
        release: values.get("release") ?? "",
      };
      break;
    case "debt": {
      const action = values.get("action") ?? "list";
      if (action !== "list" && action !== "show")
        throw new QualityCommandError("debt action must be list or show", 64);
      input = {
        operation: "debt",
        root,
        action,
        findingId: values.get("findingId"),
      };
      break;
    }
    default:
      throw new QualityCommandError(`Unknown operation: ${operationRaw}`, 64);
  }
  return { input, format };
}

function exitFor(result: QualityResult): number {
  if (result.execution?.started === false) return 3;
  if (result.gateResults.some((item) => item.status === "fail")) return 1;
  if (result.gateResults.some((item) => item.status === "blocked")) return 3;
  if (result.readiness.ready) return 0;
  if (["profile", "conflicts", "debt"].includes(result.operation)) return 0;
  if (["plan", "reconcile"].includes(result.operation)) return 3;
  return 1;
}

function mcpResult(result: QualityResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result,
    isError:
      result.execution?.started === false ||
      result.gateResults.some(
        (gate) => gate.status === "fail" || gate.status === "blocked",
      ),
  };
}

export function createQualityMcpServer(): McpServer {
  const server = new McpServer(
    { name: "rill-quality", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  const rootSchema = z.object({ root: z.string().min(1) });
  const register = (
    name: string,
    description: string,
    schema: z.ZodType,
    operation: (args: Record<string, unknown>) => QualityCommandInput,
  ) => {
    server.registerTool(
      name,
      { description, inputSchema: schema },
      async (args) => {
        try {
          return mcpResult(
            runQualityCommand(operation(args as Record<string, unknown>), {
              mcpReadOnly: true,
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unexpected quality command failure";
          return { content: [{ type: "text", text: message }], isError: true };
        }
      },
    );
  };
  register(
    "quality_profile",
    "Read-only project/profile inventory. Never changes project files.",
    rootSchema,
    (args) => ({ operation: "profile", root: String(args.root) }),
  );
  register(
    "quality_audit",
    "Preview the fixed quality gate, or explicitly run the project-native quality gate.",
    rootSchema.extend({
      mode: z.enum(["baseline", "proposed"]).optional(),
      execute: z.boolean().optional(),
    }),
    (args) => ({
      operation: "audit",
      root: String(args.root),
      mode: args.mode as "baseline" | "proposed" | undefined,
      execute: args.execute === true,
    }),
  );
  register(
    "quality_conflicts",
    "Read-only conflict status; unknown profile coverage remains explicit.",
    rootSchema,
    (args) => ({ operation: "conflicts", root: String(args.root) }),
  );
  register(
    "quality_debt",
    "Read-only legacy debt query; missing authoritative data is unknown.",
    rootSchema.extend({
      action: z.enum(["list", "show"]).optional(),
      findingId: z.string().optional(),
    }),
    (args) => ({
      operation: "debt",
      root: String(args.root),
      action: args.action as "list" | "show" | undefined,
      findingId: args.findingId as string | undefined,
    }),
  );
  register(
    "quality_plan",
    "Create a deterministic read-only plan; unavailable profiles block changes.",
    rootSchema.extend({ release: z.string().optional() }),
    (args) => ({
      operation: "plan",
      root: String(args.root),
      release: args.release as string | undefined,
    }),
  );
  register(
    "quality_setup",
    "Setup is blocked unless a verified plan and native approval adapter are available.",
    rootSchema.extend({ planId: z.string().optional() }),
    (args) => ({
      operation: "setup",
      root: String(args.root),
      planId: args.planId as string | undefined,
      release: "",
    }),
  );
  register(
    "quality_run_gate",
    "Run only one fixed named project gate; no caller-supplied argv is accepted.",
    rootSchema.extend({ gate: z.enum(["lint", "secret-scan", "quality"]) }),
    (args) => ({
      operation: "run",
      root: String(args.root),
      gate: String(args.gate),
    }),
  );
  register(
    "quality_status",
    "Read-only current quality status.",
    rootSchema,
    (args) => ({ operation: "status", root: String(args.root) }),
  );
  register(
    "quality_ready",
    "Read-only readiness evaluation; unknown requirements fail closed.",
    rootSchema,
    (args) => ({ operation: "readiness", root: String(args.root) }),
  );
  register(
    "quality_reconcile",
    "Read-only managed-state reconciliation; absent baselines stay unknown.",
    rootSchema,
    (args) => ({ operation: "reconcile", root: String(args.root) }),
  );
  return server;
}

async function main() {
  if (process.argv[2] === "mcp") {
    serveStdio(() => createQualityMcpServer());
    return;
  }
  try {
    const { input, format } = parseArgs(process.argv.slice(2));
    const result = runQualityCommand(input, {
      allowLocalApply: input.operation === "setup",
    });
    if (format === "json") process.stdout.write(`${JSON.stringify(result)}\n`);
    else
      process.stdout.write(
        `${result.operation}: ${result.readiness.state}\n${result.nextActions.map((action) => `- ${action}`).join("\n")}\n`,
      );
    process.exitCode = exitFor(result);
  } catch (error) {
    const exitCode = error instanceof QualityCommandError ? error.exitCode : 70;
    process.stderr.write(
      `${error instanceof Error ? error.message : "Unexpected failure"}\n`,
    );
    process.exitCode = exitCode;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  void main();
