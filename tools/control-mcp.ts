import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { evaluateEvent, taskStatus } from "./control-event.ts";
import {
  projectContext,
  publishRecords,
  recordFact,
  syncTask,
} from "./task-context.ts";

const server = new McpServer({ name: "rill-preferences", version: "0.1.0" });
const eventSchema = z
  .object({
    hook_event_name: z.string().min(1),
    cwd: z.string().min(1),
    session_id: z.string().min(1),
    turn_id: z.string().optional(),
    tool_name: z.string().optional(),
    tool_use_id: z.string().optional(),
    tool_input: z.unknown().optional(),
    tool_response: z.unknown().optional(),
    source: z.string().optional(),
    trigger: z.string().optional(),
  })
  .passthrough();
const output = (value: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  structuredContent: value,
});

server.registerTool(
  "evaluate_event",
  {
    description:
      "Check Rill personal task preconditions for a native lifecycle event and return the native hook response. Coverage is reported by task_status; this tool does not define engineering methodology.",
    inputSchema: eventSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async (event) => output(evaluateEvent(event)),
);

server.registerTool(
  "task_status",
  {
    description:
      "Read the enrolled task, pending facts, actual Git state and implemented control coverage.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ cwd }) => output(taskStatus(cwd)),
);

server.registerTool(
  "task_sync",
  {
    description:
      "Synchronize an enrolled GitHub task into its local recovery cache, retaining offline pending facts.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      issue_url: z.string().url(),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, issue_url }) => {
    const result = await syncTask(projectContext(cwd), issue_url);
    return output({
      status: result.status,
      taskUrl: result.snapshot.taskUrl,
      syncedAt: result.snapshot.syncedAt,
    });
  },
);

server.registerTool(
  "record_fact",
  {
    description:
      "Validate and durably retain a task fact in its local outbox; this does not approve requirements or prove a repair.",
    inputSchema: z.object({ cwd: z.string().min(1), record: z.unknown() }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, record }) =>
    output({ record: await recordFact(projectContext(cwd), record) }),
);

server.registerTool(
  "publish_records",
  {
    description:
      "Publish pending facts to the bound GitHub task and verify readback. Use only within the task's external-write authorization.",
    inputSchema: z.object({ cwd: z.string().min(1) }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd }) => output(await publishRecords(projectContext(cwd))),
);

await serveStdio(() => server);
