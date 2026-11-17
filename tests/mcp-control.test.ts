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
});
