---
id: ADR-001
title: Bun as the sole runtime, toolchain, and package manager
status: active
last_updated: 2026-11-28
related_code:
  - package.json
  - mise.toml
  - bun.lock
---

# ADR-001: Bun as the sole runtime, toolchain, and package manager

## Status

active

## Context

The repository previously used generic npm-style commands and a mix of `bunx` and mise-resolved
binaries. Temporary checkouts that lacked `node_modules` could not resolve tools, and repeated
`npm install` invocations re-resolved transitive dependencies on every run, which made CI
flaky and local gates slow.

## Decision

Adopt Bun 1.4.5 exclusively for runtime, test execution, script running, and dependency
installation. The version is pinned in `mise.toml` and asserted by the repository contract
tests. No other package manager is used, and lockfile changes must come from `bun install`.

## Consequences

- Tool resolution is consistent between the repository root and temporary checkouts.
- `bun install` is the only path that mutates `bun.lock`.
- Contributors must install Bun before running any gate; the DevContainer provides it.

## Related

- docs/adr/README.md
- AGENTS.md
- docs/INDEX.md
