# Rill

Project development entry: [PRD](PRD.md) defines user jobs and observable scope; [ARCHITECTURE](ARCHITECTURE.md) maps current module and state ownership; [DESIGN](DESIGN.md) describes confirmed behavior; [GLOSSARY](GLOSSARY.md) defines domain language. Read the relevant document for the task.

Read [project policy](POLICY.md) when entering this repository or when its revision changes. Apply [personal preferences](skills/rill-preferences/SKILL.md) in this enrolled project. Use installed Matt Pocock skills for engineering methods; Rill owns preferences and their native integration.

GitHub remains authoritative: [approved design and decisions #17](https://github.com/hughzadora/Rill/issues/17), [current delivery and execution record #18](https://github.com/hughzadora/Rill/issues/18), and [engineering process #16](https://github.com/hughzadora/Rill/issues/16). Verify actual Git, task, runtime, and evidence state before resuming; these documents do not replace current issue state or execution evidence.

Use [README commands](README.md#commands) for setup and checks; `just --list` is the executable command index. Commit runs lint only. Select development checks by risk under [personal CI policy](skills/rill-preferences/references/personal-policy.md); run `just full-spec-ci` at the batch pre-PR checkpoint, not after every edit.

For major owner-facing overall-design or delivery-route decisions where visual comparison adds value, include a standalone interactive HTML review companion with options, consequences, and a copy-to-chat fallback. Routine reviews need no extra artifact. The companion does not record approval; use the host's native control for consequential decisions.

For GitHub collaboration read [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md); for hook/MCP trust, task-data exposure or vulnerability reporting read [.github/SECURITY.md](.github/SECURITY.md). Preserve pending recovery work and the incomplete gates in #18.
