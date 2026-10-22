# Rill

Apply [the kernel](docs/policy.md) to every task; load it when entering the project or when its revision changes, and reuse the unchanged loaded version. It is the sole policy authority: upstream/native first; part-time non-developer owner; strict quality and repository hygiene; agility and budget before organizational ceremony.

Audit every new idea before promoting it: clean and distill input, test assumptions and impact, and keep requirement pollution/model guesses out of the spec. Use Matt grilling for analysis, not a prose interview. Ask only for non-derivable information or protected authorization through native Codex choice/approval controls; otherwise continue the already-authorized work.

For any feature, bug fix, refactor, or behavior-changing configuration, skill or agent-instruction change, **automatically spawn native subagents for design, implementation and independent review**. The primary reads [the development workflow](.agents/skills/development-workflow/SKILL.md), establishes the task baseline, then spawns the design agent before doing implementation research or editing. This is an explicit project instruction to delegate; the owner need not request agents. Delegated threads perform only their bounded assignment and never restart this workflow. Read-only answers and mechanical wording-only edits use the proportional existing check path. Unavailable delegation is incomplete, not a passing review.

For implementation and checks, follow [the build plan](rill-rebuild-plan.md), [engineering loop](docs/engineering-loop.md) and `justfile`. Use the locked TypeScript 7 stack and Biome formatter; leave unrelated owner files unchanged.

Use [the capability map](docs/capability-map.md) to select the native interface and matching Matt skill. Load [upstream evidence](docs/rebuild/foundation-inputs.md) and [owner-context evidence](docs/rebuild/engineering-policy-sources.md#owner-context-and-platform-boundaries) only when the relevant capability, account boundary or version-sensitive claim needs verification. Read recorded issue priority; do not invent one or stop unrelated authorized work to obtain it.
