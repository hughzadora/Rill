# Rill project policy

Owner decisions govern scope. The approved design is [#17](https://github.com/hughzadora/Rill/issues/17); the approved implementation plan and current execution record are [#18](https://github.com/hughzadora/Rill/issues/18). The delivery stages and engineering preferences are owned by [#16](https://github.com/hughzadora/Rill/issues/16), which supersedes conflicting older process decisions. Read relevant sources rather than treating historical candidates as the current implementation.

## Entry and ownership

Apply the shared [personal policy](../skills/rill-preferences/references/personal-policy.md).
Rill owns the owner's preferences and their verified integration with native controls. Installed Matt Pocock skills own the engineering methods, as recorded in [#10](https://github.com/hughzadora/Rill/issues/10). Raw ideas pass through Superpowers brainstorming, Matt grill-with-docs methods (grilling and domain-modeling), and writing-for-agents to distill an implementable agent-facing specification. Load the actual relevant skills; respect explicit-only wrapper invocation rules.

Project control integration applies to repositories with explicit `.rill/project.json` enrollment. Existing projects retain effective tools and structure; resolve evidenced conflicts within the authorized change. Shared personal interaction policy remains applicable outside enrolled projects.

GitHub issues own approved scope, decisions, task details, and repair history. Local recovery material is a cache of synchronized records plus an outbox of unsynchronized facts. Keep unique outbox records until publication and readback succeed. Repository source, actual runtime observations, and current-version checks establish implementation state; a task summary cannot override them.

Machine records use the GitHub numeric publisher IDs configured in `.rill/authority.json`. Enrollment must resolve the authorized account from GitHub; publisher changes require an owner decision. Other authors' marker comments remain source data and cannot change execution state. Missing author metadata requires recovery before dependent work. This identifies publishers, not human approval or semantic correctness; local configuration and hooks remain bypassable.

## Design and delivery

Before implementation, establish the complete approved scope, acceptance, principal success/failure/recovery paths, interfaces, responsibilities, and implementation slices. Relate each slice to that design. A scope reduction requires an explicit owner decision.

Follow the eight stages and human checkpoints in #16, with the owner's latest CI timing in personal policy taking precedence. Add necessary regression protection during cleanup. Finish the whole batch with local full-spec CI, independent review, and human acceptance before the PR. Keep author implementation and independent review distinct. A review belongs to the exact candidate it inspected.

Use one task branch/worktree and one batch PR. Preserve unrelated changes. Merge and publish within actual project authorization; verify outcomes before cleanup or closing tasks.

## Repair and recovery

Use the installed diagnosis method for repairs and the owner's repair limits in personal policy. Keep failed attempts across compaction, new chats, hypothesis changes, and agent handoffs.

Design native hooks and MCP integration together for lifecycle preconditions, task/evidence access, actual results, recovery, and completion checks. Hooks trigger or guard supported events; MCP supplies structured tool access and results. Codex supplies execution, native permissions, approvals, and sessions. Verify each event, tool, result, and failure behavior at its actual boundary. Command hooks remain suitable for local deterministic checks; direct shell remains suitable for local work.

Read current control coverage and native execution evidence in the active task. Preference/skill discovery, registered configuration, and successful standalone tools each establish only their observed scope. Keep unverified lifecycle conditions open until their actual integration tests pass.

Use direct local shell/Git/build/test tools for local work and direct supported interfaces for external services. Reuse maintained native capabilities before adding an adapter. Each new adapter needs a demonstrated gap and an actual consumer; keep Codex responsible for sessions, permissions, approvals, and scheduling.

## Completion

Bind evidence to the current candidate and original acceptance. Distinguish executed behavior, local simulation, human testing, unavailable checks, and deferred work. Documents, declarations, agent agreement, and a green proxy do not establish product correctness. Retract invalid completion claims, restore affected acceptance to incomplete or unknown, and preserve the correction and original evidence.

Collect decision sources through `record_decision_source` or `just decision-source`: it reads the original native user item, retains its full text/hash and exact quote, and rejects agent messages or mismatched quotes. These receipts make existing decisions recoverable; stage/subject interpretation and approval of a particular design or final candidate still require source review. A collected quote does not establish final acceptance.
