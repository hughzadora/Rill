import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { request } from "node:http";
import { test } from "node:test";
import { launchPreview } from "./preview.ts";

function probe(url: URL, path: string, options: { host?: string; method?: string } = {}) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const pending = request(
      url,
      {
        path,
        method: options.method ?? "GET",
        headers: { Host: options.host ?? url.host },
        agent: false,
        signal: AbortSignal.timeout(3000),
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body }));
      },
    );
    pending.on("error", reject);
    pending.end();
  });
}

await test("the built preview binds only to loopback, rejects a port conflict and restarts", async () => {
  const preview = launchPreview();
  try {
    const url = await preview.ready;
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(Number(url.port) > 0);
    assert.ok(preview.pid);
    const sockets = execFileSync(
      "lsof",
      ["-nP", "-a", "-p", String(preview.pid), "-iTCP", "-sTCP:LISTEN", "-Fn"],
      { encoding: "utf8", timeout: 3000 },
    );
    const listeners = sockets.split("\n").filter((record) => record.startsWith("n"));
    assert.deepEqual(listeners, [`n127.0.0.1:${url.port}`]);
    assert.deepEqual(await probe(url, "/health"), { status: 200, body: "ready\n" });

    const conflict = launchPreview(Number(url.port));
    try {
      await assert.rejects(conflict.ready, /EADDRINUSE/);
      assert.deepEqual(await conflict.exited, { code: 1, signal: null });
      assert.match(conflict.stderr(), /Preview port .* is already in use/);
      assert.equal((await probe(url, "/health")).status, 200);
    } finally {
      await conflict.stop();
    }

    assert.deepEqual(await preview.stop(), { code: 0, signal: null });
    await assert.rejects(probe(url, "/health"), { code: "ECONNREFUSED" });

    const restarted = launchPreview(Number(url.port));
    try {
      assert.equal((await restarted.ready).href, url.href);
      assert.equal((await probe(url, "/")).status, 200);
    } finally {
      assert.deepEqual(await restarted.stop(), { code: 0, signal: null });
    }
  } finally {
    await preview.stop();
  }
});

await test("the preview rejects foreign hosts, writes and paths outside its routes", async () => {
  const preview = launchPreview();
  try {
    const url = await preview.ready;
    assert.deepEqual(await probe(url, "/", { host: "foreign.invalid" }), {
      status: 400,
      body: "Invalid host\n",
    });
    assert.deepEqual(await probe(url, "/", { method: "POST" }), {
      status: 405,
      body: "Method not allowed\n",
    });
    for (const path of ["/package.json", "/../package.json", "/%2e%2e%2fpackage.json"]) {
      assert.deepEqual(await probe(url, path), { status: 404, body: "Not found\n" });
    }
    assert.match((await probe(url, "/")).body, /<title>Reminders<\/title>/);
    const script = await probe(url, "/index.js");
    assert.equal(script.status, 200);
    assert.doesNotMatch(script.body, /RILL_WEB_PORT|process\.env/);
  } finally {
    assert.deepEqual(await preview.stop(), { code: 0, signal: null });
  }
});
