---
id: DOC-001
title: Agent instructions
status: active
superseded_by:
last_updated: 2026-11-28
related_code:
  - mise.toml
---

# Rill

Read [the engineering constitution](.specify/memory/constitution.md) before changing the repository. Write engineering artifacts in English and owner-facing messages in Simplified Chinese.

## Scope and plan

- Choose the delivery path from the constitution and the scope of the change.
- Locate the affected public contracts, callers, tests, and established verification commands. Reuse existing conventions. Read completed feature records when tracing a relevant decision or contract.
- Decide routine details independently. Escalate the cases named in the constitution with the blocker, impact, and recommended option. Continue independent work where possible.

## Implement and verify

- Record a regression baseline when feasible. Fix the responsible layer and update affected callers, current contracts, and tests. Use isolated fixtures and the established runner. Keep host settings and unrelated workspace changes out of the task.
- Keep TypeScript strict. Use native lint and type checks, and document material exceptions for owner review. Keep test assertions intact and apply the constitution's protected-boundary proof when modifying or deleting an existing test.
- Run relevant targeted checks during diagnosis. Run `mise run verify` before committing. Record actual commands, outcomes, and what ran. A zero-package run verifies template configuration. Feature acceptance must exercise the changed public behavior.
- Build deliverable TypeScript packages with tsdown. Validate runtime environment variables at the application entry point with env-core and Zod. Use fast-check for invariants with meaningful input ranges. Add a Stryker mutation task for release-critical logic and run `mise run qualify` before a release. Follow the package setup in [README.md](README.md).

## Settle and report

- Update affected specs and acceptance evidence. Mark the feature complete when its tasks and acceptance criteria are satisfied. Preserve completed evidence in the corresponding feature directory.
- Commit each verified logical unit with a conventional English message explaining what changed and why. Inspect the selected changes for unrelated edits, temporary files, and sensitive data. Commit task-owned changes only, preserve existing work, and check for remaining task-owned changes before delivery.
- Report outcomes, verification, applicable UI preview, spec changes, existing test-change proofs, and local commits. Identify any outstanding blocker and the evidence needed to resolve it.
- Scan outbound drafts and changes with Gitleaks before authorized publication. Obtain explicit authorization for pushes, publishing, and protected-branch merges.

## Regression evidence

- Record the invariant, representative inputs, and observable acceptance criteria at the level of detail the change warrants. For a defect, capture the smallest reproducible case or explain why it cannot be reproduced.
- In the implementation record, link the responsible contract and include evidence across representative inputs. Reject unexplained literals, fixture-dependent branches, one-off compatibility paths, and changes that only mask the failing symptom. Use standard tools and configured tasks as the verification entry points.
- After two attempts without new evidence, stop repeating the same change. Record the hypothesis, observation, and next discriminating check. Escalate after three failed root-cause strategies.
