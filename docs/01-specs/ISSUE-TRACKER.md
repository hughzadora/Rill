---
id: SPEC-004
title: GitHub Issue Tracker Operations
status: active
superseded_by:
last_updated: 2026-11-27
related_code: []
---

# GitHub issue tracker

Specs and tickets live in GitHub Issues for `hughzadora/rill`. Run `gh` from the repository root. Confirm the target with `gh repo view --json nameWithOwner` before creating issues. Use `--body-file` for multiline issue bodies and comments.

## Issue operations

- Publish a spec or ticket with `gh issue create`.
- Read a ticket with `gh issue view <number> --json number,title,body,labels,comments,blockedBy`.
- Find open tickets with `gh issue list --state open`, adding label filters as needed.
- Attach a ticket to its spec with `gh issue create --parent <spec-number>` or `gh issue edit <spec-number> --add-sub-issue <ticket-number>`. If sub-issues are unavailable, add `Part of #<spec-number>` to the ticket.
- Record blockers with native issue dependencies using `gh issue create --blocked-by <numbers>` or `gh issue edit <ticket-number> --add-blocked-by <blocker-number>`. If native dependencies are unavailable, put `Blocked by: #<number>` at the top of the ticket. A ticket is ready when all its blockers are closed.
- Apply or remove triage labels with `gh issue edit --add-label` or `--remove-label`. See [triage labels](TRIAGE-LABELS.md).
- Record the result with `gh issue comment <number> --body-file <path>`, then close the issue with `gh issue close <number>`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding

Use one `wayfinder:map` issue with sub-issues tagged `wayfinder:<type>`. Work on open, unassigned children whose blockers are closed, in map order. Claim a child with `gh issue edit <number> --add-assignee @me`. After resolving it, add the result and a link to the map's Decisions-so-far section.
