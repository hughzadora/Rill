# Rill project policy

Owner decisions govern scope. The approved design is [#17](https://github.com/hughzadora/Rill/issues/17); the approved implementation plan and current execution record are [#18](https://github.com/hughzadora/Rill/issues/18). The delivery stages and engineering preferences are owned by [#16](https://github.com/hughzadora/Rill/issues/16), which supersedes conflicting older process decisions. Read relevant sources rather than treating historical candidates as the current implementation.

Root development documents: [PRD](PRD.md) is the user and acceptance overview; [ARCHITECTURE](ARCHITECTURE.md) describes observed module and state boundaries; [DESIGN](DESIGN.md) summarizes confirmed behavior and rationale; [GLOSSARY](GLOSSARY.md) defines domain terms. They are navigation and project context, not independent decision records or evidence. GitHub remains authoritative, and the approved [HTML design view](DESIGN.html) is not a second specification.

## Entry and ownership

Apply the shared [personal policy](skills/rill-preferences/references/personal-policy.md).
Rill owns the owner's preferences and their verified integration with native controls. Installed Matt Pocock skills own the engineering methods, as recorded in [#10](https://github.com/hughzadora/Rill/issues/10). Raw ideas pass through Superpowers brainstorming, Matt grill-with-docs methods (grilling and domain-modeling), and writing-for-agents to distill an implementable agent-facing specification. Load the actual relevant skills; respect explicit-only wrapper invocation rules.

Project control integration applies to repositories with explicit `.rill/project.json` enrollment. Existing projects retain effective tools and structure; resolve evidenced conflicts within the authorized change. Shared personal interaction policy remains applicable outside enrolled projects.

GitHub issues own approved scope, decisions, task details, and repair history. Local recovery material is a cache of synchronized records plus an outbox of unsynchronized facts. Keep unique outbox records until publication and readback succeed. Repository source, actual runtime observations, and current-version checks establish implementation state; a task summary cannot override them.

Machine records use the GitHub numeric publisher IDs configured in `.rill/authority.json`. Enrollment must resolve the authorized account from GitHub; publisher changes require an owner decision. Other authors' marker comments remain source data and cannot change execution state. Missing author metadata requires recovery before dependent work. This identifies publishers, not human approval or semantic correctness; local configuration and hooks remain bypassable.

## Delegation

Use the native defaults and role definitions in `.codex/`, adopted from the owner's commercial-kitchen-b2b configuration. Hand off implementation serially with fresh context, a bounded goal, owned files, source references, required checks and a completion condition. Choose one read-only review role for the batch's risk. Avoid full-history forks, recursive delegation, repeated investigation by the coordinator and worker, and per-step review churn. Model availability and existing-session overrides must be verified; configuration alone does not hot-switch the current chat or impose a token budget.

## Design and delivery

The [HTML review view](DESIGN.html) presents the approved design with observed evidence and remaining boundaries. Its dated snapshot is a view; #17/#18 remain authoritative.

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

Before preparing the batch PR, use the delivery tools against the task's single `rill-acceptance:v1` block. Stable criterion IDs project the existing specification; independent review must check that the projection is exhaustive. `delivery-audit` checks all pre-PR criteria, the actual full-spec entry, current candidate/environment, evidence hashes, review metadata and the exact candidate/scope-bound native owner answer. Explicit unverified command items need evidence mappings. A passing audit must be published and read back; live readiness rechecks its artifacts without rerunning their commands.

Review metadata and native observation envelopes establish integrity and declared context, not authenticated execution or semantic correctness. Retain original native runs and the actual independent review. Retraction preserves the old pass, marks affected acceptance unknown and rejects the invalidated evidence; valid corrected evidence can pass again. If an incorrectly closed issue needs reopening, use the separately authorized native GitHub operation; recording a retraction does not change remote issue state.

The declared GitHub create/merge tool paths synchronize authority and consult the delivery guard. This is a supported local hook path, not a shell classifier, external-write authorization or repository merge protection. Other invocation paths and disabled/untrusted/failed hooks require separate verification. Final combined-package native execution remains subject to the current task's acceptance evidence.
