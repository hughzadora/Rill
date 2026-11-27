# Rill — Workspace AGENTS.md

Inherits all iron rules from the global `AGENTS.md` (security, testing, commit gates — none weakened). This file only supplements this repository's real canonical commands, directory boundaries, and project-specific invariants. All changes run locally and are committed atomically; no `git push`, no remote branch modification.

## 0. Inherited iron rules (global AGENTS.md, not weakened)

- **Single verification entrypoint**: verify only via the repo's established build/test tools (`mise run check-fast`, `mise run test`, `mise run verify`, `mise run qualify`). Do not create throwaway verification scripts (`tmp_*`, `verify_*`, `debug_*`).
- **Zero bypass tolerance**: no `.skip`, `xit`, `.only`, `xfail`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `@ts-ignore`, commented-out tests, or relaxed assertions.
- **Test-value proof**: any deletion, relaxation, or behavioral change to existing `*.test.ts` assertions must be justified in both the commit body and delivery report with (1) Protected Boundary and (2) Legitimacy Proof.
- **Hermetic isolation**: tests must not mutate host user config (`~/`) or leave untracked artifacts; use isolated temp dirs and clean up after runs.
- **Dependency & lockfile discipline**: never install, upgrade, or remove third-party deps, nor modify `bun.lock`/`mise.lock`, unless explicitly required by the task.

## 1. Canonical commands (from `package.json` and `mise.toml`)

| Gate                              | Canonical command                                                      | Meaning                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Build                             | `mise run build` (`bun run build`)                                     | Package the versioned Codex template into `dist/`                                              |
| Typecheck                         | `mise run typecheck` (`tsrs --noEmit -p tsconfig.json`, `TSRS_FAST=0`) | Sole type authority; do not install `tsc` as a second checker                                  |
| Lint                              | `mise run lint` (`oxlint --type-aware --deny-warnings src tests`)      | Explicit safety rules, `deny-warnings`                                                         |
| Format check                      | `mise run format-check` (`oxfmt --check --disable-nested-config .`)    | Oxfmt sole owner; no Biome/Prettier                                                            |
| Fast unit tests (Commit Gate)     | `mise run test` (`bun tests/tooling/run-suite.ts ordinary`)            | behavior + contracts suites, no skip/focus                                                     |
| Heavy integration tests (Nightly) | `mise run qualify` (`bun tests/tooling/run-suite.ts qualification`)    | fault-injection + negative gates, 31 cases                                                     |
| Commit gate aggregate             | `mise run verify`                                                      | check-fast + knip + test + scan-secrets + scan-dependencies + spelling + links + workflow-lint |
| Dead-code check                   | `mise run knip` (`bun run knip`)                                       | must exit 0 before every iteration ends                                                        |
| Secret scan                       | `mise run scan-secrets` (`gitleaks dir --redact=100 .`)                | no leaks                                                                                       |
| Workflow lint                     | `mise run workflow-lint`                                               | actionlint + shellcheck + zizmor + oxlint on CI scripts                                        |

## 2. Directory boundary map

| Path                   | Role                   | Boundary rule                                                                                                                      |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/template.ts`      | Build & pack entry     | Depends on no internal business module; never imports `template/`, `tests/`, `docs/`, `workflow/`                                  |
| `tests/tooling/`       | Tooling contract tests | Depends only on `src/template.ts` public exports and `bun:test`                                                                    |
| `tests/behavior/`      | Behavior tests         | Depends only on the built release kit and `bun:test`                                                                               |
| `template/`            | Consumer-side template | Not imported by Rill source; only shipped with the kit                                                                             |
| `docs/`                | Knowledge base         | `00-constitution`/`01-specs`/`02-requests/active`/`03-research` active; `02-requests/archive` archived, masked from normal routing |
| `workflow/`            | Delivery workflow      | `DELIVERY.md`, `ACCEPTANCE.md`, `ADOPT.md`, `PROFILES.md`, `RELEASE.md`                                                            |
| `.agents/skills/rill/` | Rill skill             | For adopted-workspace plain-language requests                                                                                      |
| `dist/`                | Build output           | gitignored, not committed                                                                                                          |
| `node_modules/`        | Dependencies           | gitignored, not committed                                                                                                          |

## 3. Project-specific invariants

- `tsrs` is the sole type authority; `TSRS_FAST=0`; no speed mode that changes diagnostics.
- `oxlint` enables `typescript`/`import`/`unicorn`/`jest` plugins, `correctness` is `error`; bans `any`, unsafe assignment/argument/call/member-access/type-assertion, floating promises, TS comment suppression, global assignment, implicit globals, empty blocks, focused/disabled tests.
- `.oxfmtrc.json` is the sole format config, ignoring `bun.lock`, `mise.lock`, `node_modules/**`, `dist/**`, `reports/**`, blueprint files; no second formatter on the same file.
- `knip.json` entry: `src/template.ts`, `src/**/*.ts`, `tests/**/*.ts`; project scope identical; ignores `template/**`, `dist/**`, `rill-test-project/**`; run `bunx knip` before every iteration ends; orphan files/unused exports must be cleaned; no `funcV2` coexisting with the old function.
- Git worktrees live in `.worktrees/`, non-primary worktree; before deletion `git status --porcelain` must be empty; branch tip must be an ancestor of base; after merge use `git branch -d` (never `-D`); never `git worktree remove --force`.
- Bug fixes: by default no authority to alter assertion conditions in existing `*.test.ts` unless business requirements themselves changed.

## 4. Secret writing gate (layer 2: pre-write sanitization)

Before writing any document, issue, PR, plan, or goal, run a local `gitleaks` stream scan on the text and block the write if a secret is found; never read plaintext `.env` into agent context. `.gitleaks.toml` is the single rule source. Completion criterion: a known-fake secret string fails locally on `gitleaks dir --stdin` before any `gh` write.

## 5. Entry points

- Product facts & acceptance: `docs/01-specs/PROJECT.md`
- Sole execution contract: `docs/01-specs/ADLC_MASTER.md`
- Owner taste: `docs/00-constitution/OWNER_TASTE.md`
- Routing index: `docs/INDEX.md`
