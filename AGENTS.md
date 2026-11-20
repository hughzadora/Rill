# Rill engineering policy

1. **No append-only patching.** Refactor coherently and remove obsolete code.
   Never preserve dead code or invent legacy compatibility directories.
2. **Single source of truth.** Mise manages CLI tool versions and their lock.
   The root justfile owns every CI task. No external orchestration wrappers.
3. **Standard layout.** Put source in src/ts, src/py or src/sh. Put unit tests
   in tests/ts, tests/py or tests/sh. Browser E2E tests belong in tests/e2e.
4. **Use upstream libraries.** For Python HTTP use httpx; avoid hand-rolled
   networking or CLI frameworks. Forbid as-any casts, TypeScript ignores,
   and unspecific Python type ignores; fix causes instead of suppressing checks.
5. **Complexity limits.** Functions must be at most 60 lines, have
   cyclomatic complexity at most 12, and accept at most five parameters.
   Never duplicate code by copy-pasting blocks over five lines.
6. **Vite and shadcn/ui conventions.** Use the cn() utility from @/lib/utils
   for merging Tailwind classes; never hand-concatenate conditional classes.
   Place reusable primitives in src/ts/components/ui, and application features
   in src/ts/components or src/ts/pages.
7. **Real interaction tests.** New user interactions require both focused
   tests/ts/*.test.tsx unit tests and tests/e2e/*.spec.ts browser tests.
   Run production Vite builds before Playwright against the built preview.
8. **Proof before delivery.** Run just ci-full and require exit status zero,
   including coverage, tests, browser checks and security scans.
   Never claim a gate passed without checking actual execution.
9. **Preserve Git history.** Document the change in its issue and PR.
   The CI pipeline must remain reproducible on a clean machine.
