import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFileSync(join(repo, name), "utf8");
const semver =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

test("product version uses canonical SemVer 0.0.1, separate from blueprint 10.0.1", () => {
  assert.equal(read("VERSION"), "0.0.1\n");
  assert.match(read("VERSION").trim(), semver);
  assert.match(read("PRD.md"), /Blueprint 10\.0\.1/);
  assert.match(read("README.md"), /Product SemVer.*`0\.0\.1`/);
  assert.match(read("CONSTITUTION.md"), /root `VERSION` as the canonical source/);
  assert.doesNotMatch(read("VERSION"), /10\.0\.1/);
});

test("single living Rill PRD and independent consumer template", () => {
  assert.ok(existsSync(join(repo, "PRD.md")));
  assert.ok(existsSync(join(repo, "bundle/repo-common/PRD.md")));
  for (const old of ["DESIGN.md", "ROADMAP.md", "MULTI_AGENT.md"]) {
    assert.equal(existsSync(join(repo, old)), false, `retired authority: ${old}`);
  }
  assert.match(read("bundle/repo-common/PRD.md"), /consuming product/);
  assert.doesNotMatch(
    read("bundle/repo-common/PRD.md"),
    /Rill's factory product requirements.*\n\| FR-02/,
  );
});

test("current requirement IDs are stable, unique and statuses are declared", () => {
  const rows = [
    ...read("PRD.md").matchAll(
      /^\|\s*((?:FR|NFR)-\d{2})\s*\|.+\|\s*(\[(?:PLANNED|IN-PROGRESS|DONE)\])\s*\|$/gm,
    ),
  ];
  assert.equal(rows.length, 18);
  assert.equal(new Set(rows.map((match) => match[1])).size, rows.length);
  for (let n = 1; n <= 12; n++)
    assert.ok(rows.some((row) => row[1] === `FR-${String(n).padStart(2, "0")}`));
  for (let n = 1; n <= 6; n++)
    assert.ok(rows.some((row) => row[1] === `NFR-${String(n).padStart(2, "0")}`));
  assert.ok(
    rows.every((row) => row[2] !== "[DONE]"),
    "scaffold alone cannot claim verified delivery",
  );
});

test("agent entrypoint is concise and supports bounded requirement lookup", () => {
  assert.ok(read("AGENTS.md").trimEnd().split("\n").length <= 30);
  const result = spawnSync("git", ["grep", "-n", "-E", "^\\| FR-09 \\|", "--", "PRD.md"], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr ?? "Git did not find the FR-09 requirement");
  assert.match(result.stdout, /^PRD\.md:\d+:\| FR-09 \|/);
  assert.equal(result.stdout.trim().split("\n").length, 1);
});
