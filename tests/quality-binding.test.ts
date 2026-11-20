import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { qualityRelease, verifyReleaseFiles } from "../tools/quality-binding.ts";

const directories: string[] = [];
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "rill-release-integrity-"));
  directories.push(root);
  mkdirSync(join(root, "tools"));
  writeFileSync(join(root, "tools/gate.ts"), "export const gate = true;\n");
  return root;
}

afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("versioned standard detects edits to its actual implementation files", () => {
  const root = sandbox();
  const digest = hash(readFileSync(join(root, "tools/gate.ts"), "utf8"));
  expect(verifyReleaseFiles(root, { "tools/gate.ts": digest })).toBe(true);
  writeFileSync(join(root, "tools/gate.ts"), "export const gate = false;\n");
  expect(verifyReleaseFiles(root, { "tools/gate.ts": digest })).toBe(false);
});

test("release integrity refuses traversal and empty file inventories", () => {
  const root = sandbox();
  expect(verifyReleaseFiles(root, {})).toBe(false);
  expect(verifyReleaseFiles(root, { "../outside.ts": hash("none") })).toBe(false);
  expect(verifyReleaseFiles(root, { "/tmp/example.ts": hash("none") })).toBe(false);
});

test("candidate manifest resolves to its verified implementation file set", () => {
  const release = qualityRelease("0.1.1");
  expect(release?.digest).toMatch(/^[0-9a-f]{64}$/);
  expect(release?.manifest.fileSha256["tools/quality-binding.ts"]).toMatch(/^[0-9a-f]{64}$/);
});
