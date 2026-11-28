---
id: ADR-004
title: Defense-in-depth secret handling with gitleaks, gh-safe, and cloud-side redaction
status: active
last_updated: 2026-11-28
related_code:
  - .gitleaks.toml
  - packages/tooling/gh-safe.ts
  - .github/workflows/issue-sanitizer.yml
---

# ADR-004: Defense-in-depth secret handling with gitleaks, gh-safe, and cloud-side redaction

## Status

active

## Context

Solo operation means a single maintainer reviews issues, comments, and CI output. Secrets can
reach the repository through five distinct routes: pasted into an issue, committed by mistake,
logged by CI, typed into a script, or retained in a local environment file. A single check at
one of these routes leaves the others open.

## Decision

Enforce layered detection with `gitleaks` as the single detection engine:

1. Local scan and full-history scan as mise tasks.
2. Staged-file scan in the pre-commit hook with `--redact`.
3. `gh-safe` CLI that redacts host paths and internal IPv4 addresses, pipes through
   `gitleaks stdin --redact`, and refuses to emit output containing findings; it also
   rate-limits a given issue or PR target to three events per rolling ten minutes.
4. A GitHub Actions workflow that redacts issue and comment bodies through the GitHub API and
   applies a `sanitized-content` label.

## Consequences

- Detection rules live only in `.gitleaks.toml`; no second pattern list is maintained.
- Redaction is best-effort for free text and deterministic for known credential formats.
- `.env.test` holds mock values only and is allowlisted, so it never masks a real secret.

## Related

- docs/adr/README.md
- AGENTS.md
- docs/INDEX.md
