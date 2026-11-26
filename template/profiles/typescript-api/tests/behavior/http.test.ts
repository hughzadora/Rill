import { serve } from "bun";
import { afterAll, expect, test } from "bun:test";
import { handleRequest } from "../../src/adapters/http";

const server = serve({ hostname: "127.0.0.1", port: 0, fetch: handleRequest });
const endpoint = new URL("/v1/reservation-quotes", server.url);

afterAll(async () => {
  await server.stop(true);
});

async function quote(requested: number, available: number) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requested, available }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  const payload: unknown = await response.json();
  return payload;
}

test("quotes exact, spare and insufficient capacity", async () => {
  expect(await quote(4, 4)).toEqual({ accepted: true });
  expect(await quote(1, 12)).toEqual({ accepted: true });
  expect(await quote(9, 3)).toEqual({ accepted: false });
  expect(await quote(1, 0)).toEqual({ accepted: false });
});

test.each([
  ["malformed JSON", "{"],
  ["missing field", '{"requested":1}'],
  ["wrong type", '{"requested":"1","available":2}'],
  ["out of range", '{"requested":101,"available":100}'],
  ["fractional quantity", '{"requested":1.5,"available":2}'],
  ["unexpected field", '{"requested":1,"available":2,"private":"internal-value"}'],
])("rejects %s with a redacted structured error", async (_case, body) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body,
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid-request" });
});

test("rejects oversized JSON and leaves the service available", async () => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: `{"requested":1,"available":2}${" ".repeat(1024)}`,
  });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: "payload-too-large" });
  expect(await quote(2, 3)).toEqual({ accepted: true });
});

test("requires a JSON media type", async () => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: '{"requested":1,"available":2}',
  });
  expect(response.status).toBe(415);
  expect(await response.json()).toEqual({ error: "unsupported-media-type" });
});

test("returns the supported method for a known path and 404 for other paths", async () => {
  const wrongMethod = await fetch(endpoint);
  expect(wrongMethod.status).toBe(405);
  expect(wrongMethod.headers.get("allow")).toBe("POST");
  expect(await wrongMethod.json()).toEqual({ error: "method-not-allowed" });
  const wrongPath = await fetch(new URL("/v1/unknown", server.url));
  expect(wrongPath.status).toBe(404);
  expect(await wrongPath.json()).toEqual({ error: "not-found" });
});
