import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = `${root}/.github/scripts/require-results.ts`;

const successful = {
  artifact: { result: "success" },
  qualification: { result: "success" },
  verify: { result: "success" },
  "scan-secrets": { result: "success" },
};

function runAggregate(input: string) {
  return Bun.spawnSync([process.execPath, cli], {
    cwd: root,
    env: { REQUIRED_RESULTS: input },
  });
}

test("the required-job aggregate accepts only the complete successful job set", () => {
  const result = runAggregate(JSON.stringify(successful));
  expect(result.exitCode, result.stderr.toString()).toBe(0);
});

test("the workflow command rejects a skipped required job with a failing exit status", () => {
  const result = runAggregate(
    JSON.stringify({
      ...successful,
      qualification: { result: "skipped" },
    }),
  );
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("qualification");
});

test.each(["failure", "cancelled", "neutral", "timed_out", "action_required"])(
  "the workflow command rejects a %s job result",
  (status) => {
    const result = runAggregate(
      JSON.stringify({
        ...successful,
        artifact: { result: status },
      }),
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("artifact");
  },
);

test.each([
  ["a missing required job", { artifact: successful.artifact, verify: successful.verify }],
  ["an unexpected job", { ...successful, extra: { result: "success" } }],
  ["a non-object job result", { ...successful, verify: null }],
  ["malformed JSON", "{"],
  ["an array instead of a job map", "[]"],
])("the workflow command rejects %s", (_name, input) => {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  const result = runAggregate(serialized);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString().length).toBeGreaterThan(0);
});
