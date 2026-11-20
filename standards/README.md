# Adopt the Rill Software Factory Standard

The standard in `copier.yml` and `standards/template/` is a **Copier
9.19.1** template with generated GitHub Actions gates for independent
new and existing repositories. The template has no arbitrary execution
tasks, migrations, magic status store, permissions layer or copied agent
runtime. It is separate from Rill's own management console and quality
tooling fixtures.

## Release boundary

**Candidate only.** There is no approved published Rill standard tag,
release or external deployment. A Git commit is not a SemVer release.
A real standard release needs a reviewed tag, compatibility evidence
and protected authorization. Local pilot tags in the automated tests
exist only in temporary Git repositories and are not Rill releases.

Copier and actionlint are managed by Rill's locked Mise baseline.
Copier runs with a _tool-specific_ Python 3.14.8 because its dependency
graph does not yet fully support the host's pinned Python 3.15 runtime.
Rill's other Python gates retain their own native versions.

## Native adoption path

The responsible agent first verifies target access and scopes the real
project's source inventory, tests, deployment and existing configuration.
Do not edit an owner's real external repository merely because its path
or URL was mentioned. For approved development, use a dedicated clean
Git branch or isolated worktree; do not overwrite uncommitted work.

For a new repository, after verifying a specific reviewed Rill tag,
Copier accepts its source checkout or authenticated Git URL:

```sh
mise exec --locked pypi:copier -- copier copy --defaults \
  --vcs-ref <reviewed-tag> \
  --data project_name=<product> <rill-source> <new-target>
```

The template's initial defaults enable all four stacks as a strict
_questionnaire_, not evidence that all four stacks exist. Set the real
stack values (`react`, `node`, `python`, `shell`) and the actual
package paths. An empty stack is rejected. All paths must remain inside
the target; supported source paths intentionally exclude shell control
characters and parent-directory traversal.

For a brownfield project, first preserve its working Git baseline.
Choose only the actually used stacks and existing package roots. Preview
the change using Copier's `--pretend`, then apply to the isolated
worktree and review the exact diff. Existing product code, documentation,
native agent instructions and previous CI checks must remain intact.
Copier does **not** rewrite the target's app scripts or install new
product packages; the agent must integrate the maintained native
quality tools with the real application.

The generated files have distinct authority:

| File                                 | Purpose              |
| ------------------------------------ | -------------------- |
| `.rill/copier-answers.yml`           | Source/ref/answers   |
| `.rill/STANDARD.md`                  | Stack requirements   |
| `.github/workflows/rill-quality.yml` | PR checks and audits |

`github_parent_issue` is an optional numeric pointer to the actual
native engineering parent of the target repository. The generated
standard explicitly marks unbound projects as `NOT ENROLLED` and
requires a fresh agent to verify the repository and issue tree via
native GitHub access; recording a number is not proof of enrollment.

`copier-answers.yml` is required for future version updates. Do not
remove it to create false "stateless" compliance, and do not treat
a successful copy as verified project adoption.

## Actual enforcement

GitHub Actions run at `pull_request` and `merge_group` to support
required merge-queue checks, and at `workflow_dispatch` when invoked.
JavaScript gates require a frozen pnpm lock and committed application,
unit and integration test sources. They execute **native** Biome,
pinned Oxlint correctness rules, Lizard complexity checks, TypeScript
and the selected Node/Vitest runner with source coverage thresholds
directly, rather than trusting package scripts that may be no-ops.
React additionally executes real Chrome-tagged `@e2e` and
`@a11y` Playwright tests directly, requires native browser Trace
artifacts, and proves the installed system Chrome/axe-core tools
can launch and scan; the target project's native
`build` script remains required. Tests or real source missing
from the checked-out Git tree cause CI to fail. The selected
`node:test` runner requires locked `c8@12.0.0` and uses
`--all --per-file` coverage to count even unloaded source modules.
React requires a Playwright project named `chrome` configured
with the system `channel: "chrome"`. The Chrome/axe proof uses the configured
Playwright `baseURL` as the approved product destination. If the product
intentionally redirects to a different canonical page, set the GitHub Actions
job environment `RILL_ALLOWED_PRODUCT_URL` to that reviewed exact final URL;
otherwise the proof fails rather than treating a login page or unrelated
redirect as the tested product. Each native build must
freshly produce the configured output file. Trivy security checks
disable checkout-controlled configs and ignore files; exceptions
require an explicit reviewed source policy. The reporter still
requires human review of test quality and deployment artifacts.

Python runs inside the configured `python_root`, with a locked uv
environment, Ruff, strict mypy, pytest + pytest-cov, real integration
tests, a separate non-skipped unit-test verdict, per-file tracked-source
coverage reconciliation and `uv build --no-build-isolation`. Include the
build backend in locked dev dependencies as well as the exact
PEP 517 build requirement. An uninstalled backend fails instead of
resolving a different build-time version. Its source and test paths are
relative to that Python project. Shell runs ShellCheck and shfmt over
both `.sh` files and extensionless Bash/sh shebang entry points using
the same source inventory; Bats verifies actual CLI behavior. A missing
shell source fails.

Every project runs pinned Gitleaks and Trivy against the **original
checkout and lockfiles before dependency installation**. The security
job then installs the real locked JavaScript/Python dependencies for
license classification; Trivy
blocks forbidden and restricted license classes and records all classes.
Python uses `pip-licenses` from its locked development dependencies to
record installed package licenses and block a conservative set of
prohibited GPL/AGPL families. CycloneDX SBOM and license inventories are
uploaded as short-lived GitHub Actions artifacts **before** license
policy blocks the PR, so a violation retains its evidence. Python
`pip-licenses` uses exact reported SPDX/legacy identifiers, not
substring matching that accidentally rejects LGPL as GPL. Unknown
and compound license expressions and incomplete classifications
remain explicit manual review conditions, **not** automatic approval.

Project-specific business paths, test fixtures, failure cases, coverage
thresholds and runtime startup health must be established and reviewed
before gates can count as working. Green sample fixtures in Rill's
own repository cannot substitute for real source. Existing, stricter
language gates are _retained_; do not remove a mature tool merely for
uniformity.

## Update and non-destructive rollback

After a _reviewed version_ has been published, in the target's clean
isolated branch and with the actual source still accessible, run:

```sh
mise exec --locked pypi:copier -- copier update --defaults \
  --answers-file .rill/copier-answers.yml \
  --vcs-ref <reviewed-new-tag>
```

Always inspect the diff, unresolved Copier conflicts and all current
project checks. Copier updates **only files it manages**, and Git owns
the final integration. Never pass `--UNSAFE`, suppress conflicts, force
an overwrite of unrelated files or make external deployment changes.

If acceptance fails, revert the scoped template-update commit with
native Git. Do not attempt a custom Rill snapshot/state restoration
system or destroy unrelated user changes.

## Evidence: candidate pilot, not general release

The versioned test at `tests/standard-adoption.test.mjs` creates
temporary Git repos and checks all-four-stack template generation,
an independent React/Tailwind Chrome application with axe,
a Node/TypeScript brownfield HTTP service, and a Python/Shell
application with strict source gates. All have intentional failing
business regressions and subsequent recovery. Tests also verify
existing content preservation, Actionlint, native Copier update,
Git revert, missing-stack rejection and unsafe-path rejection. Test tags are
temporary synthetic history, and missing scripts are expected failures.

Not yet proved: real non-synthetic owner project installations
with GitHub-hosted CI, a publicly or privately approved versioned
Rill release, owner interactive acceptance, independent current-SHA
review and rollback from a genuinely deployed target. Track these in
[#32](https://github.com/hughzadora/Rill/issues/32) as native
parent/sub-issue work, not a copied chat log.
