# Owner Taste — Rill

> **Single source of truth for the owner's personal taste.** Every document, GitHub issue/PR, Codex plan/goal, and agent instruction in this repository must be written explicitly with [`writing-for-agents`](https://github.com/mattpocock-skills/writing-for-agents) and must not contradict this file.

## Platform taste (non-negotiable)

- macOS CI runner: `macos-26` only; Apple Silicon `arm64`. Every macOS job asserts `test "$(uname -m)" = "arm64"`.
- No `macos-15`; no x86 runners for the primary acceptance path.

## Anti-patch-cheating taste (non-negotiable)

- Prohibit `as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, empty `catch`, `.only`, `.skip`.
- Prohibit hardcoding user natural-language intent strings into `src/` (e.g. "买菜清单", "没信号"). Intent must first be converted to a machine-language spec (input/output, boundary, invariant, failure mode).
- Prohibit mocks replacing real IO: database via Testcontainers real containers; frontend via Playwright real browser + real HTTP request assertions.
- Root-cause-first on every test/type failure: `[报错根因] -> [受影响的上下游模块] -> [为什么不能用局部硬编码/特判解决]`.
- Test-assertion isolation: do not modify existing `*.test.ts` assertions unless business requirements changed.

## Writing taste (non-negotiable)

- Every document, issue, PR, plan, and goal must be written with `writing-for-agents`: steps first, reference second; each step ends on a checkable, exhaustive completion criterion; front-load the leading word; one trigger per branch; no no-ops; one single source of truth per meaning.
- No negation-only guardrails; pair any prohibition with the positive target behaviour.

## Git / workflow taste (non-negotiable)

- No direct commits on `main`; all work enters `../wt-<issue-id>` isolated worktrees; main stays clean.
- GitHub Issue (`ready` label) is the sole task contract (Stage 4 template); no local TODO files for task state.
- `mise run verify` and `mise run qualify` must both exit 0 before Stage 9 review; Stage 9 independent reviewer outputs `APPROVED`.
- `bun run knip` exits 0 after every iteration.

## Tooling taste

### Layer 1 secret provider (manual install, not in mise.toml)

- Infisical CLI or Doppler CLI: single-binary secret provider replacing plaintext `.env`; runtime stdout/stderr auto-redacted. NOT added to `mise.toml`/`aqua` because no aqua registry exists — user-managed manual install only. Documented here as layer 1 (runtime secret isolation), not an automated CI gate.
  - Completion criterion: owner installs `infisical` or `doppler` CLI manually; `mise.toml` remains unchanged for layer 1.
- All other tooling per sections above: `mise`, `Bun`, `Turborepo`, `tsrs`, `oxfmt`, `oxlint`, `Biome`, `Oxlint`/`Semgrep`, `knip`, `Gitleaks`, `OSV-Scanner`, `Trivy`, `ripgrep`/`fd`/`ast-grep`, `RTK`, `Difftastic`, `Lefthook`, `Bun Test`, `Playwright`, `Commitlint`, `Changesets`, GitHub Actions, `act`.

- Type: `tsrs` only, `TSRS_FAST=0`. Format: `oxfmt` single owner. Lint: `oxlint --type-aware --deny-warnings`. Dead code: `knip`. CI: GitHub Actions `macos-26` + `if: ${{ always() }}` acceptance aggregate covering `merge_group`.
