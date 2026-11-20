import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skill = readFileSync(
  fileURLToPath(new URL("../bundle/plugin/skills/rill-recover/SKILL.md", import.meta.url)),
  "utf8",
);

test("native recovery Skill has a discoverable fresh-session trigger", () => {
  assert.match(skill, /^---\nname: rill-recover\ndescription: /);
  assert.match(skill, /fresh Codex session/);
  assert.match(skill, /no prior chat/);
});

test("recovery uses native Git/GitHub authorities and current targeted requirements", () => {
  for (const authority of [
    "git rev-parse HEAD",
    "git status --porcelain=v1",
    "gh repo view",
    "gh issue view",
    "gh pr view",
    "gh run list",
    "Issue.blockedBy",
    "Issue.subIssues",
    "git grep -n",
    "PRD.md",
  ]) {
    assert.ok(skill.includes(authority), `Missing live recovery authority: ${authority}`);
  }
});

test("recovery fails closed on stale CI, missing review or untrusted Hooks", () => {
  assert.match(skill, /headSha.*exact current candidate/s);
  assert.match(skill, /older SHA is \*\*STALE\*\*, not PASS/);
  assert.match(skill, /untrusted Hook.*NOT_VERIFIED/);
  assert.match(skill, /pulls\/NUMBER\/reviews/);
  assert.match(skill, /review.*commit_id.*candidate.*STALE/i);
  assert.match(skill, /blocked|BLOCKED/);
  assert.match(skill, /UNKNOWN/);
  assert.match(skill, /CONSTITUTION.md.*if present/);
});

test("recovery does not invent a shadow tracker or preauthorize destructive steps", () => {
  assert.match(skill, /not conversational memory or an invented state database/);
  assert.match(skill, /Do not modify anything during read-only discovery/);
  assert.match(skill, /do not create shadow task logs/);
  assert.match(skill, /one safe next action/);
});
