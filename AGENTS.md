# Rill repository engineering policy

- Preserve native upstream tools and active quality-profile behavior.
  Do not create a parallel harness.
- Production sources: `src/ts`, `src/py`, `src/sh`; corresponding tests
  in `tests/ts`, `tests/py`, `tests/sh`. Existing `tools/`, `tests/`,
  and `quality-fixtures/` remain in scope.
- Prefer maintained libraries over hand-rolled infrastructure:
  `fetch` for TypeScript HTTP, `httpx` for Python HTTP;
  `commander` / `typer` for new CLI products.
- Never use explicit `any`, unscoped Python `type: ignore`,
  `@ts-ignore`, dynamic `eval` / `exec`, magic numbers, or
  hard-coded global configuration.
- Keep functions at most 50 lines, cyclomatic complexity at most 12,
  and avoid copy-pasted code. Apply rules to new code and refactoring
  rather than suppressing existing unrelated failures.
- Add deterministic, typed tests; verify meaningful coverage and
  use strict type checking.
- Before delivering code, run `just ci-full` locally and ensure
  all checks pass; never report success without evidence.
- Use `mise lock` to resolve stable tool releases and commit
  package manager lockfiles.
- Maintain GitHub issue and PR as authoritative delivery records,
  with real test evidence.
