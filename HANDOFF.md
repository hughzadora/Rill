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
