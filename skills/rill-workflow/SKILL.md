---

name: rill-workflow
description: Develop, repair, deliver, or resume tasks in projects explicitly enrolled with .rill/project.json, preserving approved scope and GitHub task evidence across interruptions.
---

# Rill workflow

Apply [personal policy](references/personal-policy.md). For an enrolled project, read its policy and current GitHub task before dependent work. Read actual configuration and existing commands rather than copying tool inventories from historical examples.

## Develop and deliver

1. Establish the authorized outcome, complete acceptance, current task, branch, and worktree. Resolve discoverable facts with tools; ask the owner for consequential missing choices through native controls.
2. Establish the whole design before implementing slices. Use the project's approved lifecycle and human checkpoints. Record decisions before dependent edits; keep each slice mapped to full acceptance.
3. Implement in dependency order, preserving effective project structure. Use existing native tools and checks. Record material findings, completed checks, outstanding details, and the next action in the current task as work proceeds.
4. Run batch acceptance, obtain independent candidate-matched review and human acceptance, then deliver the authorized PR. Verify actual merge/publication and resource cleanup when authorized. This step is complete only when each claimed outcome has matching evidence.

## Repair

Trigger: a user behavior fails, a regression appears, or a repair attempt does not establish the original acceptance.

1. Preserve the original reproduction, independently justified expected result, and related behaviors. Distinguish observations from causal hypotheses.
2. Run an experiment that distinguishes candidate causes before repairing the owning implementation. Capture actual input/output, exit, candidate identity, and evidence location.
3. Record each modification-and-verification attempt against the same original problem. Two consecutive failed repair rounds require re-diagnosis; obtain new discriminating evidence before another repair. A new hypothesis, chat, or agent keeps the accumulated history. Unverified environment failures are not successful repairs.
4. Stop repeated diagnostics that produce no new evidence. Independent review/fix converges within three rounds; report unresolved findings and reconsider the approach at that boundary.
5. Verify the original path and related required behavior. Correct an invalid test only with an approved requirement or current upstream contract as its basis. Cleanup adds necessary regression protection. Repair is complete when actual current-candidate behavior meets acceptance, not when its documentation says so.

## Resume

Trigger: startup, resume, compaction, fork, or an interrupted handoff.

1. Identify the repository, current GitHub task, branch/revision, uncommitted changes, and task-owned runtime resources. Preserve unrelated work.
2. Load the authoritative task and relevant history; use the last verified snapshot when offline. Preserve new local facts as pending synchronization. Reconcile remote changes before publishing delivery conclusions.
3. Recover requirement identifiers, exclusions, decisions, outstanding acceptance, failed attempts, invariants, evidence versions, and the next action. Compare the record's covered native history with newer corrections and failed experiments. An unreadable or incomplete history remains unknown.
4. Reconcile the record with actual code and runtime. Older checks do not validate newer changes. Retrieve missing facts from their sources; pause only dependent modifications if a critical requirement remains unavailable.

Recovery is complete when the working task, original acceptance, constraints, failure history, actual state, and next action agree. Field presence alone does not establish that agreement.
