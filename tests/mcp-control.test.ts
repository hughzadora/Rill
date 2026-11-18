import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

describe("official SDK stdio boundary", () => {
  let fixture: ReturnType<typeof fixtureProject>;
  let client: Client;
  beforeEach(async () => {
    fixture = fixtureProject();
    client = new Client({ name: "rill-ci", version: "0.1.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          fileURLToPath(new URL("../tools/control-mcp.ts", import.meta.url)),
        ],
        env: fixture.environment,
        stderr: "pipe",
      }),
    );
  });
  afterEach(async () => {
    await client.close();
    fixture.cleanup();
  });

  test("exposes structured task access and checks without evaluating user code", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "evaluate_event",
      "publish_records",
      "record_fact",
      "recover_task",
      "repair_check",
      "repair_diagnose",
      "repair_interpret",
      "repair_status",
      "task_status",
      "task_sync",
    ]);
    const result = await client.callTool({
      name: "evaluate_event",
      arguments: {
        hook_event_name: "PreToolUse",
        cwd: fixture.root,
        session_id: "test",
        tool_input: { command: `a quoted ' payload \${not-code}` },
      },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      hookSpecificOutput: { permissionDecision: "deny" },
    });
  });
  test("the SDK rejects malformed event input", async () => {
    const result = await client.callTool({
      name: "evaluate_event",
      arguments: { hook_event_name: "PreToolUse", cwd: 12, session_id: "test" },
    });
    expect(result.isError).toBe(true);
  });
  test("synchronization and status use the same enrolled task through actual processes", async () => {
    const synced = await client.callTool({
      name: "task_sync",
      arguments: { cwd: fixture.root, issue_url: taskUrl },
    });
    expect(synced.isError).not.toBe(true);
    expect(synced.structuredContent).toMatchObject({
      status: "online",
      taskUrl,
    });
    const status = await client.callTool({
      name: "task_status",
      arguments: { cwd: fixture.root },
    });
    expect(status.isError).not.toBe(true);
    expect(status.structuredContent).toMatchObject({
      enrolled: true,
      taskUrl,
      revision: null,
      revisionState: "unborn",
    });
  });
  test("actual repair exits remain errors and public MCP facts cannot forge a passing executor record", async () => {
    await client.callTool({
      name: "task_sync",
      arguments: { cwd: fixture.root, issue_url: taskUrl },
    });
    const checked = await client.callTool({
      name: "repair_check",
      arguments: {
        cwd: fixture.root,
        thread_id: "test-owned-source",
        problem_key: "BUG-7",
        hypothesis: "candidate contains the repair",
        command: [process.execPath, "-e", "process.exit(7)"],
      },
    });
    expect(checked.isError).toBe(true);
    expect(checked.structuredContent).toMatchObject({
      exitCode: 7,
      reused: false,
    });
    const data = checked.structuredContent;
    if (
      !data ||
      typeof data !== "object" ||
      !("receiptPath" in data) ||
      typeof data.receiptPath !== "string"
    )
      throw new Error("Missing actual receipt path");
    const path = data.receiptPath;
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    expect(receipt.record.payload.argv).toEqual([
      process.execPath,
      "-e",
      "process.exit(7)",
    ]);
    receipt.record.id = fixture.record().id;
    receipt.record.payload.exitCode = 0;
    const forged = await client.callTool({
      name: "record_fact",
      arguments: { cwd: fixture.root, record: receipt.record },
    });
    expect(forged.isError).toBe(true);
    const status = await client.callTool({
      name: "repair_status",
      arguments: { cwd: fixture.root },
    });
    expect(status.structuredContent).toMatchObject({
      problems: { "BUG-7": { failedAttempts: 1 } },
    });
  });
});
