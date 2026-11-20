# Project Management and Delivery Operations

## Native authority

Rill is a standard applied to many different project repositories. Each
project owns its requirements, product-specific backlog and release history.
Do not keep a separate Rill task-status database.

Use GitHub native parent/sub-issues for work breakdown, linked dependencies
for blockers, PRs for implementation and review, and GitHub Projects fields
for Status, Priority, Iteration and Owner where configured. Projects' built-in
automation can update status when issues close or PRs merge, but neither
event proves user acceptance.

The local read-only console can join configured GitHub Projects v2 Status and
Priority through `RILL_GITHUB_PROJECT_ID` (the native ProjectV2 node ID in
the preview process environment). If it is missing, inaccessible or a field
is unset, the board displays **未知** rather than inferring an Issue stage
from its open/closed state. The adapter never writes Projects fields.

## What the console must show

- **Portfolio:** current selected product/repository, Rill standard adoption,
  stack, version, compatibility, owner action, release readiness.
- **Execution:** workstreams, native sub-issues, dependencies, blockers,
  assignee, priority, current stage and true last update.
- **Acceptance:** positive/negative paths, test and evidence progress,
  evidence source, linked PR and reviewer, unknown prerequisites.
- **Quality:** actual candidate/branch, CI rollup, gate failures, runtime
  and user behavior proof, uncovered source, security debt and waivers.
- **Handoff:** facts that the next agent needs: current issue, next safe
  step, unresolved owner decision, revision and repeatable checks.
- **Artifact navigation:** click through prototypes, screenshots, code,
  design and test evidence without reading long raw issue bodies by default.

Every displayed field must identify source or say UNKNOWN. The interface
can search, filter, group, expand, compare and navigate, but cannot
pretend a click is authorized task mutation or native harness approval.

## Issue lifecycle and minimum durable record

Each parent has product intent and acceptance. Each native child includes
outcome, scope, dependencies, reproduction or user path, positive/negative
acceptance, current candidate, actual check results and next responsible
action. The permanent bug parent contains defects with reproduction, cause,
negative regression and actual fix verification.

Meaningful work states are untriaged, ready, active, blocked, verification,
awaiting owner, delivered and unknown. Do **not** map all OPEN issues to
"In Progress" or all CLOSED issues to verified delivery.

A fresh agent starts from the repository's parent and relevant child,
compares branch/PR/CI state, and uses [HANDOFF.md](HANDOFF.md). At a task
boundary update the child **body** and PR. Do not create a comments log,
transcript replica or redundant JSON task database.

## Current Rill issue topology

- [#22](https://github.com/hughzadora/Rill/issues/22): active engineering
  parent for Rill factory modernization.
- [#23](https://github.com/hughzadora/Rill/issues/23): permanent bug parent.
- [#24](https://github.com/hughzadora/Rill/issues/24): native
  lifecycle continuity, Hooks and MCP execution evidence.
- [#32](https://github.com/hughzadora/Rill/issues/32): complete
  versioned factory distribution and external product acceptance.
- #25–#29: consolidated historical workstreams; outstanding
  acceptance remains tracked by #22, #24 and #32.
- [#31](https://github.com/hughzadora/Rill/issues/31): older user-installed
  plugin still requires native-session verification.

These documents are not claims that a Rill-specific GitHub Project or
cross-repository automatic adoption is already installed.
