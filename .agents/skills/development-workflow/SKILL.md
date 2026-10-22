---

name: development-workflow
description: Deliver Rill features, bug fixes, refactors, and behavior-changing configuration through native design, implementation, and independent review. Use proactively for these tasks even when the user does not mention agents or design. Exclude read-only explanations, status lookups, and mechanical wording-only edits.
---

# Development workflow

Run this workflow using actual native subagents. This skill explicitly requests delegation for matching tasks. As the primary, establish the baseline and spawn the design agent next; do not perform its design/research assignment yourself first. If already delegated a bounded task, perform only that assignment and return evidence; do not start another workflow or spawn descendants. The repository kernel remains the sole policy authority.

## 1. Establish the task

- Read the current branch, HEAD and working-tree status. Preserve unrelated changes. Identify the approved outcome, observable acceptance and review base from the request and native Issue/PR; create or update the existing GitHub record when authorized, without assigning priority.
- Load only relevant project files and the matching engineering skill from the capability map. Use deterministic extraction before model investigation. Do not ask the owner to choose tools, execute commands or approve routine internal phases.
- Use the exposed native `spawn_agent` tool with a descriptive `task_name` and `fork_turns="none"`; put the bounded role assignment in `message`. These are real native tasks, not custom role-file selection. Keep inherited model, effort, provider and permissions; do not pass unadvertised role arguments. If spawning is unavailable, report that capability gap and continue only independent safe work without claiming the workflow passed.
- Keep at most two active delegated agents and respect the native capacity reported by the host. Prefer two tasks: a read-only `planner` later reused for implementation review, and a `worker`. Check native status, reuse completed tasks with `followup_task`, and interrupt only running work when necessary. Do not call an absent close tool or equate interruption with closure. Parallelize only independent investigations or disjoint write scopes. The primary alone owns the shared Git index, commits and remote mutations unless ownership is explicitly transferred.

## 2. Design before editing

Spawn `planner` with a read-only assignment before the first implementation edit. Supply the approved outcome, baseline SHA, relevant paths, constraints, acceptance and stop condition. While it works, the primary may run independent read-only checks.

Require a concise design result with:
1. Verified current behavior and evidence; explicit unknowns.
2. The smallest supported native approach, the reason for it, and any material rejected alternative.
3. Interfaces or user flow, affected files, write ownership and implementation order.
4. Observable acceptance, meaningful negative/boundary cases and exact checks.
5. Risks, recovery and what would block delivery.

For a user-facing change, include visual hierarchy, keyboard/focus, accessibility and loading/empty/error/recovery states, plus how rendered behavior will be inspected. For tooling or configuration, design the actual invocation, loading, failure and recovery behavior. A paragraph of aspirations is not a design result.

The primary resolves routine engineering choices from evidence, records the distilled decision in the existing Issue/PR when appropriate, and retains the completed read-only planner for independent implementation review. Only a genuinely missing product decision or protected operation goes to the owner's native choice/approval control.

## 3. Implement a bounded change

Spawn `worker` with the accepted design and a delegation packet: task, baseline SHA, explicit writable files, read-only exclusions, acceptance, required evidence and stop condition. Give distilled context; do not forward the entire conversation. Allocate one writer per file/index scope. If the parent already authored a portion, name that portion so the worker does not overwrite it.

The worker reproduces a behavioral defect before fixing it when applicable, uses the locked tools, and reports changed files, actual commands/exits, evidence locations and unresolved risks. Tests must verify the public behavior and meaningful failure cases. The worker stops after its assignment and never self-certifies independent review.

The primary integrates the result, checks the actual diff and scope, runs relevant deterministic checks and creates an immutable candidate commit. Confirm the worker has finished before review; interrupt it if necessary. Do not change the candidate during review.

## 4. Independently review the candidate

Give the completed read-only planner an independent reviewer assignment through native `followup_task`; it has not authored implementation files. Supply the review base and candidate SHAs, approved acceptance, relevant standards and actual check evidence. Never reuse the implementation author as its own reviewer. Use a separate fresh reviewer task when the proposed reviewer authored any part of the candidate or a distinct risk requires it, within native capacity. For a small increment one non-author reviewer covers both Standards and Spec.

Require findings with file/location, impact and reproduction or source evidence. Require a separate verdict for Standards and Spec and a list of unverified acceptance. A tool failure, unavailable integration or claimed-but-unrun test is not a pass. Record the native reviewer thread identity and candidate SHA.

Fix substantive findings in a new candidate, rerun affected checks and obtain review of the changed revision. Reuse an independent reviewer for a bounded delta when available. Do not carry a passing verdict onto unreviewed substantive changes or turn a model review into a human GitHub approval.

## 5. Deliver and recover

- Run the required `just gate` for the final candidate. Preserve raw logs outside maintained source and attach a compact command/exit/result digest to the Issue/PR. Reuse unchanged evidence only within its actual scope.
- Push the authorized branch and prepare the PR with the design decision, changed behavior, candidate SHA, distinct thread identities, test evidence and remaining limits. Merge only within existing authorization and native approval controls.
- Distinguish native enforced controls, behavioral instructions, locally observed execution and unavailable acceptance. Implicit skill invocation and role instructions are not deterministic scheduling or a permission sandbox.
- On an observed allowance warning, stop optional expansion and reserve review/gate capacity. On exhaustion, stop model-dependent work without retry storms or a paid fallback. Interrupt unnecessary running work and leave branch/SHA, completed checks, blockers and the exact next action in the existing Issue/PR and native session; do not create a parallel task database.
- Report to the owner in Simplified Chinese using `### Result`, `### Evidence` and `### Next`. Keep project artifacts in English. Report an incomplete review or blocked delivery explicitly instead of declaring overall success.
