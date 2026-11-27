---
id: SPEC-003
title: Domain Docs & Single-Context Layout
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - docs/00-constitution/ARCHITECTURE.md
---

# Domain Docs & Single-Context Layout

Single source of truth for Rill's domain terminology and decision records.

## Layout rule

Before exploring the codebase or deciding domain terminology, read the root `GLOSSARY.md` and relevant decisions in `docs/adr/` when present.

## How terms and decisions are recorded

- Use glossary terms in issue titles, implementation discussions, and test names.
- Record new terms and architectural decisions through `/domain-modeling` when settled.
- If a proposal conflicts with an existing ADR, cite that ADR and surface the conflict for review.

**Leading word: `single-context`.** One glossary, one decision log, no scattered terminology.
