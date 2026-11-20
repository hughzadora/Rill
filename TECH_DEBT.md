# Technical Debt

## P2 — Mutation verification toolchain fails on symlink and relative paths

`just verify-tests` currently cannot complete in this checkout due to two infrastructure/tooling defects unrelated to PR #40 business behavior:

- Stryker treats the `src/py/rill_cli/template` directory symlink as a regular file while preparing its sandbox, then fails with `EISDIR`.
- The Python mutation runner executes from its generated `mutants/` tree, while `tests/py/test_ci_revision_contract.py` resolves the repository root relative to that tree and cannot find the root `justfile`.

Track remediation in an independent infrastructure PR. Do not change Stryker configuration, mutation guardrails, or repository build scripts as part of PR #40. For PR #40 acceptance, `just verify-tests` is classified as a non-blocking infrastructure failure; the relevant business regression suite and `just ci-full` are the required local evidence.
