---

name: development-workflow
description: Deliver Rill features, bug fixes, refactors, and behavior-changing configuration through configured native design, implementation, and review roles. Use proactively even when the owner does not mention agents or design. Exclude read-only answers, status lookups, and mechanical wording-only edits.
---

# Development workflow

This skill explicitly requests native delegation for matching work. The primary establishes the baseline and spawns the design role next, before implementation research or edits. A delegated agent performs only its bounded assignment; it never starts this workflow or spawns descendants. The repository kernel remains the sole policy authority.

## Native roles and dispatch

| Role       | Configuration and responsibility                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `explorer` | [Read-only evidence gathering](../../../.codex/agents/explorer.toml) for a concrete unresolved repository or upstream question; optional.            |
| `planner`  | [Design](../../../.codex/agents/planner.toml) before implementation, including interfaces, interactions, failure/recovery and observable acceptance. |
| `worker`   | [Implementation](../../../.codex/agents/worker.toml) of the accepted design in assigned files, with actual check evidence.                           |
| `reviewer` | [Independent review](../../../.codex/agents/reviewer.toml) of an immutable candidate; never an author of that candidate.                             |

The native TOML files are the source of truth for each role's model, effort, output controls and instructions. The owner explicitly requested per-role tuning. Keep the parent model user-selected, use the configured role settings and do not silently substitute a model, raise effort, change provider/service tier or start a paid fallback.

Use exposed native `spawn_agent` with `agent_type` matching the role's `name`, a descriptive `task_name`, `fork_turns="none"` and a bounded assignment in `message`. Do not override the file's model/effort per call or pass parameters absent from the actual host schema. Codex 0.163.0 discovers project `.codex/agents/*.toml` and exposes V2 role selection when valid custom roles are discovered. If selection is absent, inspect native loading and report the dependent acceptance incomplete; a task name or role-play prompt is not evidence that the native role was applied.

Keep at most two active delegates and respect native capacity. Complete design before starting its dependent implementation; finish the worker before starting review. V2 may unload eligible completed residents to admit the distinct reviewer, so do not invent a close operation. Reuse an existing role with `followup_task` for a bounded clarification, fix or review delta; inspect native status and interrupt only when needed. Parallelize independent reads or disjoint writes only. The primary owns the shared Git index, commits and remote operations unless a specific responsibility is explicitly transferred.

## 1. Establish the task and packet

Read the branch, HEAD and working-tree status; preserve unrelated changes. Identify the authorized outcome, acceptance and review base from the request and existing Issue/PR. Keep native GitHub records current when authorized, without inventing priority.

Every assignment supplies: the bounded task; baseline/candidate SHA; relevant paths and facts; writable paths and exclusions; acceptance and exact checks; evidence/result format and stop condition. Send distilled context, not the full conversation. Load only relevant project references and the matching installed engineering/design skill.

Only the primary communicates progress, asks essential owner questions and delivers the final answer. Children execute quietly: no greetings, progress narration, running plans, user-directed dialogue or duplicate completion messages. They return one compact result/evidence/blockers packet to the primary. A material blocker may be sent once when it needs the primary's intervention. Low verbosity and disabled reasoning summaries reduce requested output detail; they do not guarantee zero tokens or suppress native activity UI.

## 2. Obtain and accept the design

Spawn `planner` after establishing the baseline and before the first implementation edit. While it works, the primary may perform independent read-only checks. Require verified facts and unknowns, a concrete decision and tradeoff, contracts or user flow, affected files and ownership, meaningful checks, and risks/recovery.

For UI work, the design includes hierarchy, interaction, keyboard/focus, accessibility and loading/empty/error/recovery states with a rendered inspection plan. For tooling/configuration, it includes invocation, discovery/loading, failure and recovery. A paragraph of aspirations is not an implementation-ready design.

Resolve routine engineering decisions from evidence and record the distilled decision in the existing Issue/PR when appropriate. Use `explorer` only when a bounded unresolved fact merits separate investigation. Only genuinely missing product choices or protected operations go to the owner's native control.

## 3. Implement and freeze the candidate

Spawn `worker` with the accepted design and explicit file ownership. The worker reproduces relevant behavior failures, implements the scoped change and returns actual checks/exits and evidence locations. Inspect its diff and resolve any conflict with observed facts. Do not treat the worker's own conclusion as independent review.

Confirm implementation has stopped, run relevant deterministic checks and create an immutable candidate commit. Do not mutate the candidate during review. Retain full output in native logs or temporary evidence files and pass compact digests, not complete transcripts. Run affected checks during iteration; reserve the full delivery gate for the final candidate unless a concrete risk or required Git hook demands an earlier run.

## 4. Review independently and correct findings

Spawn a distinct `reviewer` that did not author the candidate. Supply base and candidate SHAs, approved acceptance, relevant standards and check evidence. For a small increment, one reviewer covers Standards and Spec. Require separate verdicts, actionable findings with location/impact/evidence and unverified acceptance. Unavailable checks are not passes.

Fix substantive findings through the responsible worker, create a new candidate and rerun affected checks. Ask the independent reviewer to inspect the changed revision or necessary delta. Do not carry a verdict onto unreviewed substantive changes or present agent review as third-party human approval.

## 5. Verify, deliver and recover

Run the required `just gate` for the final candidate and retain command/exit/result evidence. Push the authorized branch and prepare the PR with the design decision, changed behavior, candidate SHA, actual role/thread identities, tests and limits. Merge only within existing authorization and native approval controls.

For workflow/configuration acceptance, use a fresh ordinary task without telling it to delegate. Inspect native persisted history for actual role, model/effort, design-before-edit ordering, quiet child results and candidate-matched review. In Codex 0.163.0, `exec --json` can omit V2 child activity; use native `thread/read` and paginated `thread/items/list` through `nextCursor: null`. Absence from one output stream is not proof of no delegation. Keep model-based acceptance separate from daily model-free code checks.

Distinguish native enforced controls, behavioral instructions, locally observed execution and unavailable surfaces. A role's read-only assignment is not a separate sandbox; permissions remain the parent's. Native CLI evidence does not establish macOS App UI behavior or account allowance.

Read native account-window telemetry when exposed, through the host usage surface or `account/rateLimits/read`; do not infer remaining allowance from token counts or elapsed time. At an observed allowance warning, stop optional expansion and reserve review/gate capacity. On exhaustion, stop model work without retry storms or a paid fallback. Leave branch/SHA, completed checks, blockers and the exact next action in the existing Issue/PR and native session, without a parallel task database.

The primary reports to the owner in Simplified Chinese using `### Result`, `### Evidence` and `### Next`. Keep project artifacts in English. State incomplete review or blocked delivery explicitly.
