import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const skill = (name) => readFileSync(join(repo, "bundle/plugin/skills", name, "SKILL.md"), "utf8");

test("research and grill each expose exactly one native discovery entry point", () => {
  const research = skill("rill-research");
  const grill = skill("rill-grill");
  for (const [name, body] of [
    ["rill-research", research],
    ["rill-grill", grill],
  ]) {
    assert.match(body, new RegExp(`^---\\nname: ${name}\\n`));
    assert.match(body, /Use the installed `rill-discovery` Skill as the single design-intake gate/);
    assert.doesNotMatch(body, /Invoke `brainstorming` directly/);
    assert.match(body, /already-approved/i);
  }
});

test("discovery invokes brainstorming at most once, then primary research and grill", () => {
  const body = skill("rill-discovery");
  assert.match(body, /exactly once per substantive decision/);
  assert.match(body, /primary sources/i);
  assert.match(body, /grill/i);
  assert.match(body, /PRD.md/);
  assert.match(body, /GitHub Issues/i);
  assert.match(body, /without re-asking|do not reopen|do not repeat/i);
});

test("Supplied upstream skill dependencies have an honest executable or disabled outcome", () => {
  const b = skill("brainstorming");
  const folder = join(repo, "bundle/plugin/skills/brainstorming");
  assert.ok(existsSync(join(folder, "builder-check-prompt.md")));
  assert.ok(existsSync(join(folder, "visual-companion.md")));
  assert.match(b, /Source: obra\/superpowers/);
  assert.match(b, /Visual companion server is not bundled/);
  assert.match(
    readFileSync(join(folder, "visual-companion.md"), "utf8"),
    /not available in this Rill distribution/i,
  );
});

test("single-PRD product design and actual independent review override upstream defaults", () => {
  const b = skill("brainstorming");
  assert.match(b, /PRD.md.*single living specification/);
  assert.match(b, /GitHub Issues.*PRs/);
  assert.match(b, /native reviewer.*unavailable.*NOT_VERIFIED/i);
  assert.match(b, /writing-plans.*not installed/i);
});
