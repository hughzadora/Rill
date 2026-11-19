#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { runQualityCommand } from "./quality-runtime.js";
import type { QualityCommandInput, QualityResult } from "./quality-state.js";
import { QualityCommandError } from "./quality-state.js";

export { runQualityCommand } from "./quality-runtime.js";
export { QualityCommandError } from "./quality-state.js";

interface CliOptions {
  values: Map<string, string>;
  execute: boolean;
  apply: boolean;
}

function readCliOptions(operation: string, args: string[]): CliOptions {
  const values = new Map<string, string>();
  let execute = false;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (!argument?.startsWith("--")) {
      if (operation === "debt" && !values.has("action")) {
        values.set("action", argument ?? "");
        continue;
      }
      if (operation === "debt" && !values.has("findingId")) {
        values.set("findingId", argument ?? "");
        continue;
      }
      throw new QualityCommandError("Unexpected argument: " + argument, 64);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new QualityCommandError("Missing value for " + argument, 64);
    values.set(argument.slice(2), value);
    index += 1;
  }
  return { values, execute, apply };
}

function parseDebt(
  root: string,
  values: Map<string, string>,
): QualityCommandInput {
  const action = values.get("action") ?? "list";
  if (action !== "list" && action !== "show")
    throw new QualityCommandError("debt action must be list or show", 64);
  return {
    operation: "debt",
    root,
    action,
    findingId: values.get("findingId"),
  };
}

function parseSetup(root: string, options: CliOptions): QualityCommandInput {
  if (!options.values.has("plan") || !options.values.has("release"))
    throw new QualityCommandError("setup requires --plan and --release", 64);
  if (!options.apply)
    throw new QualityCommandError("setup requires --apply", 64);
  return {
    operation: "setup",
    root,
    planId: options.values.get("plan"),
    release: options.values.get("release") ?? "",
  };
}

function cliInput(
  operation: string,
  root: string,
  options: CliOptions,
): QualityCommandInput {
  const { values, execute } = options;
  switch (operation) {
    case "profile":
    case "conflicts":
    case "status":
    case "readiness":
    case "reconcile":
      return { operation, root };
    case "audit":
      return {
        operation: "audit",
        root,
        mode: values.get("mode") as "baseline" | "proposed" | undefined,
        execute,
      };
    case "run":
      return { operation: "run", root, gate: values.get("gate") ?? "" };
    case "plan":
      if (!values.has("release"))
        throw new QualityCommandError("plan requires --release", 64);
      return { operation: "plan", root, release: values.get("release") };
    case "setup":
      return parseSetup(root, options);
    case "debt":
      return parseDebt(root, values);
    default:
      throw new QualityCommandError("Unknown operation: " + operation, 64);
  }
}

function parseArgs(args: string[]): {
  input: QualityCommandInput;
  format: "json" | "text";
} {
  const [operation, ...rest] = args;
  if (!operation || operation === "mcp")
    throw new QualityCommandError("Expected a CLI operation", 64);
  const options = readCliOptions(operation, rest);
  const root = options.values.get("root");
  if (!root) throw new QualityCommandError("--root is required", 64);
  const format = options.values.get("format") ?? "json";
  if (format !== "json" && format !== "text")
    throw new QualityCommandError("--format must be json or text", 64);
  return { input: cliInput(operation, root, options), format };
}

function exitFor(result: QualityResult): number {
  if (result.execution?.started === false) return 3;
  if (result.execution?.started === true) return 0;
  if (result.operation === "plan" && result.plan?.status === "ready") return 0;
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

type RegisterTool = (
  name: string,
  description: string,
  schema: z.ZodType,
  operation: (args: Record<string, unknown>) => QualityCommandInput,
) => void;

function registration(server: McpServer): RegisterTool {
  return (
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
}

function registerProjectReads(
  register: RegisterTool,
  rootSchema: z.ZodObject<{ root: z.ZodString }>,
) {
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
}

function registerAuditReads(
  register: RegisterTool,
  rootSchema: z.ZodObject<{ root: z.ZodString }>,
) {
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
}

function registerProjectActions(
  register: RegisterTool,
  rootSchema: z.ZodObject<{ root: z.ZodString }>,
) {
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
    rootSchema.extend({
      gate: z.enum(["lint", "secret-scan", "quality", "full-spec-ci"]),
    }),
    (args) => ({
      operation: "run",
      root: String(args.root),
      gate: String(args.gate),
    }),
  );
}

function registerStatusReads(
  register: RegisterTool,
  rootSchema: z.ZodObject<{ root: z.ZodString }>,
) {
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
}

export function createQualityMcpServer(): McpServer {
  const server = new McpServer(
    { name: "rill-quality", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  const rootSchema = z.object({ root: z.string().min(1) });
  const register = registration(server);
  registerProjectReads(register, rootSchema);
  registerAuditReads(register, rootSchema);
  registerProjectActions(register, rootSchema);
  registerStatusReads(register, rootSchema);
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
