# Rill Knowledge Base Index

> Single routing entry. Indexes only documents with lifecycle `active` (`00-constitution`, `01-specs`). Obsolete documents are deleted, not archived.

## 00-constitution — Core architecture & invariants (read-only)

Architecture decision records (`docs/adr/`) and eval cases (`evals/`) are also indexed here once active.

| Document                                                             | id      | One-line summary                                                                                                                               |
| -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`00-constitution/ARCHITECTURE.md`](00-constitution/ARCHITECTURE.md) | ADR-001 | Rill repo architecture boundary, dependency direction, tsrs type-check, oxfmt/oxlint single ownership, knip dead code, Git worktree invariants |
| [`00-constitution/DESIGN.md`](00-constitution/DESIGN.md)             | ADR-002 | Interface design principles, anti-patch-cheating contract, test-assertion isolation                                                            |
| [`00-constitution/OWNER_TASTE.md`](00-constitution/OWNER_TASTE.md)   | ADR-003 | Platform (macos-26/arm64), anti-patch-cheating, writing taste, Git workflow, tooling taste (non-negotiable)                                    |

## 01-specs — Active feature/interface specs

| Document                                                           | id       | One-line summary                                                                                  |
| ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| [`01-specs/PROJECT.md`](01-specs/PROJECT.md)                       | SPEC-001 | Rill product brief: adoption, first acceptance, complete delivery                                 |
| [`01-specs/EXECUTION_PROTOCOL.md`](01-specs/EXECUTION_PROTOCOL.md) | SPEC-002 | ADLC execution protocol: 13-stage pipeline, independent-review checklist, issue contract template |
| [`01-specs/ISSUE-TRACKER.md`](01-specs/ISSUE-TRACKER.md)           | SPEC-004 | GitHub issue/tracker operations: create, read, sub-issues, dependencies, labels, comments, close  |
| [`01-specs/TRIAGE-LABELS.md`](01-specs/TRIAGE-LABELS.md)           | SPEC-005 | Default mapping from engineering skill roles to GitHub labels                                     |

## ADR and evaluation records — active decision and eval artifacts

| Document                                                 | id      | One-line summary                                                                  |
| -------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| [`adr/001-bun-runtime.md`](adr/001-bun-runtime.md)       | ADR-001 | Bun as the sole runtime, toolchain, and package manager                           |
| [`adr/002-env-validation.md`](adr/002-env-validation.md) | ADR-002 | @t3-oss/env-core plus Zod for fail-closed runtime limits                          |
| [`adr/003-quality-gates.md`](adr/003-quality-gates.md)   | ADR-003 | Type-resolved toolchain with tsrs, oxlint, oxfmt, and depcruise                   |
| [`adr/004-secret-defense.md`](adr/004-secret-defense.md) | ADR-004 | Defense-in-depth secret handling with gitleaks, gh-safe, and cloud-side redaction |
| [`../evals/README.md`](../evals/README.md)               | —       | Eval case runner: golden workflow, budget, determinism, timeout scenarios         |

## 03-research — Tech-selection investigations & lessons learned

| Document | id | One-line summary                 |
| -------- | -- | -------------------------------- |
| —        | —  | No active research documents yet |
