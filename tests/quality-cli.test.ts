import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, expect, test } from "vitest";
import { runQualityCommand } from "../tools/quality-cli.ts";

const roots: string[] = [];

function gitProject() {
  const root = mkdtempSync(join(tmpdir(), "rill-quality-cli-"));
  roots.push(root);
  writeFileSync(join(root, "README.md"), "fixture\n");
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
  execFileSync("git", [
    "-C",
    root,
    "config",
    "user.email",
    "fixture@example.test",
  ]);
  execFileSync("git", ["-C", root, "config", "user.name", "CLI fixture"]);
  execFileSync("git", ["-C", root, "add", "README.md"]);
  execFileSync("git", [
    "-c",
    "core.hooksPath=/dev/null",
    "-C",
    root,
    "commit",
    "--quiet",
    "-m",
    "fixture",
  ]);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("profile is read-only and reports unprofiled readiness for an unknown project", () => {
  const root = gitProject();
  let executions = 0;

  const result = runQualityCommand(
    { operation: "profile", root },
    {
      runCommand: () => {
        executions += 1;
        throw new Error("unexpected execution");
      },
    },
  );

  expect(result.projectRoot).toBe(root);
  expect(result.standardDigest).toBeNull();
  expect(result.readiness.state).toBe("unprofiled");
  expect(result.readiness.ready).toBe(false);
  expect(executions).toBe(0);
});

test("CLI profile returns a successful read exit and versioned JSON", () => {
  const root = gitProject();
  const result = spawnSync(
    process.execPath,
    [
      resolve("node_modules/tsx/dist/cli.mjs"),
      resolve("tools/quality-cli.ts"),
      "profile",
      "--root",
      root,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    schemaVersion: 1,
    operation: "profile",
    projectRoot: root,
    readiness: { state: "unprofiled", ready: false },
  });
});

test("audit does not run gates unless execution is explicitly requested", () => {
  const root = gitProject();
  const commands: string[][] = [];
  const runCommand = (_cwd: string, argv: string[]) => {
    commands.push(argv);
    return { exitCode: 0, signal: null, error: null, stdout: "ok", stderr: "" };
  };

  const preview = runQualityCommand(
    { operation: "audit", root, mode: "baseline" },
    { runCommand },
  );
  expect(preview.gateResults.every((gate) => gate.status === "unknown")).toBe(
    true,
  );
  expect(commands).toEqual([]);

  const executed = runQualityCommand(
    { operation: "audit", root, mode: "baseline", execute: true },
    { runCommand },
  );
  expect(commands).toEqual([
    ["mise", "exec", "--locked", "just", "--", "just", "quality"],
  ]);
  expect(executed.gateResults[0]?.status).toBe("pass");
  expect(executed.gateResults[0]?.exitCode).toBe(0);
});

test("proposed audit cannot execute without an approved profile", () => {
  const root = gitProject();
  let executions = 0;
  const result = runQualityCommand(
    { operation: "audit", root, mode: "proposed", execute: true },
    {
      runCommand: () => {
        executions += 1;
        throw new Error("unexpected execution");
      },
    },
  );

  expect(result.gateResults[0]?.status).toBe("blocked");
  expect(executions).toBe(0);
});

test("run accepts only the fixed project gate IDs and records argv without a shell", () => {
  const root = gitProject();
  const calls: Array<{ cwd: string; argv: string[] }> = [];
  const runCommand = (
    cwd: string,
    argv: string[],
    options: { shell: false },
  ) => {
    expect(options.shell).toBe(false);
    calls.push({ cwd, argv });
    return {
      exitCode: 2,
      signal: null,
      error: null,
      stdout: "bad",
      stderr: "detail",
    };
  };

  const result = runQualityCommand(
    { operation: "run", root, gate: "lint" },
    { runCommand },
  );
  expect(calls).toEqual([
    {
      cwd: root,
      argv: ["mise", "exec", "--locked", "just", "--", "just", "lint"],
    },
  ]);
  expect(result.gateResults[0]).toMatchObject({
    id: "lint",
    status: "fail",
    exitCode: 2,
    command: calls[0]?.argv,
  });
  expect(JSON.stringify(result)).not.toContain("detail");
  expect(() =>
    runQualityCommand({ operation: "run", root, gate: "../../anything" }),
  ).toThrow(/unknown gate/i);
});

test("a new project can preview and explicitly apply a profile binding", () => {
  const root = gitProject();
  const plan = runQualityCommand({ operation: "plan", root, release: "0.1.0" });

  expect(plan.plan).toMatchObject({
    status: "ready",
    changes: [{ before: null }],
  });
  expect(plan.standardDigest).toMatch(/^[0-9a-f]{64}$/);
  const setup = runQualityCommand(
    {
      operation: "setup",
      root,
      planId: plan.plan?.planId,
      release: "0.1.0",
    },
    { allowLocalApply: true },
  );
  expect(setup.execution).toMatchObject({ started: true, error: null });
  expect(setup.readiness.state).toBe("profiled-unverified");
  expect(setup.readiness.ready).toBe(false);
  expect(
    readFileSync(join(root, ".quality-standard", "profile.json"), "utf8"),
  ).toContain('"release": "0.1.0"');
  expect(readFileSync(join(root, "README.md"), "utf8")).toBe("fixture\n");
});

test("legacy project setup preserves existing marker-directory content", () => {
  const root = gitProject();
  mkdirSync(join(root, ".quality-standard"));
  writeFileSync(
    join(root, ".quality-standard", "legacy.json"),
    "preserve me\n",
  );
  const plan = runQualityCommand({ operation: "plan", root, release: "0.1.0" });

  expect(plan.plan?.status).toBe("ready");
  const setup = runQualityCommand(
    { operation: "setup", root, planId: plan.plan?.planId, release: "0.1.0" },
    { allowLocalApply: true },
  );

  expect(setup.execution?.started).toBe(true);
  expect(
    readFileSync(join(root, ".quality-standard", "legacy.json"), "utf8"),
  ).toBe("preserve me\n");
  expect(
    readFileSync(join(root, ".quality-standard", "profile.json"), "utf8"),
  ).toContain('"release": "0.1.0"');
});

test("setup refuses a profile file that appeared or changed after planning", () => {
  const root = gitProject();
  const plan = runQualityCommand({ operation: "plan", root, release: "0.1.0" });
  mkdirSync(join(root, ".quality-standard"));
  writeFileSync(
    join(root, ".quality-standard", "profile.json"),
    "owner data\n",
  );

  const setup = runQualityCommand(
    { operation: "setup", root, planId: plan.plan?.planId, release: "0.1.0" },
    { allowLocalApply: true },
  );

  expect(setup.plan?.status).toBe("conflict");
  expect(setup.conflicts.map((conflict) => conflict.code)).toContain(
    "stale-plan",
  );
  expect(
    readFileSync(join(root, ".quality-standard", "profile.json"), "utf8"),
  ).toBe("owner data\n");
});

test("official MCP stdio exposes the shared read-only service and blocks setup", async () => {
  const root = gitProject();
  const client = new Client({ name: "quality-cli-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      resolve("node_modules/tsx/dist/cli.mjs"),
      resolve("tools/quality-cli.ts"),
      "mcp",
    ],
    cwd: process.cwd(),
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("quality_profile");
    const result = await client.callTool({
      name: "quality_setup",
      arguments: { root, planId: "unverified" },
    });
    expect(result.isError).toBe(true);
    expect(
      JSON.stringify(result.structuredContent ?? result.content),
    ).toContain("native local CLI");
    const gate = await client.callTool({
      name: "quality_run_gate",
      arguments: { root, gate: "lint" },
    });
    expect(gate.isError).toBe(true);
    expect(JSON.stringify(gate.structuredContent)).toContain(
      "MCP is read-only",
    );
  } finally {
    await client.close();
  }
});
