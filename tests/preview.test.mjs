import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { request } from "node:http";
import { connect, createServer } from "node:net";
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
  const currentBranch = execFileSync("git", ["branch", "--show-current"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  const detached = !currentBranch;
  assert.equal(response.status, detached ? 206 : 200);
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
  assert.equal(payload.workspace.branch, currentBranch || null);
  assert.deepEqual(payload.workspace.prs, detached ? null : []);
  assert.deepEqual(payload.workspace.runs, detached ? null : []);
  assert.deepEqual(
    payload.errors,
    detached
      ? ["GitHub PR state unavailable", "GitHub CI run state unavailable"]
      : [],
  );
  assert.equal(typeof payload.workspace.changedPaths, "number");
});

test("read-only document endpoint returns allowlisted project documentation", async () => {
  const response = await fetch(origin + "/api/document?path=PRD.md");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /reusable/i);
  const adoption = await fetch(
    origin + "/api/document?path=standards%2FREADME.md",
  );
  assert.equal(adoption.status, 200);
  assert.match(await adoption.text(), /Copier\s+9\.19\.1/);
  const invalid = await fetch(origin + "/api/document?path=../.git/config");
  assert.equal(invalid.status, 404);
});

test("HTML endpoint is isolated from repository source and refuses writes", async () => {
  const valid = await fetch(origin + "/");
  assert.equal(valid.status, 200);
  assert.match(await valid.text(), /Rill \/ Delivery Console/);
  assert.equal((await fetch(origin + "/rill-journey.html")).status, 404);
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

test("malformed absolute request target cannot terminate the preview server", async () => {
  const port = Number(new URL(origin).port);
  const reply = await new Promise((resolveReply, reject) => {
    const socket = connect(port, "127.0.0.1");
    let content = "";
    socket.setTimeout(3000, () =>
      socket.destroy(new Error("Raw HTTP timeout")),
    );
    socket.once("connect", () => {
      socket.write(
        "GET http://[ HTTP/1.1\r\nHost: 127.0.0.1:" +
          port +
          "\r\nConnection: close\r\n\r\n",
      );
    });
    socket.on("data", (data) => {
      content += data.toString();
    });
    socket.once("end", () => resolveReply(content));
    socket.once("error", reject);
  });
  assert.match(reply, /^HTTP\/1\.1 (400|404)/);
  assert.equal((await fetch(origin + "/")).status, 200);
  const recovered = await fetch(origin + "/api/dashboard");
  const currentBranch = execFileSync("git", ["branch", "--show-current"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  assert.equal(recovered.status, currentBranch ? 200 : 206);
  const body = await recovered.json();
  assert.match(body.workspace.sha, /^[0-9a-f]{40}$/);
  assert.equal(body.issueData.nameWithOwner, "hughzadora/Rill");
  assert.deepEqual(
    body.errors,
    currentBranch
      ? []
      : ["GitHub PR state unavailable", "GitHub CI run state unavailable"],
  );
});

test("static assets cannot follow symlinks outside the built console", async () => {
  const secret = join(directory, "outside-private.css");
  const asset = join(
    repository,
    "apps/console/dist/assets",
    "escape-private.css",
  );
  await writeFile(secret, "LOCAL_PRIVATE_DATA_NEVER_SERVE");
  try {
    await symlink(secret, asset);
    const response = await fetch(origin + "/assets/escape-private.css");
    assert.equal(response.status, 404);
    assert.doesNotMatch(
      await response.text(),
      /LOCAL_PRIVATE_DATA_NEVER_SERVE/,
    );
  } finally {
    await rm(asset, { force: true });
  }
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

test("truncated native blockedBy dependencies never turn into a recommended task", async () => {
  const altered = structuredClone(dashboard.issueData);
  altered.parent.subIssues.nodes[0].blockedBy.pageInfo.hasNextPage = true;
  const { child, base } = await runServer(altered);
  try {
    const reply = await fetch(base + "/api/dashboard");
    assert.equal(reply.status, 206);
    const result = await reply.json();
    assert.equal(result.issueData, null);
    assert.ok(result.errors.includes("GitHub issue tree unavailable"));
  } finally {
    child.kill();
  }
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
