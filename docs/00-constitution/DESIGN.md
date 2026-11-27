---
id: ADR-002
title: Rill Design Principles & Anti-Cheat Contracts
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - src/template.ts
  - tests/tooling/run-suite.ts
---

# Rill Design & Anti-Cheat Contracts

Single source of truth for Rill's interface design principles and anti-patch-cheating rules. Read before changing interfaces or tests.

## Depth module principle

One concept, one module:

- Module = interface + implementation. Interface is everything callers (including tests) must know: type signatures, invariants, sequencing constraints, error modes, required configuration, performance characteristics.
- Depth = large behavior behind a small interface. Avoid shallow modules whose interface is as complex as their implementation.
- Deletion test: delete the module — if complexity spreads to N callers, the module should exist.
- Interface is the test surface: callers and tests cross the same interface. Wanting to "test beyond the interface" signals a wrong module shape.
- One adapter = assumed seam; two adapters = real seam. No seams without actual change.

**Leading word: `deep`.** Small interface, large behavior; no shallow wrappers.

## Test design

One rule per concern:

- Accept dependencies; do not create them internally — inject, don't instantiate.
- Return results; do not produce side effects — pure functions first, side effects concentrated at the adapter layer.
- Small surface: fewer methods = fewer tests; fewer parameters = simpler setup.

**Leading word: `pure`.** Pure domain, impure adapters at the edge.

## Anti-patch-cheating (source)

Positive target behaviour first; prohibitions only as guardrails paired with the positive:

- On any test failure or type error, do not output a patch directly. Output three causal sentences first:
  `[root cause] -> [affected upstream/downstream modules] -> [why local hardcoding/special-casing cannot fix it]`.
- User natural-language intent is converted to a machine-language spec (input/output, boundary, invariant, failure mode) before any code is written. Intent is never hardcoded as a string in `src/` (e.g. "shopping list", "no signal").
- Patch cheating — hardcoding user intent into the project — is intercepted by static checking.

**Leading word: `root-cause`.** Every failure gets three causal sentences; no patch without cause.

## Test assertion isolation

Positive rule, hard guardrail:

- Bug fixes do not alter assertion conditions in existing `*.test.ts` unless business requirements themselves changed.
- PR review uses `difftastic` structural diff to spot illicit test tampering at a glance.

**Leading word: `isolated`.** Existing assertions are frozen unless requirements change.
