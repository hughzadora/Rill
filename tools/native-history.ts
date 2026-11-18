import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Ajv } from "ajv";

export interface HistoryItem {
  turnId: string;
  item: { id: string; type: string; [key: string]: unknown };
}

interface HistoryPage {
  data: HistoryItem[];
  nextCursor: string | null;
}

const validatePage = new Ajv().compile<HistoryPage>({
  type: "object",
  required: ["data", "nextCursor"],
  properties: {
    nextCursor: { type: ["string", "null"] },
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["turnId", "item"],
        properties: {
          turnId: { type: "string" },
          item: {
            type: "object",
            required: ["id", "type"],
            properties: { id: { type: "string" }, type: { type: "string" } },
          },
        },
      },
    },
  },
});

export async function readNativeHistory(
  threadId: string,
  cwd: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const child = spawn("codex", ["app-server", "--stdio"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  child.stderr.resume();
  let nextId = 0;
  const waiting = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const rejectAll = (error: Error) => {
    for (const waiter of waiting.values()) waiter.reject(error);
    waiting.clear();
  };
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => {
      rejectAll(new Error("Native history reader closed before its response"));
      resolve();
    }),
  );
  const abort = () => {
    rejectAll(new Error("Native history read aborted"));
    child.kill();
  };
  signal.addEventListener("abort", abort, { once: true });
  child.on("error", rejectAll);
  child.stdin.on("error", rejectAll);
  lines.on("line", (line) => {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      rejectAll(new Error("Invalid JSON from native app-server"));
      return;
    }
    if (!message || typeof message !== "object") return;
    if (
      "id" in message &&
      typeof message.id === "number" &&
      waiting.has(message.id)
    ) {
      const waiter = waiting.get(message.id);
      waiting.delete(message.id);
      if ("error" in message)
        waiter?.reject(
          new Error(
            `Native history request failed: ${JSON.stringify(message.error)}`,
          ),
        );
      else if ("result" in message) waiter?.resolve(message.result);
      else waiter?.reject(new Error("Native response has no result"));
    } else if ("method" in message && "id" in message) {
      child.stdin.write(
        `${JSON.stringify({ id: message.id, error: { code: -32601, message: "Read-only history client does not handle server requests" } })}\n`,
      );
    }
  });
  const request = (
    method: "initialize" | "thread/items/list",
    params: Record<string, unknown>,
  ) => {
    signal.throwIfAborted();
    const id = ++nextId;
    const promise = new Promise<unknown>((resolve, reject) =>
      waiting.set(id, { resolve, reject }),
    );
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    return promise;
  };
  try {
    await request("initialize", {
      clientInfo: { name: "rill-history-reader", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    const items: HistoryItem[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    let pageCount = 0;
    do {
      const page = await request("thread/items/list", {
        threadId,
        ...(cursor ? { cursor } : {}),
      });
      if (!validatePage(page)) throw new Error("Invalid native history page");
      items.push(...page.data);
      pageCount += 1;
      cursor = page.nextCursor;
      if (cursor) {
        if (seenCursors.has(cursor))
          throw new Error(
            "Native history cursor repeated; coverage is incomplete",
          );
        seenCursors.add(cursor);
      }
    } while (cursor);
    return { threadId, items, pageCount, nextCursor: null };
  } finally {
    child.stdin.end();
    await closed;
    signal.removeEventListener("abort", abort);
    lines.close();
  }
}
