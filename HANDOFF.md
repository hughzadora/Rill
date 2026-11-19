# Rill Agent Handoff and Recovery Protocol

## Durable recovery, not a transcript cache

Any new agent must reconstruct **current accepted scope and next safe action**
from GitHub, repository docs, PRs and actual Git state. Conversation
compaction alone does not prove that details survived; do not install a
parallel transcript database to work around that uncertainty.

## Fresh-session entry

1. Identify the checkout, remote, branch, HEAD, dirty paths and relevant
   upstream refs. Never assume that main is the current development branch.
2. Read [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md),
   [DESIGN.md](DESIGN.md), [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md),
   [QUALITY_STANDARD.md](QUALITY_STANDARD.md) and [MULTI_AGENT.md](MULTI_AGENT.md).
3. Inspect the selected GitHub parent and actual native child. For Rill the
   current parent is [#22](https://github.com/hughzadora/Rill/issues/22)
   and the permanent defect index is
   [#23](https://github.com/hughzadora/Rill/issues/23).
4. Inspect the applicable issue body, dependencies, PR, CI rollup and
   code differences. Validate the current candidate rather than accepting
   a previous agent's conclusion.
5. Reconstruct open acceptance, failures, owner decisions and first safe
   action. Ask the owner only when a material choice truly cannot be derived.
6. Perform investigation and implementation within authorized scope,
   preserving unrelated files. Execute the relevant quality matrix.
7. Update the native issue **body** with verifiable receipts and next work;
   commit and push authorized changes, not automatic merge/release.

## Issue-body delivery receipt

The native child should preserve the current work result and next action:

| Field              | Minimum evidence                                                |
| ------------------ | --------------------------------------------------------------- |
| Scope              | Positive/negative acceptance, exclusions and decision source    |
| Candidate          | Git SHA, branch, source roots, relevant changed files           |
| Execution          | Actual command/tool version, environment, exit, raw log link    |
| User behavior      | Real Chrome/desktop/API proof, screenshots, meaningful negative |
| Independent review | Different agent, exact candidate, findings and missing checks   |
| Risks              | Outstanding failures, incomplete sources, owner/harness blocker |
| Continuation       | Next safe operation and responsible role, not chat instructions |

For trivial fixes a short issue body and PR suffice. No issue comments as
a running work log, no separate agent-owned database, no ungrounded
"all green" status.

## Current baseline limitations

- Rill currently develops on branch codex/native-feasibility; confirm
  actual current HEAD before any source change.
- The earlier dashboard visualizes GitHub child issues but is not yet a
  full project management console or verified cross-project factory.
- The quality workspace's fixture checks are _not_ proof of standard
  installation in a real new or existing product.
- The retired user-installed Rill 0.1.2 runtime may remain globally
  available; [bug #31](https://github.com/hughzadora/Rill/issues/31)
  requires a native fresh-session observation. Do not uninstall shared
  user tools without authorization.
- Native agent TOML requests roles; actual agent dispatch and independent
  candidate review require separate observation.
- Hosted PR checks, owner prototype/design/final acceptance, real new
  and old project pilots and trusted standard distribution are not
  certified by this document.

Reverify this section at every handoff; current GitHub/Git wins over
its prose when they disagree.

## Candidate standard adoption handoff

Current #32 implementation lives in `copier.yml`,
`standards/template/` and `standards/README.md`, not in the
old retired Rill runtime. `node --test tests/standard-adoption.test.mjs`
generates temporary tagged sources and a synthetic independent real
Node HTTP application, an independent React/Tailwind Chrome UI and a
Python/Shell service to prove source-level quality and failing
regressions in all four stacks. It also validates brownfield file
preservation, upgrade and rollback.
The temp tags are **not** trusted Rill releases.

Use native Copier answers at `.rill/copier-answers.yml` for each
target project. `copier update` requires the explicit
`--answers-file .rill/copier-answers.yml` argument with this
non-default path. Check the target's complete applicable source gates
and leave non-synthetic hosted target-project acceptance open.
Never mistake existing sample fixtures or a local actionlint pass
for hosted product CI and human acceptance.

## Independent review corrections

The initial independent review of `40f616e` found five concrete
correctness gaps: nested pnpm workspace manifest path, merge queues,
extensionless Shell scripts, Python build backend reproducibility and
license/SBOM evidence. Inspect the subsequent corrective commit and
the six independent adoption regression tests before PR review.
The follow-up also excludes generated Python `.venv` and build
artifacts when copying fixtures; otherwise the harness may report
coverage on the wrong environment. Final acceptance is bound to the
latest commit, not the reviewed ancestor.

## Hosted CI / second review follow-up

Draft PR #33 initially failed hosted `Quality` at exact SHA
`8ac0365`: Actions checked out detached HEAD, whereas the preview
contract test incorrectly assumed a named worktree branch. Preserve
the true null branch and keep PR/check status explicitly unavailable,
not a guessed branch. The next hosted run must pass on the new exact SHA.
A second independent Codex review reported four more security/source
inventory issues. Read the current changes and actual CI evidence,
not the earlier green local run, before treating review as complete.

## Full-branch spec review and live GitHub Chrome evidence

A fresh read-only independent spec reviewer inspected
`origin/main...6b0fc2d` and all 39 integration commits.
It found three actionable issues: JavaScript package scripts
could be stubs, the security/source scan job did not gate
parallel language installs, and the console could select
an unrelated green run or blocked task. The current candidate
changes enforce native tool execution and actual tracked
source, add `needs: security`, filter the canonical
`Quality` workflow by exact SHA, and skip blocked issues.

A separate live GitHub browser trial read the current issue
tree, PR #33 and CI run 44517967412 using real `gh`
queries and system Google Chrome. Axe first found two
handoff status/date contrast failures (3.66:1); the corrected
display reached at least 6.13:1 and four live data views
then had zero automated WCAG A/AA findings. Actual screenshots
were captured locally for this trial, not committed or
authenticated as final owner clicks.

The standards-axis reviewer attempt hit a 225-second
execution limit without issuing a completed report. Do not
claim that review was completed. Any new SHA requires
a new hosted CI result and a scoped independent review.

## Hosted Node runtime compatibility correction

The first GitHub-hosted run for `8cc1dfb` (run 44523441361) **failed** in the
brownfield generated native Node coverage step. The workstation defaulted
to Node 26, where `--test-coverage-include-all` exists, but the generated
workflow pins Node 24.22.3, which rejects this option. This was an actual
cross-environment false local pass, not a flaky test. The corrected profile
uses supported `--test-coverage-include` and a committed-source inventory.
The adoption test harness now executes generated Node/React commands through
the _same Mise-locked Node and pnpm_ and then changes to the isolated target
project directory before execution. The fix passed its seven adoption cases
locally but requires a **new exact-SHA hosted run** before any PASS claim.

## Full-diff independent review and strengthened candidate — 2026-11-19

Two **separate fresh read-only reviewer sessions** completed at
`df636a4` against `origin/main` and #22/#32. Standards reported
five defects, Spec reported five overlapping findings. Fixes in
the next candidate include:

- Node 24's coverage omits never-loaded source. The generated Node
  profile now uses locked `c8@12.0.0 --all --per-file`; injected
  unused source fails at zero coverage, while covered source passes.
- Target-controlled Trivy settings/ignore files are disabled using
  official CLI flags; all four generated scans are checked.
- Copier rejects leading CLI-option-like path answers such as `-h`.
- GraphQL blocker page metadata are mandatory and partial results
  fail closed instead of recommending blocked tasks.
- The React profile selects an explicit Playwright `chrome` project;
  React and Node builds demand freshly emitted non-empty output files.
- The pipeline displays real clickable architecture alternatives
  without substituting a handmade HTML choice for Harness approval.
- An isolated missing-source update test proves an existing project's
  Git HEAD and product rules remain intact. Native two-version Copier
  update modifies generated CI and standard docs, and Git revert
  restores both.

One reviewer assertion was **disproved by the actual CLI**:
`gh run list --workflow .github/workflows/quality.yml` works on this
host. No spurious compatibility workaround was added.

A genuinely fresh native Codex session, with no copied transcript
and no specified issue ID, recovered #22/#32, the exact Git SHA and
draft PR #33, and actually delegated one independent Explorer task.
Project configuration reports the legacy Rill plugin disabled.
No Rill-specific hook execution was observed, but normal Codex
Hook events did occur. True autocompaction continuity is unverified.

Local verification after the edits: 9/9 isolated adoption regressions,
6/6 preview API contracts, 9/9 Chrome E2E, five real GitHub-data
Chrome/axe views with zero automated A/AA findings. Agent Desktop
reported Linux accessibility granted, but real OS window interaction
is blocked by absent DISPLAY/WAYLAND_DISPLAY in this host session.

Not yet completed: independent whole-branch final-SHA review,
new exact-SHA hosted PR CI, owner-selected external new/old product
pilots with their own hosted checks, genuine Owner prototype/design/
final Chrome clicks, approved SemVer and real deployed rollback,
license exceptions, authorized merge and user-wide plugin cleanup.
Do not mark any of these as completed by local fixtures.
