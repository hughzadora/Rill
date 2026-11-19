# Industrial Quality Standard

## Factory guarantee versus sample tests

Rill must deliver the **entire applicable engineering gate matrix**
for React/Tailwind, Node.js/TypeScript, Python and Shell. A "minimum
viable" green badge, an unrelated demo test, or a written rule cannot
substitute for observed correctness. Mature upstream tooling is the
default; a custom test framework requires demonstrated unmet need.

At present packages/quality proves many tools run on isolated fixtures.
That is not proof of a new-project/brownfield project-wide standard.

## Required gate matrix

| Layer              | React + Tailwind                                      | Node.js + TypeScript                    | Python                               | Shell                                    |
| ------------------ | ----------------------------------------------------- | --------------------------------------- | ------------------------------------ | ---------------------------------------- |
| Format and lint    | Biome, Oxlint, Tailwind build                         | Biome, Oxlint                           | Ruff format and lint                 | shfmt, ShellCheck                        |
| Static contracts   | TSX, strict props, React rules                        | strict TS and API schemas               | mypy strict and data models          | executable interfaces and shell analyzer |
| Unit/component     | Vitest + React Testing Library                        | Vitest meaningful behavior              | pytest                               | Bats                                     |
| Integration        | Component/API and route flows                         | HTTP/service/data integration           | service/client integration           | command/OS process tests                 |
| User-facing system | Playwright actual Google Chrome                       | Service and UI end-to-end               | Actual service and failure path      | CLI black-box scenarios                  |
| Accessibility      | axe-core/Playwright, keyboard, semantic HTML + manual | Errors and response contracts           | User-visible output where relevant   | Clear messages and exit codes            |
| Coverage           | meaningful branches, risk-sensitive fault tests       | meaningful branch and behavior coverage | pytest-cov and optional Hypothesis   | Bats negative cases                      |
| Build/runtime      | production React/Tailwind build                       | packaging, bootstrap, health            | package/startup and integration      | executable and startup checks            |
| Security           | DOM/XSS, dependency and browser policy                | validation, auth, secrets, dependencies | unsafe parsing, dependencies, inputs | injection/quoting/permissions            |
| Resilience         | loading/error/offline, screen sizes                   | retries, timeouts, recovery, rollback   | error/retry/restore                  | idempotence/fail-fast                    |
| Supply chain       | frozen locks, audits, license, SBOM                   | pnpm lock, Trivy, Gitleaks              | uv lock, audit/license               | pinned tools and scans                   |

Static complexity and inventory gates must run on **all applicable
source files**, not silently exempt new modules. Legacy violations
are visible until repaired or scoped, reviewed exception is authorized.

## Enforced pipeline stages

1. Inventory actual source stacks and make every included/excluded source
   path inspectable. A missing profile is UNKNOWN, never PASS.
2. Install locked dependencies and upstream versions from native locks.
   Never silently purchase, upgrade or fall back to unlocked tools.
3. During implementation run changed-source diagnostics and existing
   relevant regression tests.
4. During cleanup add behavior tests, negative cases, focused comments,
   module boundary checks and appropriate coverage.
5. Before PR execute **all applicable** language checks, real integration,
   user-facing/CLI, accessibility, production build, secrets/license/
   vulnerability/SBOM, runtime sanity and independent code review.
6. Attach raw logs, tested SHA, coverage, screenshot/recording and
   source map to the native issue/PR; verify hosted CI for the final
   candidate and await actual owner acceptance.

Do not compare a fixture pass against a real project's quality debt.
Do not make a failure disappear with generic ignores or unsourced
magic thresholds. The program should reject absent real source roots.

## Tested product coverage floor

The React console's initial measured full-source coverage was approximately
83.9% statements, 69.8% branches, 78.6% functions and 86.3% lines. Its CI
enforces a conservative current-product floor of **80% statements, 65%
branches, 75% functions and 80% lines** in the locked Vitest V8 report.
These are _local regression protection values_, not universal thresholds
for other project classes or proof that unexercised paths are safe.
A separate target's risk and real baseline must be reviewed before setting
its own floor. The source inventory includes the React entry and app code.

## Observed checks versus missing factory acceptance

Already locally observed in prior Rill candidate: root Biome,
quality-package lint, Oxlint, Ruff, mypy, ShellCheck, shfmt, Taplo,
Tokei/Lizard, Trivy, Gitleaks, dependency/license/SBOM, Vitest fixture
tests, Python pytest, production Vite fixture build and Chrome E2E
for the prototype. These apply only to inspected current source.

Not yet verified as a complete cross-project factory: React component
testing on the **real management console**, axe-core accessibility,
backend service/contract integration, Bats behavior regression,
production source coverage thresholds, actual per-stack installation
in a clean new and existing project, complete native multiagent
delegation, versioned standard provenance/migration/rollback, hosted
current-candidate CI and final owner acceptance.

## Review and release authority

Google's code review covers design, functionality, complexity,
naming, comments, tests, code style and documentation. Independent
review must examine current behavior and raw check output. A PR
passing unit checks is not automatically releasable.

References:
[Google engineering review](https://google.github.io/eng-practices/review/reviewer/looking-for.html),
[GoogleChrome Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance),
[Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing),
[GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects).
