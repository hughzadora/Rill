import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { checkMetrics } from "../tools/check-metrics.js";

const cli = fileURLToPath(new URL("../tools/check-metrics.ts", import.meta.url));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function reportFor(...reports: unknown[]): string {
  return JSON.stringify({ TypeScript: { reports } });
}

function runCliWithTokei(source: string) {
  const directory = mkdtempSync(join(tmpdir(), "rill-metrics-"));
  try {
    writeFileSync(join(directory, "tokei.ts"), `#!/usr/bin/env node\n${source}\n`, {
      mode: 0o700,
    });
    symlinkSync("tokei.ts", join(directory, "tokei"));
    return spawnSync(process.execPath, [cli], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH ?? ""}` },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("CLI rejects a Tokei report with a missing code count", () => {
  const output = reportFor({ name: "example.ts", stats: {} });
  const result = runCliWithTokei(`process.stdout.write(${JSON.stringify(output)});`);
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toContain("Invalid tokei output");
  expect(result.stdout).not.toContain("at or below");
});

test("CLI preserves failure when Tokei exits unsuccessfully", () => {
  const result = runCliWithTokei('process.stderr.write("counter failed"); process.exitCode = 7;');
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("counter failed");
  expect(result.stdout).not.toContain("at or below");
});

test.each([
  ["empty output", ""],
  ["malformed JSON", "{"],
  ["null result", "null"],
  ["array result", "[]"],
  ["missing TypeScript", "{}"],
  ["null TypeScript", '{"TypeScript":null}'],
  ["missing reports", '{"TypeScript":{}}'],
  ["non-array reports", '{"TypeScript":{"reports":{}}}'],
  ["empty reports", reportFor()],
  ["null file", reportFor(null)],
  ["missing name", reportFor({ stats: { code: 1 } })],
  ["empty name", reportFor({ name: "", stats: { code: 1 } })],
  ["non-string name", reportFor({ name: 1, stats: { code: 1 } })],
  ["missing stats", reportFor({ name: "example.ts" })],
  ["null stats", reportFor({ name: "example.ts", stats: null })],
  ["missing code", reportFor({ name: "example.ts", stats: {} })],
  ["null code", reportFor({ name: "example.ts", stats: { code: null } })],
  ["string code", reportFor({ name: "example.ts", stats: { code: "499" } })],
  ["negative code", reportFor({ name: "example.ts", stats: { code: -1 } })],
  ["fractional code", reportFor({ name: "example.ts", stats: { code: 0.5 } })],
  ["unsafe integer code", reportFor({ name: "example.ts", stats: { code: 9007199254740992 } })],
  ["non-finite code", '{"TypeScript":{"reports":[{"name":"example.ts","stats":{"code":1e400}}]}}'],
])("rejects %s before reporting a passing LOC gate", (_name, output) => {
  expect(() => checkMetrics(output)).toThrow();
  expect(console.log).not.toHaveBeenCalled();
});

test("accepts zero code lines in a valid TypeScript report", () => {
  expect(checkMetrics(reportFor({ name: "empty.ts", stats: { code: 0 } }))).toBe(0);
  expect(console.log).toHaveBeenCalledWith("tokei: 1 TypeScript files at or below 500 code LOC");
  expect(console.error).not.toHaveBeenCalled();
});

test("reports every oversized file without flagging the 500-line boundary", () => {
  const output = reportFor(
    { name: "allowed.ts", stats: { code: 500 } },
    { name: "first.ts", stats: { code: 501 } },
    { name: "second.ts", stats: { code: 700 } },
  );
  expect(checkMetrics(output)).toBe(1);
  expect(console.error).toHaveBeenNthCalledWith(1, "first.ts: 501 code LOC exceeds 500");
  expect(console.error).toHaveBeenNthCalledWith(2, "second.ts: 700 code LOC exceeds 500");
  expect(console.error).toHaveBeenCalledTimes(2);
  expect(console.log).not.toHaveBeenCalled();
});

test.each([
  { lines: 500, status: 0 },
  { lines: 501, status: 1 },
])("checks real Tokei output and CLI status for $lines code lines", ({ lines, status }) => {
  const directory = mkdtempSync(join(tmpdir(), "rill-metrics-"));
  try {
    writeFileSync(join(directory, "example.ts"), "export {};\n".repeat(lines));
    const output = execFileSync("tokei", ["--files", "--output", "json", "."], {
      cwd: directory,
      encoding: "utf8",
    });
    expect(checkMetrics(output)).toBe(status);

    const result = spawnSync(process.execPath, [cli], { cwd: directory, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(status);
    if (status === 0) {
      expect(result.stdout).toContain("1 TypeScript files at or below 500 code LOC");
      expect(result.stderr).toBe("");
    } else {
      expect(result.stderr).toContain("example.ts: 501 code LOC exceeds 500");
      expect(result.stdout).toBe("");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
