import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { request } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { dashboard } from "../e2e/fixtures/dashboard.mjs";

const repository = resolve(import.meta.dirname, "..");
const freePort = () =>
  new Promise((resolvePort, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      listener.close(() => resolvePort(address.port));
    });
  });
let directory;
let service;
let origin;

async function runServer(data) {
  const port = await freePort();
  const fixture = join(directory, "github-response.json");
  await writeFile(fixture, JSON.stringify({ data: { repository: data } }));
  const child = spawn(process.execPath, ["tools/preview.mjs", "22", "23"], {
    cwd: repository,
    env: {
      ...process.env,
      PORT: String(port),
      PATH: join(directory, "bin") + ":" + process.env.PATH,
      FAKE_ISSUES: fixture,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.resume();
  let failure = "";
  child.stderr.on("data", (chunk) => {
    failure += chunk.toString();
  });
  const base = "http://127.0.0.1:" + port;
  for (let attempt = 0; attempt < 55; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error("Preview exited early: " + failure);
    try {
      const reply = await fetch(base + "/api/dashboard");
      if (reply.status === 200 || reply.status === 206) return { child, base };
    } catch {
      // The server is not listening yet, not an HTTP failure.
    }
    await delay(100);
  }
  child.kill();
  throw new Error("Preview server was not ready: " + failure);
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "rill-preview-contract-"));
  await mkdir(join(directory, "bin"));
  const executable = join(directory, "bin", "gh");
  await writeFile(
    executable,
    [
      "#!/bin/sh",
      'case "$1 $2" in',
      "'repo view') printf '%s\\n' 'hughzadora/Rill' ;;",
      "'api graphql') cat \"$FAKE_ISSUES\" ;;",
      "'pr list'|'run list') printf '[]\\n' ;;",
      "*) exit 42 ;;",
      "esac",
      "",
    ].join("\n"),
  );
  await chmod(executable, 0o755);
  ({ child: service, base: origin } = await runServer(dashboard.issueData));
});

after(async () => {
  service?.kill();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("real server binds GitHub issues, exact Git revision and quality metadata", async () => {
  const response = await fetch(origin + "/api/dashboard");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const payload = await response.json();
  assert.equal(payload.issueData.nameWithOwner, "hughzadora/Rill");
  assert.equal(payload.issueData.parent.subIssues.nodes.length, 6);
  assert.equal(
    payload.issueData.parent.subIssues.nodes[1].blockedBy.nodes[0].number,
    31,
  );
  assert.equal(payload.quality.stacks.length, 4);
  assert.equal(
    payload.documents.some((document) => document.path === "HANDOFF.md"),
    true,
  );
  assert.match(payload.workspace.sha, /^[0-9a-f]{40}$/);
  assert.equal(payload.workspace.branch, "codex/native-feasibility");
  assert.equal(payload.workspace.prs.length, 0);
  assert.equal(payload.workspace.runs.length, 0);
  assert.deepEqual(payload.errors, []);
  assert.equal(typeof payload.workspace.changedPaths, "number");
});

test("read-only document endpoint returns allowlisted project documentation", async () => {
  const response = await fetch(origin + "/api/document?path=PRD.md");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /reusable/i);
  const invalid = await fetch(origin + "/api/document?path=../.git/config");
  assert.equal(invalid.status, 404);
});

test("HTML endpoint is isolated from repository source and refuses writes", async () => {
  const valid = await fetch(origin + "/");
  assert.equal(valid.status, 200);
  assert.match(await valid.text(), /Rill \/ Delivery Console/);
  assert.equal((await fetch(origin + "/package.json")).status, 404);
  assert.equal(
    (await fetch(origin + "/api/dashboard", { method: "POST" })).status,
    405,
  );
  const invalidHost = await new Promise((resolveStatus, reject) => {
    const outgoing = request(
      origin + "/api/dashboard",
      {
        headers: { Host: "untrusted.example" },
      },
      (incoming) => {
        incoming.resume();
        resolveStatus(incoming.statusCode);
      },
    );
    outgoing.once("error", reject);
    outgoing.end();
  });
  assert.equal(invalidHost, 403);
});

test("native issue feed has read-only, auditable schema", async () => {
  const response = await fetch(origin + "/api/progress");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, "github-graphql");
  assert.equal(
    payload.parent.subIssues.nodes[1].body.includes("Acceptance"),
    true,
  );
  assert.equal(payload.bugs.subIssues.nodes.length, 2);
});

test("incomplete GitHub pagination is surfaced as unavailable, not a successful issue tree", async () => {
  const altered = structuredClone(dashboard.issueData);
  altered.parent.subIssues.pageInfo.hasNextPage = true;
  const { child, base } = await runServer(altered);
  try {
    const response = await fetch(base + "/api/progress");
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /unavailable/);
    const partial = await fetch(base + "/api/dashboard");
    assert.equal(partial.status, 206);
    const payload = await partial.json();
    assert.equal(payload.issueData, null);
    assert.ok(payload.errors.some((error) => error.includes("GitHub")));
  } finally {
    child.kill();
  }
});
