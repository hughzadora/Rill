# Rill Knowledge Base Index

> Single routing entry. Indexes only documents with lifecycle `active` (`00-constitution`, `01-specs`). Obsolete documents are deleted, not archived.

## 00-constitution — Core architecture & invariants (read-only)

| Document                                                             | id      | One-line summary                                                                                                                               |
| -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`00-constitution/ARCHITECTURE.md`](00-constitution/ARCHITECTURE.md) | ADR-001 | Rill repo architecture boundary, dependency direction, tsrs type-check, oxfmt/oxlint single ownership, knip dead code, Git worktree invariants |
| [`00-constitution/DESIGN.md`](00-constitution/DESIGN.md)             | ADR-002 | Interface design principles, anti-patch-cheating contract, test-assertion isolation                                                            |
| [`00-constitution/OWNER_TASTE.md`](00-constitution/OWNER_TASTE.md)   | ADR-003 | Platform (macos-26/arm64), anti-patch-cheating, writing taste, Git workflow, tooling taste (non-negotiable)                                    |

## 01-specs — Active feature/interface specs

| Document                                                 | id       | One-line summary                                                                                                                     |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`01-specs/PROJECT.md`](01-specs/PROJECT.md)             | SPEC-001 | Rill product brief: adoption, first acceptance, complete delivery                                                                    |
| [`01-specs/ADLC_MASTER.md`](01-specs/ADLC_MASTER.md)     | SPEC-002 | ADLC zero-friction execution protocol: 13-stage pipeline, anti-cheating rules, independent-review checklist, issue contract template |
| [`01-specs/DOMAIN.md`](01-specs/DOMAIN.md)               | SPEC-003 | Single-context doc layout: glossary, ADR decisions, domain modeling entry                                                            |
| [`01-specs/ISSUE-TRACKER.md`](01-specs/ISSUE-TRACKER.md) | SPEC-004 | GitHub issue/tracker operations: create, read, sub-issues, dependencies, labels, comments, close                                     |
| [`01-specs/TRIAGE-LABELS.md`](01-specs/TRIAGE-LABELS.md) | SPEC-005 | Default mapping from engineering skill roles to GitHub labels                                                                        |

## 03-research — Tech-selection investigations & lessons learned

| Document | id  | One-line summary                 |
| -------- | --- | -------------------------------- |
| —        | —   | No active research documents yet |
