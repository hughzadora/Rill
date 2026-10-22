# Rill

Owner-operated macOS development workflow centered on official Codex, its native capability map, Matt Pocock skills, and GitHub. Designed for a part-time owner without development experience: audited and distilled requirements, native choice-only information requests, real bounded multi-agent execution, GitHub Free/private delivery and budget-aware small increments. The kernel defines the authority and runtime verification boundaries.
- [Kernel — sole active policy](docs/policy.md)
- [Codex capability map](docs/capability-map.md)
- [Upstream engineering facts](docs/rebuild/foundation-inputs.md)
- [Engineering feedback loop — locked TS7 toolchain and commands](docs/engineering-loop.md)
- [Owner-authored Quality Gate research (preserved source)](docs/tool-for-quality-gate.md)
- [Engineering evidence supplement](docs/rebuild/engineering-policy-sources.md)
- [Rebuild plan and acceptance boundaries](rill-rebuild-plan.md)

Local development is locked to TypeScript 7.0.2, Node.js 24 LTS and pnpm 12.14.0. The complete build plan is [the Rill rebuild plan](rill-rebuild-plan.md). The executable feedback loop uses `pnpm install --frozen-lockfile`, `just doctor`, `just fmt`, `just check`, `just precommit` and `just gate`. Biome is the **sole formatter**, including Markdown. See the engineering loop for read/write boundaries and observed tests.

Implementation requests automatically route through the [development workflow](.agents/skills/development-workflow/SKILL.md): native design, bounded implementation and independent review. Dedicated [planner](.codex/agents/planner.toml), [worker](.codex/agents/worker.toml), [reviewer](.codex/agents/reviewer.toml) and optional [explorer](.codex/agents/explorer.toml) profiles specify responsibilities, models, reasoning effort and compact result contracts. Only the primary reports progress and delivery to the owner. The [project configuration](.codex/config.toml) caps delegation and leaves the parent's model and permissions user-selected.

Delivery is tracked in [issue #2](https://github.com/hughzadora/Rill/issues/2), with [LOC behavior #3](https://github.com/hughzadora/Rill/issues/3), [macOS App acceptance #4](https://github.com/hughzadora/Rill/issues/4) and [native multiagent execution #6](https://github.com/hughzadora/Rill/issues/6) as sub-issues. A fresh ordinary task has completed design, implementation and candidate-matched review in official Codex CLI 0.163.0 on macOS. Role-loading, model and quiet-output acceptance evidence belongs in #6 and its delivery PR. CLI execution does not establish App UI behavior or account allowance; #4 remains open. Paid server protection is outside the GitHub Free/private baseline.
