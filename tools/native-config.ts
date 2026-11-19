import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { atomicText } from "./atomic-files.ts";

// Native config/value/write preserves TOML, but only accepts its user layer.
// Edit a staged user layer, then compare-and-replace the requested project file.
export async function setProjectPluginEnabled(
  path: string,
  enabled: boolean,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (existsSync(path) && lstatSync(path).isSymbolicLink())
    throw new Error(
      "Preserve symlinked project config; choose its target explicitly before enrollment",
    );
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  const home = mkdtempSync(join(tmpdir(), "rill-config-"));
  const staged = join(home, "config.toml");
  writeFileSync(staged, before ?? "", { mode: 0o600 });
  const child = spawn("codex", ["app-server", "--stdio"], {
    cwd: home,
    env: { ...process.env, CODEX_HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout });
  const waiting = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  let nextId = 0;
  const rejectAll = (error: Error) => {
    for (const waiter of waiting.values()) waiter.reject(error);
    waiting.clear();
  };
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => {
      rejectAll(new Error("Native config writer closed before response"));
      resolve();
    }),
  );
  child.on("error", rejectAll);
  child.stdin.on("error", rejectAll);
  const abort = () => {
    rejectAll(new Error("Native config edit aborted"));
    child.kill();
  };
  signal.addEventListener("abort", abort, { once: true });
  lines.on("line", (line) => {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      rejectAll(new Error("Invalid native config response"));
      return;
    }
    if (
      !message ||
      typeof message !== "object" ||
      !("id" in message) ||
      typeof message.id !== "number"
    )
      return;
    const waiter = waiting.get(message.id);
    if (!waiter) return;
    waiting.delete(message.id);
    if ("error" in message)
      waiter.reject(new Error(JSON.stringify(message.error)));
    else if ("result" in message) waiter.resolve(message.result);
    else waiter.reject(new Error("Native response has no result"));
  });
  const request = (method: string, params: Record<string, unknown>) => {
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
      clientInfo: { name: "rill-project-config", version: "1" },
      capabilities: { experimentalApi: true },
    });
    const result = await request("config/value/write", {
      filePath: staged,
      keyPath: 'plugins."rill@rill-local".enabled',
      value: enabled,
      mergeStrategy: "upsert",
    });
    if (
      !result ||
      typeof result !== "object" ||
      !("status" in result) ||
      result.status !== "ok"
    )
      throw new Error("Native config edit was not confirmed");
    signal.throwIfAborted();
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (current !== before)
      throw new Error(
        "Project config changed during enrollment; reconcile before writing",
      );
    const content = readFileSync(staged, "utf8");
    if (content !== before) atomicText(path, content);
    return {
      path,
      enabled,
      editor: "codex config/value/write",
      reloadRequired: true,
    };
  } finally {
    child.stdin.end();
    await closed;
    signal.removeEventListener("abort", abort);
    lines.close();
    rmSync(home, { recursive: true, force: true });
  }
}
