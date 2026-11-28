---
id: ADR-001
title: Rill Architecture & Invariants
status: active
superseded_by:
last_updated: 2026-11-28
related_code:
  - tsconfig.json
  - .oxfmtrc.json
  - .oxlintrc.json
  - knip.json
  - .github/workflows/ci.yml
---

# Rill Constitution

## I. Official Tooling and Reproducibility

Use GitHub Spec Kit for major assessments and work that warrants a durable delivery record. Use supported scaffolds, maintained ecosystem tools, and declarative configuration for orchestration, packaging, and verification. Obtain owner approval before introducing bespoke tooling for those capabilities. Prefer established naming, standards, and compatible open-source implementations. Manage language runtimes and tools with mise. Change dependencies and lockfiles only when required by the approved scope. Update generated artifacts through their authoritative inputs and supported generators.

## II. Verification Integrity

Define executable schemas before implementing new or changed public data boundaries. Derive types and validation from the same contract when possible. Validate Rill document metadata with `mise run docs:check`.

Use `mise run verify` for full local and on-demand remote verification. The default remote CI uses `mise run verify:fast`. Run tests through the repository runner in isolated temporary directories or ephemeral instances. Keep host configuration, shared state, and the working tree free of test side effects. Workspace packages expose `build`, `typecheck`, and `test` to Turborepo. Use `tsrs` with `TSRS_FAST=0` for TypeScript checking. Keep per-commit checks fast and put expensive matrices and benchmarks in scheduled CI when needed.

Run verification exclusively through the repository's established runners and build tools. Ad hoc verification scripts are prohibited, including temporary scripts.

For a user-facing behavior change, exercise one affected user journey through the real interface. In the existing PR verification section or linked Spec Kit acceptance record, capture setup, actions, expected and observed results, and a relevant failure case when applicable. For consequential changes, have someone who did not implement the change replay the journey from that record and report the result.

Preserve all assertions that protect product behavior. Never disable, focus, comment out, suppress, or weaken a check to pass verification. For any changed or deleted existing test, record the exact protected boundary and evidence that the replacement still catches the failure, or cite the approved product contract change and show how the new test protects the revised behavior. Include both in the commit body and final delivery report.

## III. Diagnosis and Engineering Quality

Prioritize irreversible harm, security, and data loss before delivery blockers and lower-impact work. Reproduce reported defects at the closest public seam where feasible. Distinguish observations from hypotheses and use the smallest check that can discriminate between them. Change strategy after two failed attempts without new evidence. After three failed root-cause strategies, escalate with the evidence, impact, and recommended next step. Validate untrusted boundaries, propagate actionable errors, and explain non-obvious recovery logic.

## IV. Agent Ownership and Publication

The agent owns routine delivery through a verified local commit. Escalate consequential product ambiguity, missing credentials, irreversible actions, debugging deadlocks, and external release decisions. Obtain explicit owner authorization before pushing, publishing, or merging into a protected branch. Scan outgoing artifacts for secrets using the repository's Gitleaks configuration and keep credentials and host-specific sensitive data out of transcripts and payloads.

## V. Change Records and Settlement

Use direct delivery for small, well-understood changes and Spec Kit for changes that warrant a durable specification. For Spec Kit work, review the spec and plan against the request before supplying an approval verdict and retain completed artifacts in their feature directories. For every change, update affected contracts, verify the applicable behavior, and record the observed results before delivery.

## Governance

`AGENTS.md` describes execution and evidence requirements. Apply the Constitution Check before research and after design. Record deviations and their rationale in the plan and escalate any conflict with a mandatory rule before proceeding. Amend this constitution when the repository-wide operating contract changes.

**Version**: 1.5.0 | **Ratified**: 2026-11-28 | **Last Amended**: 2026-11-28
