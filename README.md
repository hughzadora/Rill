# Rill local quality foundation

This repository provides a reproducible local quality-gate baseline for
TypeScript, Python and shell programs. It uses upstream tools rather than
custom lint, type-checking or test runner implementations.

## Install and verify

Run these commands at the repository root:

```sh
just lock
just setup
just ci-full
```

Use `just ci` for staged, unstaged, untracked and committed changes relative
to `origin/main` (or the previous commit if the remote branch is missing).
Shared tool or pipeline configuration changes trigger all language gates.
The guardrails always run. All selected workers launch concurrently, and
every failure is reflected in the aggregated exit code.

Node LTS, pnpm 12 and Python 3.14 are locked by Mise.
Mise is the authority for CLI tool versions; pnpm and uv lock their package
dependency graphs. The Just recipe contains the complete CI orchestration.
Husky runs pre-commit secret and staged-file checks, commit-message lint
and incremental CI before pushes.

Tests use Vitest with V8 coverage, pytest with measured coverage, and Bats
for executable shell behavior. The project GitHub Actions workflow calls the
same local setup and full validation recipes.

The historical quality-profile candidate and its custom MCP wrapper are not
part of this foundation; they were deliberately removed in the clean rebuild.
