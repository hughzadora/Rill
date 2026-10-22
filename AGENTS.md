# Rill

Read [the kernel](docs/policy.md) before research, planning, implementation or review. It is the sole active project policy and takes precedence over the rebuild plan, prior notes and existing implementation.

Before triage, scheduling, implementation, checking or review, apply the kernel's owner-controlled priority and deterministic evidence requirements; when a priority is not recorded, collect facts without selecting it.

For code, formatting, compile, schema, tests or reports use the [single executable build plan](rill-rebuild-plan.md), the [engineering loop](docs/engineering-loop.md) and its native `justfile`. Biome owns all formatting, including Markdown; never reintroduce Prettier or design another toolchain. The implementation language is locked to TypeScript 7; do not reselect a stack or replace upstream tools.

Use [the capability map](docs/capability-map.md) to select the official Codex capability and Matt Pocock skill for the task. Consult [the upstream facts](docs/rebuild/foundation-inputs.md) and verify version-sensitive decisions against the current official source. Apply the kernel when project requirements conflict with native capabilities.
