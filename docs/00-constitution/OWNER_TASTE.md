---
id: ADR-003
title: Owner Taste — Non-Negotiable Rules
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - AGENTS.md
  - docs/00-constitution/ARCHITECTURE.md
  - .oxlintrc.json
  - mise.toml
---

# Owner Taste — Non-Negotiable Rules

Single source of truth for the owner's personal taste. Every document, GitHub issue/PR, Codex plan/goal, and agent instruction in this repository is written explicitly with `writing-for-agents` and does not contradict this file. Tooling configuration details live in `docs/00-constitution/ARCHITECTURE.md`; this file states the non-negotiable taste only.

## Platform taste (non-negotiable)

- macOS CI runner: `macos-26` only; Apple Silicon `arm64`. Every macOS job asserts `test "$(uname -m)" = "arm64"`.
- No `macos-15`; no x86 runners for the primary acceptance path.

**Leading word: `arm64`.** Every Apple Silicon check asserts arm64 explicitly.

## Anti-patch-cheating taste (non-negotiable)

Positive target behaviour first; prohibitions only as guardrails paired with the positive:

- No `as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, empty `catch`, `.only`, `.skip`.
- No hardcoding user natural-language intent strings into `src/` (e.g. "shopping list", "no signal"). Intent is converted to a machine-language spec (input/output, boundary, invariant, failure mode) before code.
- No mocks replacing real IO: database via Testcontainers real containers; frontend via Playwright real browser + real HTTP request assertions.
- Root-cause-first on every test/type failure: `[root cause] -> [affected upstream/downstream modules] -> [why local hardcoding/special-casing cannot fix it]`.
- Test-assertion isolation: existing `*.test.ts` assertions are not modified unless business requirements changed.

**Leading word: `root-cause`.** Every failure gets three causal sentences; no patch without cause.

## Writing taste (non-negotiable)

- Steps first, reference second. Each step ends on a checkable, exhaustive completion criterion.
- Front-load the leading word. One trigger per branch. No no-ops. One single source of truth per meaning.
- No negation-only guardrails; pair any prohibition with the positive target behaviour.

**Leading word: `steps-first`.** Every document tells the agent what to do, in order, with a done condition.

## Git / workflow taste (non-negotiable)

- No direct commits on `main`; all work enters `../wt-<issue-id>` isolated worktrees; main stays clean.
- GitHub Issue (`ready` label) is the sole task contract (Stage 4 template); no local TODO files for task state.
- `mise run verify` and `mise run qualify` both exit 0 before Stage 9 review; Stage 9 independent reviewer outputs `APPROVED`.
- `bun run knip` exits 0 after every iteration.

**Leading word: `issue-owned`.** No code exists without an owning GitHub Issue.

## Tooling taste

Layer 1 secret provider (manual install, not in `mise.toml`): Infisical CLI or Doppler CLI — single-binary secret provider replacing plaintext `.env`, runtime stdout/stderr auto-redacted. User-managed manual install only; layer 1 is runtime secret isolation, not an automated CI gate.

All other tooling per `docs/00-constitution/ARCHITECTURE.md`: `mise`, `Bun`, `tsrs`, `oxfmt`, `oxlint`, `knip`, `Gitleaks`, plus `Turborepo`, `OSV-Scanner`, `Trivy`, `ripgrep`/`fd`/`ast-grep`, `RTK`, `Difftastic`, `Lefthook`, `Bun Test`, `Playwright`, `Commitlint`, `Changesets`, GitHub Actions, `act`.

**Leading word: `native`.** Checks run through `mise` on local compute; no cloud shortcuts.
