# Rill project policy

Owner decisions govern scope. The approved design is [#17](https://github.com/hughzadora/Rill/issues/17); the approved implementation plan and current execution record are [#18](https://github.com/hughzadora/Rill/issues/18). The delivery stages and engineering preferences are owned by [#16](https://github.com/hughzadora/Rill/issues/16), which supersedes conflicting older process decisions. Read relevant sources rather than treating historical candidates as the current implementation.

## Entry and ownership

Apply the shared [personal policy](../skills/rill-workflow/references/personal-policy.md).
The full project workflow applies to repositories with an explicit `.rill/project.json` enrollment. Existing projects retain effective tools and structure; resolve evidenced conflicts within the authorized change. Shared personal policy remains applicable outside enrolled projects.

GitHub issues own approved scope, decisions, task details, and repair history. Local recovery material is a cache of synchronized records plus an outbox of unsynchronized facts. Keep unique outbox records until publication and readback succeed. Repository source, actual runtime observations, and current-version checks establish implementation state; a task summary cannot override them.

## Design and delivery

Before implementation, establish the complete approved scope, acceptance, principal success/failure/recovery paths, interfaces, responsibilities, and implementation slices. Relate each slice to that design. A scope reduction requires an explicit owner decision.

Follow the eight stages and human checkpoints in #16. During initial implementation run existing regressions and applicable static/integration checks; add necessary unit regressions and explanatory comments during cleanup. Finish the whole batch with its required suite, build, independent review, and human acceptance. Keep author implementation and independent review distinct. A review belongs to the exact candidate it inspected.

Use one task branch/worktree and one batch PR. Preserve unrelated changes. Merge and publish within actual project authorization; verify outcomes before cleanup or closing tasks.

## Repair and recovery

Read the workflow's repair and recovery steps when the corresponding trigger applies. Keep failed attempts across compaction, new chats, hypothesis changes, and agent handoffs. Native hooks provide bounded checks and context loading; their presence does not prove trust, execution, complete coverage, or semantic correctness.

Use direct local shell/Git/build/test tools for local work and direct supported interfaces for external services. Reuse maintained native capabilities before adding an adapter. Each new adapter needs a demonstrated gap and an actual consumer; keep Codex responsible for sessions, permissions, approvals, and scheduling.

## Completion

Bind evidence to the current candidate and original acceptance. Distinguish executed behavior, local simulation, human testing, unavailable checks, and deferred work. Documents, declarations, agent agreement, and a green proxy do not establish product correctness. Retract invalid completion claims, restore affected acceptance to incomplete or unknown, and preserve the correction and original evidence.
