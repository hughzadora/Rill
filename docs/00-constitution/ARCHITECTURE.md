---
id: ADR-001
title: Rill Architecture & Invariants
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - tsconfig.json
  - .oxfmtrc.json
  - .oxlintrc.json
  - knip.json
  - src/template.ts
---

# Rill Architecture & Invariants

Single source of truth for the Rill repository's own architecture boundary, type contract, formatting, lint, dead-code, and Git worktree rules. Every Agent modifying this repo reads this first.

## Dependency direction (fixed)

One rule governs all source layout:

- `src/template.ts` — build/pack entry; imports no internal business module.
- `tests/tooling/` — tooling contract tests; import only `src/template.ts` public exports and `bun:test`.
- `tests/behavior/` — behavior tests; depend only on the built release kit and `bun:test`.
- `template/` — consumer-side template; not imported by Rill source; shipped only with the kit.
- Forbidden in `src/`: imports from `template/`, `tests/`, `docs/`, `workflow/` or any non-source directory.

**Leading word: `boundary`.** `src/` stays pure; nothing outside `src/` enters it.

## Type checking (tsrs sole authority)

- `tsconfig.json` is the only type-check config: `types: ["bun"]`, `module: "Preserve"`, `moduleResolution: "Bundler"`, `target: "ES2022"`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- `TSRS_FAST=0`; speed mode never changes diagnostics.
- Oxlint `--type-aware` is backed by tsrs; no second checker (`tsc`, `oxlint-tsgolint`) is installed or allowed.
- `bun test` / `bun run build` green does not substitute for `tsrs --noEmit`.

**Leading word: `tsrs`.** One type authority, zero escapes.

## Formatting (Oxfmt sole owner)

- `.oxfmtrc.json` is the only format config. Ignores `bun.lock`, `mise.lock`, `node_modules/**`, `dist/**`, `reports/**`, blueprint files.
- One file, one formatter: Biome/Prettier never enabled alongside Oxfmt.

**Leading word: `oxfmt`.** Format is decided by Oxfmt alone.

## Static checking (Oxlint explicit safety rules)

- `.oxlintrc.json` enables `typescript`/`import`/`unicorn`/`jest`; `correctness` is `error`.
- Required target behaviour: explicit types, no `any`, no unsafe assignment/argument/call/member-access/assertion, no floating promises, no TS comment suppression, no global assignment, no implicit globals, no empty blocks, no focused/disabled tests.
- Syntax gaps not covered natively are filled by `sgconfig.yml` ast-grep rules; never duplicate an existing acceptance condition.

**Leading word: `explicit`.** Every type and promise is explicit; nothing implicit passes.

## Zero dead-code tolerance (knip)

- `knip.json` entry: `src/template.ts`, `src/**/*.ts`, `tests/**/*.ts`; ignores `template/**`, `dist/**`, `rill-test-project/**`.
- Every iteration ends with `bunx knip` exit 0; orphan files and unused exports are removed; no `funcV2` alongside the old function.

**Leading word: `knip`.** Dead code is deleted, not parked.

## Git worktree

- Worktrees live in `.worktrees/`; primary worktree stays clean.
- Before deletion: `git status --porcelain` empty; branch tip is an ancestor of base.
- Merge: `git branch -d` (never `-D`). Lock: `git worktree lock`; unlock explicitly after done. Never `git worktree remove --force`.

**Leading word: `clean`.** Tree and branches are clean before and after every operation.
