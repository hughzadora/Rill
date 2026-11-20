# Rill Engineering Policy

The current product contract is [PRD.md](PRD.md); supported language gates
are [QUALITY_STANDARD.md](QUALITY_STANDARD.md); agent roles are
[MULTI_AGENT.md](MULTI_AGENT.md); live task authority is native GitHub.

## Responsibility

Owner: initial intent, prototype experience, consequential design, final
real-product inspection, protected approvals. Agents: investigation, tool
selection, implementation, diagnosis, testing, documentation and review.
Do not require the owner to run commands, resolve routine formatting errors,
or manually translate Markdown into task status.

An HTML console supports visual exploration and progress inspection. It
cannot authorize a decision. Use actual native harness structured choices
for consequential human input and platform approval for protected actions.

## Engineering rules

- Upstream and native first. Do not clone a Codex or Claude scheduler,
  session database, permission model or agent runtime.
- Complete applicable correctness/security gates. An initial fast coding
  stage can defer _new_ unit tests, but must run existing regressions.
  Cleanup adds focused tests; release includes full verification.
- Apply a deterministic check, type boundary or stronger API to repeated
  mistakes. A growing AGENTS.md is not an enforcement mechanism.
- State symptom, real mechanism and durable fix before changing failing
  code. Avoid magic numbers, global mutable state, duplicated configuration
  and unexplained exceptions.
- Do not game coverage, lower thresholds, exclude newly discovered source
  or turn red checks green by no-op implementations.
- Review real effects, not explanation quality. An independent reviewer
  evaluates the exact candidate independently of its implementer.
- Link scope and evidence through native parent/sub-issues and PRs; update
  issue _bodies_, not streams of progress comments.

## Lifecycle

Requirements -> prototype -> interactive design -> agent implementation ->
integration and user trial -> deep clean and new tests -> second full
verification with owner click -> focused PR. Small changes may combine stages
without weakening relevant checks.

No unapproved spending, paid fallback, production access, global plugin
uninstall, external irreversible change, data migration or merge.

## Evidence vocabulary

Proposed, configured, locally executed, hosted CI executed, observed real
application, independently reviewed, owner accepted and released are
**different states**. Each needs an exact version and an appropriate source.
A successful unit fixture is not a production-quality factory release.
