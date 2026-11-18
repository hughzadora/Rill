# Rill product requirements

## Purpose and users

Rill is a personal preference layer and set of native adapters whose execution must be verified for the owner's Codex projects. It helps an owner and coding agent carry approved decisions into work, resume a real task with its failure history, and distinguish recorded evidence from actual acceptance. The owner makes product decisions and performs or selects the final human check; Codex remains responsible for sessions, permissions, native interaction, and scheduling.

Rill serves both new repositories and existing repositories. Existing projects retain effective tools and structure; the owner explicitly enrolls each project that should receive the project workflow. Shared personal policy can also be installed in the user's native agent instructions.

## Jobs and observable requirements

### Apply preferences without replacing engineering methods

- Provide a short shared entry that directs agents to the relevant personal policy and project entry.
- Rill owns personal preferences, project enrollment, task continuity, evidence records, and their native control wiring. Installed Matt Pocock skills own engineering methods.
- For consequential choices, use the host's native input control; use native approval mechanisms for approvals. Investigate available facts before asking.
- Agent defaults are cost-aware: Sol medium coordinator, Luna high worker/explorer/default, Sol low routine reviewer, and Sol medium risk reviewer. Native concurrent thread cap is two. Work is handed off serially with fresh context; agents do not recursively delegate. Defaults do not hot-switch existing chats and do not automatically escalate model or effort.

### Enroll and leave a project

- Enrollment binds an explicitly selected GitHub repository, resolves the authorized publisher identity, preserves effective project configuration, and enables the project's native plugin entry.
- A project task is bound to an issue in that enrolled repository. A different repository, publisher conflict, or unresolved task identity requires reconciliation before dependent work.
- Leaving disables the project plugin entry and retains recovery data, authority configuration, and shared personal policy. Native configuration reload and hook processing are distinct effects.
- New-project and existing-project setup must be demonstrated in real native use; declarations and local no-op behavior alone do not prove hook deactivation.

### Resume work from authoritative task history

- GitHub issues hold approved scope, decisions, task details, and repair history. Local recovery data is a rebuildable synchronized snapshot plus a durable outbox of local facts not yet published and read back.
- Resume checks the actual repository, task, branch, revision, working tree, task facts, and supported native history. It identifies complete, incomplete, unknown, and next work, including exclusions and failed attempts.
- A complete previously checked cache can support already authorized work while offline. New facts remain pending synchronization. Missing critical requirements pause only dependent work; independent investigation can continue. Delivery is not confirmed until synchronization and readback succeed.
- Missing, corrupt, stale, confused, incomplete, or over-limit recovery state must be exposed as a gap. It must not silently overwrite pending facts or claim semantic reconciliation from metadata alone.

### Record real repair and delivery evidence

- A repair record binds the original problem, check/diagnosis/interpretation, candidate revision, command, output and exit status. Failed attempts persist across chats, compaction and agent changes.
- Two consecutive failed repair rounds for the same original problem require new discriminating diagnostic evidence before another repair. Repeated diagnostics without new information stop. Independent review/fix is capped at three rounds before reconsidering the approach.
- A completed repair requires the original observable behavior to be checked on the current candidate, with relevant behavior preserved. A written explanation, checklist, or green unrelated command is not proof.
- Delivery acceptance is bound to the approved scope and current candidate. Retraction preserves prior evidence while restoring affected acceptance to incomplete or unknown.

## Scope and exclusions

The approved scope is the shared personal policy, explicit project enrollment, reliable task recovery, real repair records, and combined native control wiring through hooks and MCP. Rill does not provide a general engineering methodology, its own session store or scheduler, a replacement approval UI, a parallel task database, or a general workflow engine. It does not turn local hooks into repository merge protection or external-write authorization.

## Acceptance authority and current boundary

The complete approved design and decisions are in [issue #17](https://github.com/hughzadora/Rill/issues/17); the live scope, evidence, and remaining delivery gates are in [issue #18](https://github.com/hughzadora/Rill/issues/18). The delivery process and checkpoints are in [issue #16](https://github.com/hughzadora/Rill/issues/16). These root documents are the project development entry and navigation aid; GitHub remains decision and execution authority.

Observable acceptance covers project entry/exit, native discovery/trust/execution/failure, manual and automatic compaction plus new-chat recovery, offline facts and synchronization, recovery negative cases, repair-loop behavior, invalidated acceptance, actual full-spec checks, independent review, and owner acceptance against the final candidate. The currently recorded delivery is still in progress: candidate 0.1.3 is distinct from installed trusted 0.1.2; final full-spec CI, independent whole review, owner acceptance, and batch PR remain pending in the #18 snapshot. This document does not certify any of those gates.

The stable acceptance IDs in #18 locate the source requirements: ENTRY, DESIGN, RESTORE, RECOVERY, REPAIR, COMPLETION, CI, NATIVE, PILOT and REVIEW are pre-PR gates; PR is verified after creation. Their complete definitions and evidence stay in that single task record. In particular, the CI requirement is risk-based incremental feedback followed by one local full-spec run for an unchanged final candidate, with affected rechecks or a full fallback after relevant changes; the rule and its boundaries are owned by [personal policy](skills/rill-preferences/references/personal-policy.md).
