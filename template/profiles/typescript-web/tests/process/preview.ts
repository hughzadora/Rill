import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../../scripts/preview.ts", import.meta.url));

export function launchPreview(port = 0) {
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, RILL_WEB_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  const startup = AbortSignal.timeout(5000);
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    },
  );
  const ready = Promise.race([
    new Promise<URL>((resolve, reject) => {
      lines.once("line", (line) => {
        try {
          resolve(new URL(line));
        } catch (error) {
          reject(error);
        }
      });
      startup.addEventListener("abort", () =>
        reject(new Error(`Preview did not start\n${stderr}`)),
      );
    }),
    exited.then(({ code }) => {
      throw new Error(`Preview exited before readiness (${code})\n${stderr}`);
    }),
  ]);
  ready.catch(() => undefined);

  return {
    pid: child.pid,
    ready,
    exited,
    stderr: () => stderr,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        const timeout = setTimeout(() => child.kill("SIGKILL"), 3000);
        try {
          return await exited;
        } finally {
          clearTimeout(timeout);
        }
      }
      return await exited;
    },
  };
}
