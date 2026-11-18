import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { taskStatus } from "./control-event.ts";
import { controlEventSchema } from "./control-input.ts";
import { recoverTask } from "./recover-task.ts";
import { lifecycleEvent } from "./recovery-lifecycle.ts";
import {
  projectContext,
  publishRecords,
  recordFact,
  syncTask,
} from "./task-context.ts";

const server = new McpServer({ name: "rill-preferences", version: "0.1.0" });
const output = (value: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  structuredContent: value,
});

server.registerTool(
  "evaluate_event",
  {
    description:
      "Check Rill personal task preconditions for a native lifecycle event and return the native hook response. Coverage is reported by task_status; this tool does not define engineering methodology.",
    inputSchema: controlEventSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async (event, context) =>
    output(await lifecycleEvent(event, context.mcpReq.signal)),
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
  "recover_task",
  {
    description:
      "Recover the bound task and exhaust supported native history pages. Reports uncovered user requests and failures; reading history does not prove semantic reconciliation.",
    inputSchema: z.object({
      cwd: z.string().min(1),
      thread_id: z.string().min(1),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  async ({ cwd, thread_id }, context) =>
    output(await recoverTask(cwd, thread_id, context.mcpReq.signal)),
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
