# Rill — Workspace AGENTS.md

Inherits all iron rules from the global `AGENTS.md` (security, testing, commit gates — none weakened). This file defines the Solo SDLC engineering foundation and execution contract for `rill-workflow`.

## Entry points

- Execution protocol: `docs/01-specs/EXECUTION_PROTOCOL.md`
- Product facts & acceptance: `docs/01-specs/PROJECT.md`
- Owner taste: `docs/00-constitution/OWNER_TASTE.md`
- Architecture boundary & invariants: `docs/00-constitution/ARCHITECTURE.md`
- Design principles & anti-cheat contracts: `docs/00-constitution/DESIGN.md`
- Routing index: `docs/INDEX.md`
- ADR records: `docs/adr/`
- Eval cases: `evals/README.md`

## Solo SDLC rules

1. **No hand-crafted scripts.** Tooling must come from maintained, industry-standard packages (Turbo, tsdown, Oxlint, Oxfmt, tsrs, Knip, dprint, ast-grep, Lefthook, gitleaks, osv-scanner, actionlint, zizmor, dependency-cruiser, Stryker, fast-check, API Extractor). Avoid `*.mjs`/shell one-offs in `.github/scripts/`.
2. **tsrs is the sole type checker.** `tsrs --noEmit -p tsconfig.json` with `TSRS_FAST = 0`. No `any`, `@ts-ignore`, or type escapes without a documented exception.
3. **Split formatting ownership.** Oxfmt owns TypeScript/JavaScript; dprint owns Markdown, JSON/JSONC, YAML, and TOML. `.oxfmtrc.json` ignores the dprint-owned formats so the two never conflict.
4. **Oxlint + Knip are the lint/dead-code gates.** Oxlint with explicit safety rules; Knip to remove dead exports. No disabled tests, no weakened assertions.
5. **Engine circuit breaker.** `src/env.ts` validates `RILL_MAX_STEPS`, `RILL_TIMEOUT_MS`, `RILL_MAX_TOKEN_BUDGET` via `@t3-oss/env-core` + Zod at startup; `src/workflow.ts` fails closed on any breach rather than clamping.
6. **Secret redaction.** `.gitleaks.toml` (LLM key rules plus `useDefault`) is the single detection engine. `packages/tooling/gh-safe.ts` redacts host paths and internal IPv4 addresses, pipes through `gitleaks stdin --redact`, refuses to emit findings, and rate-limits three events per target in ten minutes. `issue-sanitizer.yml` redacts issue and comment bodies through the GitHub API; it requires the `sanitizer` repository environment to exist, otherwise it fails closed.
7. **Dependency security.** `osv-scanner` scans dependencies in `verify`; `dependency-cruiser` enforces the no-circular-dependency rule over `src/` via `arch:check`.
8. **CI guard.** `.github/workflows/ci-guard.yml` runs tamper detection, dependency review, and the full gate list on every push/PR to main. CODEOWNERS requires owner approval for gate, runtime-limit, and test paths. `workflow-lint` runs actionlint, shellcheck, and zizmor at `--min-severity medium` over every workflow.
9. **No bypasses.** No `.skip`, `.only`, `xit`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or loosened assertions. Test failures are production defects.
10. **Verification before commit.** `mise run verify` must pass clean before any commit. Tests target agreed public seams only; existing assertions are frozen unless a product requirement changes.

## Language (enforced)

- Engineering artifacts (code, comments, specs, docs, commits, PRs, changelogs): **English only**.
- Agent-to-owner conversation (progress updates, questions, delivery summaries): **Simplified Chinese only**.
- No mixed-language engineering documents.

## Human-in-the-Loop (HITL) & ASK interrupt

Routine technical decisions are made independently; rationale is recorded in commit messages. Trigger an Interactive Interrupt (ASK form) **only** when blocked by missing credentials, irreversible destructive actions, external publish/release triggers, high-impact product ambiguity, or a 3-strike debugging deadlock. State the blocker, the impact, and the recommended option, then continue independent work if unblocked.

Never `git push`, merge into protected branches, or publish external artifacts without explicit owner authorization.
