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

Status: native local formatting, tests, coverage threshold failure, complexity/LOC, unused-code, offline links, secrets, vulnerability and Git hook gates are connected and tested. Codex App automation, native GitHub enforcement, production test coverage and end-to-end delivery remain separate acceptance work. This README does not authorize external operations.
