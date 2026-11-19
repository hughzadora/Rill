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

On the exact local console candidate, React component tests,
axe-core six-page Chrome accessibility, backend Node HTTP contract
tests, Bats behavior tests and full-source coverage thresholds were
observed. This still certifies **only the Rill project itself**.

The native Copier 9.19.1 candidate produces source-specific GitHub
workflow profiles using the target's actual package roots. Synthetic
greenfield, independent React/Tailwind Chrome/axe,
Node HTTP brownfield, and Python/Shell application tests cover
frozen dependencies, actual source checks, intentionally failing
business regressions, non-destructive adoption, versioned upgrade
and native Git rollback.
The templates have no arbitrary task hooks, migration code or
user-independent permissions.

The independent review of candidate 40f616e identified nested pnpm
manifest resolution, merge-queue triggers, extensionless shell entry
points, unpinned isolated Python build backends and missing supply-chain
artifacts. The subsequent candidate addresses these through native
pnpm/action-setup inputs, `merge_group`, shared ShellCheck/shfmt source
inventory, `uv build --no-build-isolation` with locked backends,
actual installed dependency-license checks and a CycloneDX SBOM artifact.
Trivy does not classify licenses from `uv.lock` alone; the Python
profile also requires locked `pip-licenses`. Unknown classifications
remain for independent human assessment; green CI does not grant an
unrecorded license exception.

A second independent Codex review of `8ac0365` found four further
risks: original-source scans were after install, GPL substring matching
rejected LGPL, failed license checks prevented artifact upload, and a
shebang regex misidentified extensionless scripts. The corrective
candidate runs source scans **before** installation, publishes reports
before license policy exits, uses exact license identifiers, and
parses the shebang interpreter token with Bash. The hosted Actions
branch-check assumption was also corrected for detached HEAD.

**Still open under #32:** hosted checks in an actual owner's new
and existing external product repositories (rather than isolated
test repositories), production startup/resilience, approved standard
version provenance, independent current-SHA review, human approval,
upgrade of a genuinely deployed product and complete release acceptance. Local full-integration review subsequently identified a source-test
false-pass opportunity: package scripts can be replaced with no-ops.
The candidate profile now checks committed application/unit/integration
source, calls actual native Vitest, Node test runner, Playwright Chrome,
Biome and TypeScript commands directly, and applies project-specific
coverage floors. All language jobs depend on completing the security
job so original Git history/source scans finish before test/build
code execution. The independent Node/React pilots deliberately
replace package test scripts with no-ops and corrupt real product
behavior; native gates still reject the regression.

A separate real GitHub issue/PR/CI Chrome trial (rather than mocked
fixture data) revealed two handoff screen contrast violations.
Changing status/date text to a 6.13:1 contrast color eliminated them;
local Chrome+axe checks on overview, tasks, quality and handoff then
passed with no detected violations. The console now selects only
its actual Quality workflow on the exact SHA and never recommends
blocked issues as the next executable task. This remains automated
evidence, not the owner's interactive acceptance.

No fixture, CI configuration or green
local test should be described as universal standard enforcement.

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

The first hosted CI on the native-source-gate hardening SHA `8cc1dfb`
failed because its integration test was indirectly run under system
Node 26 locally, while the actual product workflow pinned Node 24.22.3.
The unsupported `--test-coverage-include-all` flag was removed; the
corrected adoption harness uses the real pinned runtime to prevent this
class of false positive. Current-SHA hosted success is required and
cannot be inferred from a prior green run.
