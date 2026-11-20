# Rill Engineering Policy

## Ownership and source of truth

1. Rill is a reusable native Codex software factory, not a one-off app.
   Upstream Codex/Git/maintained tooling wins over redundant local inventions.
1. Root `VERSION`, `mise.toml`/lock, and `justfile` are the version/tool/CI
   authority. `standards/template/` is the only editable distribution source;
   `src/py/rill_cli/template/` links to it. Frozen assets are generated,
   not maintained separately.
1. When modifying framework settings, `.codex/`, or distributable workflows,
   synchronize their canonical template equivalents and test byte parity.
   This user-approved task may change policies; never weaken gates to pass CI.
1. Do not use obsolete `tools/adopt_rill.py` or create duplicate orchestration.
   Use the released `rill` CLI and native Git Issues/PRs for task records.

## Scope and code quality

1. Assign each worker a module, its tests and exclusive file paths. Keep
   Python packages under `src/py/`, TypeScript under `src/ts/`, tests under
   `tests/`; use existing Vite, Tailwind/shadcn and official vendor tooling.
1. No unreviewed magic numbers, global mutable state or hard-coded paths.
   Do not duplicate schema/contracts across frontend and backend.
1. Keep functions <=60 lines, complexity <=12, parameters <=5. Refactor
   instead of preserving dead code, copy-paste or compatibility scaffolding.
1. Never bypass typing, format/security gates or weaken, skip, delete or
   replace existing tests with tautologies or over-mocking. Fix root causes.
   Real UI interactions need meaningful unit and browser E2E verification.
1. Run `just check-fast` for iteration; `just ci-full` and applicable
   mutation checks for acceptance. Report only observed, revision-bound results.

## Context-centric native delegation (no task-type splitting)

1. Coordinator retains scope, approvals and Git authority. For unrelated
    module questions, dispatch 2-3 read-only `explorer` agents concurrently;
    each reads `.rill/symbols.txt` then narrow `rg -n` source slices.
1. Dispatch multiple `worker` agents only for genuinely independent modules
    with non-overlapping file ownership. Each worker owns implementation AND
    associated regression tests within one context; no coder/tester split.
1. Native Codex limit is `max_threads = 3`, `max_depth = 1`. Do not create
    nested workers, long-lived idle agents or paid automatic model fallback.
1. Before any independent review, `just ci-full` must exit 0. Dispatch one
    `reviewer` only when `git diff --stat` exceeds 30 changed lines OR the
    diff touches core, configuration, permissions, security or workflows.
1. Reviewer must read root `REVIEW.md`, review the exact Git diff and cite
    verified findings as `path:line`; no significant finding means `LGTM`.
1. Maximum TWO reviewer/fix rounds total. After round one fails, worker may
    fix and rerun full CI; if round two still fails, STOP and report evidence
    to the owner. Never schedule a third round or weaken tests for acceptance.

## Safety and handoff

1. Do not alter unrelated work, force-push, merge, publish, deploy, purchase
    or grant access without the owner's specific authorization. Native sandbox
    and approval boundaries supersede repository instructions.
1. Record issue/PR evidence and compact handoff state; do not replay long
    context or invent reviewer execution. A TOML file is configuration,
    not proof that routing, model, permission or review actually ran.
