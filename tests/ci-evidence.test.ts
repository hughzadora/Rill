import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { runEvidence, verifyEvidence } from "../tools/ci-evidence.ts";
import { fixtureProject } from "./helpers/project.ts";

let fixture: ReturnType<typeof fixtureProject>;
beforeEach(() => {
  fixture = fixtureProject();
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-qm",
      "baseline",
    ],
    { cwd: fixture.root },
  );
  execFileSync("git", ["branch", "-f", "main", "HEAD"], { cwd: fixture.root });
});
afterEach(() => fixture.cleanup());

test("a successful command records candidate/environment and rejects newer dirty content", () => {
  const { receipt, path } = runEvidence(
    fixture.root,
    [process.execPath, "-e", "process.exit(0)"],
    ["human acceptance"],
  );
  expect(receipt.exitCode).toBe(0);
  expect(receipt.candidateUnchanged).toBe(true);
  expect(verifyEvidence(fixture.root, path)).toMatchObject({
    matchingCandidate: true,
    unverified: ["human acceptance"],
  });
  writeFileSync(join(fixture.root, "changed.txt"), "changed");
  expect(() => verifyEvidence(fixture.root, path)).toThrow("does not match");
});

test("real nonzero exits are retained and cannot be reused as success", () => {
  const { path } = runEvidence(
    fixture.root,
    [process.execPath, "-e", "process.exit(7)"],
    [],
  );
  expect(JSON.parse(readFileSync(path, "utf8")).exitCode).toBe(7);
  expect(() => verifyEvidence(fixture.root, path)).toThrow();
});

test("changes during a successful command invalidate the candidate receipt", () => {
  const { receipt, path } = runEvidence(
    fixture.root,
    [
      process.execPath,
      "-e",
      "require('node:fs').writeFileSync('changed.txt','new behavior')",
    ],
    [],
  );
  expect(receipt.exitCode).toBe(0);
  expect(receipt.candidateUnchanged).toBe(false);
  expect(() => verifyEvidence(fixture.root, path)).toThrow();
});
