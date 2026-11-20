import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("upstream-first design intake is routed without bundled duplicate Skills", () => {
  const agent = read("AGENTS.md");
  const consumer = read("templates/consumer/AGENTS.md");
  for (const instructions of [agent, consumer]) {
    assert.match(instructions, /research/);
    assert.match(instructions, /grill-with-docs/);
    assert.match(instructions, /already-approved|already approved/);
    assert.match(instructions, /PRD.md/);
    assert.match(instructions, /GitHub/);
  }
  for (const obsolete of ["brainstorming", "rill-discovery", "rill-research", "rill-grill"]) {
    assert.equal(existsSync(join(root, "plugin/skills", obsolete)), false);
  }
});

test("Rill-owned Skills are limited to distinct recovery and update capabilities", () => {
  for (const name of ["rill-recover", "rill-update"]) {
    const skill = read(`skills/${name}/SKILL.md`);
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`));
    assert.match(skill, /GitHub/);
    assert.match(skill, /native/i);
  }
  assert.equal(existsSync(join(root, "skills/rill-recover/SKILL.md")), true);
  assert.equal(existsSync(join(root, "skills/rill-update/SKILL.md")), true);
});

test("research evidence does not become a second living product authority", () => {
  const constitution = read("CONSTITUTION.md");
  const spec = read("PRD.md");
  assert.match(constitution, /PRD.md/);
  assert.match(spec, /single \*\*living\*\* specification/);
  assert.match(spec, /GitHub Issues\/PRs/);
  assert.match(read("AGENTS.md"), /Do not add DESIGN.md, ROADMAP.md, MULTI_AGENT.md/);
});
