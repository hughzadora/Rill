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
