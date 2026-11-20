import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workflow = readFileSync(
  fileURLToPath(new URL("../.github/workflows/quality.yml", import.meta.url)),
  "utf8",
);

test("source quality gate cannot be skipped by a VERSION or Marketplace-only PR", () => {
  assert.match(workflow, /^on:\n {2}pull_request:\n/m);
  assert.doesNotMatch(workflow, /^\s+paths:\s*$/m);
});

test("source quality gate also validates the actual main merge commit", () => {
  assert.match(workflow, /^ {2}push:\n {4}branches:\n {6}- main\n/m);
  assert.match(workflow, /^permissions:\n {2}contents: read\n/m);
});
