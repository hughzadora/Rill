import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { repairState } from "../tools/repair-evidence.ts";
import { projectContext } from "../tools/task-context.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

test("CLI termination stops its actual child and persists unknown outcome instead of losing the attempt", async () => {
  const fixture = fixtureProject();
  let childPid: number | undefined;
  const readyPath = join(fixture.root, ".git/child-ready.json");
  const watcher = watch(join(fixture.root, ".git"));
  const ready = new Promise<void>((resolve) => {
    watcher.on("change", () => {
      if (existsSync(readyPath)) resolve();
    });
  });
  try {
    expect(fixture.run("sync", taskUrl).status).toBe(0);
    const cli = fileURLToPath(
      new URL("../tools/repair-evidence.ts", import.meta.url),
    );
    const parent = spawn(
      process.execPath,
      [
        cli,
        "check",
        "BUG-INTERRUPT",
        "observe interruption",
        "--",
        process.execPath,
        "-e",
        "const fs=require('node:fs');const temp='.git/child-ready.json.tmp';fs.writeFileSync(temp,JSON.stringify({pid:process.pid}));fs.renameSync(temp,'.git/child-ready.json');setInterval(()=>{},1000)",
      ],
      {
        cwd: fixture.root,
        env: {
          ...process.env,
          ...fixture.environment,
          RILL_THREAD_ID: "test-owned-source",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    parent.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    parent.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const closed = once(parent, "close");
    await ready;
    childPid = JSON.parse(readFileSync(readyPath, "utf8")).pid;
    expect(repairState(projectContext(fixture.root))).toMatchObject({
      executionLease: {
        owner: { pid: parent.pid, started: true },
        completion: expect.stringContaining("not-established"),
      },
    });
    parent.kill("SIGTERM");
    const [exitCode, signal] = await closed;
    expect(exitCode, stderr).toBe(1);
    expect(signal).toBeNull();
    const result = JSON.parse(stdout.trim());
    expect(result.exitCode).toBeNull();
    expect(
      JSON.parse(
        readFileSync(join(dirname(result.receiptPath), "running.json"), "utf8"),
      ),
    ).toMatchObject({ controllerPid: parent.pid, childPid });
    const receipt = JSON.parse(readFileSync(result.receiptPath, "utf8"));
    expect(receipt.record.payload).toMatchObject({
      exitCode: null,
      signal: "SIGTERM",
    });
    expect(repairState(projectContext(fixture.root))).toMatchObject({
      blockedProblems: ["BUG-INTERRUPT"],
      problems: {
        "BUG-INTERRUPT": {
          failedAttempts: 0,
          consecutiveFailures: 0,
          unknownIds: [result.id],
        },
      },
    });
    expect(
      existsSync(join(fixture.root, ".git/rill-recovery/repair.lock")),
    ).toBe(false);
    expect(() => process.kill(childPid ?? 0, 0)).toThrow();
  } finally {
    watcher.close();
    if (childPid) {
      try {
        process.kill(childPid, "SIGTERM");
      } catch {
        /* Already reaped by the runner. */
      }
    }
    fixture.cleanup();
  }
});
