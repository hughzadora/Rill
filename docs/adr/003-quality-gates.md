---
id: ADR-003
title: Type-resolved toolchain with tsrs, oxlint, oxfmt, and depcruise
status: active
last_updated: 2026-11-28
related_code:
  - package.json
  - mise.toml
  - .oxlintrc.json
  - .oxfmtrc.json
  - .dependency-cruiser.cjs
---

# ADR-003: Type-resolved toolchain with tsrs, oxlint, oxfmt, and depcruise

## Status

active

## Context

The repository needed a gate stack that is fast enough to run on every commit and strict enough
to block patches that weaken assertions. Adopting the mainstream TypeScript toolchain keeps the
configuration in files the wider ecosystem understands and avoids hand-written checkers.

## Decision

- `tsrs` is the only type checker (`typecheck`).
- `oxlint` is the only linter, with `typescript/no-explicit-any` and `typescript/ban-ts-comment`
  as errors plus rejected focused and disabled tests.
- `oxfmt` owns TypeScript/JavaScript formatting; `dprint` owns Markdown, JSON/JSONC, YAML, and
  TOML.
- `dependency-cruiser` enforces the no-circular-dependency rule over `src/`.
- `knip` reports unused dependencies, exports, and files.
- `ast-grep` enforces the no-hardcoded-secret, no-disabled-lint, no-todo-fixme, and
  no-any-assertion rules.

## Consequences

- A single `bun run check-fast` covers formatting, lint, typing, custom rules, and dependency
  direction.
- The two formatters must not overlap; `.oxfmtrc.json` ignores the dprint-owned formats.
- Tool versions are managed by `bun install`, not ad-hoc global installs.

## Related

- docs/adr/README.md
- AGENTS.md
- docs/INDEX.md
