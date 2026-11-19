# Quality Standard: Implementation Status and Design

Status: **candidate / incomplete**, Issue #19. This document is a
design-and-evidence checkpoint, not an approved release or proof of
enforcement in another repository.

## Authority and lifecycle

- GitHub Issue #19 is the delivery authority. The approved path is
  independent from main; do not merge or overwrite Issue #18's working tree.
- The initial profiles cover TypeScript/Node.js, React/Tailwind, Python,
  Markdown and Shell. New projects must establish gates before feature work;
  existing projects need read-only audit, preservation and conflict review
  first.
- Standards use SemVer and an immutable content digest at binding time.
  `quality-standards/0.1.0/profile.json` is a local candidate, **not** a
  published trusted release. Changing its bytes invalidates prior bindings.
  Neither source authenticity nor release distribution is implemented.
- Never silently install services, grant approvals, replace existing
  configs, broaden ignores or waive failures. A local hook is bypassable and
  is not a merge protection. Paid runners and services are not authorized.

## Baseline project gate matrix

- **Node/TypeScript:** Biome, complementary Oxlint, strict TS, Vitest,
  Lizard/Tokei, build, Trivy, Gitleaks, dependency/license audit.
- **React/Tailwind:** Node gates plus framework lint, UI integration,
  accessibility, browser E2E and Vite artifact checks where applicable.
- **Python:** Ruff, mypy strict, pytest, Lizard/Tokei, locked dependencies,
  license and secrets audit, build checks for published distributions.
- **Markdown:** markdownlint-cli2, links and rendering when published,
  secrets check, no duplicate formatting gate.
- **Shell:** ShellCheck, shfmt, bats-core for behavioral scripts,
  permissions, platform and secrets checks where applicable.

Use native project package managers and committed locks; `mise.toml`
requests stable latest and `mise.lock` records installed versions. The
project may keep a compatible effective tool rather than duplicate it.
Evaluate candidate plugins for overlap, maintenance, license, executable
support and cost before adoption. Containers, IaC, database migrations, API
contracts, coverage and browser E2E apply only to projects having those
surfaces; absence must be recorded as not-applicable, not passed.

## Staged process

1. Discover languages, frameworks, package manager, lock files, monorepo
   boundaries, runtime, artifacts, data sensitivity, permissions, CI and
   hooks.
2. Inventory existing scripts/configuration and execute existing checks
   where safe. Categorize functioning, missing, failing, duplicate, outdated
   and conflicting mechanisms without changing files.
3. Design the entire project-specific gate matrix, coverage boundaries,
   thresholds, exceptions and expected local/PR commands. Report unverified
   dependencies and external constraints.
4. Prepare a read-only diff/plan with exact release, root, HEAD, worktree
   state and content digests. Setup requires explicit local application;
   refuse stale plans and existing managed profile targets.
5. Install locked tools, prove a passing baseline and controlled negative
   cases for every applicable gate. Preserve code, current configs and
   unrelated modifications; exceptions require source, owner, reason, scope
   and re-review condition.
6. Run only lint at commit, targeted behavior checks during development,
   full-spec locally once before PR, and full-spec on each PR candidate in
   hosted CI. Record exact revision, worktree, environment, command, exit
   status, duration and any unchecked conditions.
7. A changed code/config/dependency/merge base requires affected gates to be
   repeated; compare standard versions on upgrade and require review for
   managed target changes. Rollback and drift reconciliation remain to be
   implemented.

## Observed implementation, not assumptions

- The existing quality profile branch provides pinned Mise tools, Jest-free
  Vitest/pytest fixtures, Ruff, mypy, Biome, Oxlint, markdownlint,
  ShellCheck/shfmt, Trivy and Gitleaks.
- Local CLI implements profile inspection, gate execution, a non-destructive
  binding preview, explicit binding, conflict rejection and an MCP read-only
  adapter. Binding **only writes a marker**; it does not install project
  gates or certify readiness.
- `just metrics` previously reported zero Lizard files due to incorrect
  `--languages` argument. Corrected to per-language `-l`; 12 source files
  were measured. Complexity failures remain open, and Tokei size
  enforcement/source inventory parity are not yet implemented.
- `just lint`, TypeScript typecheck, Vite build and sample test suites
  passed on the local dirty worktree. Gitleaks history found no leaks. Trivy
  secret scanner returned exit 0 but lockfile rows showed `not scanned`;
  coverage must not be claimed from that result.
- Dependency audit failed on `graceful-fs` with a BlueOak-1.0.0 license
  classified unknown. Neither a blanket allowlist nor a waived exit code is
  acceptable; determine dependency path and policy eligibility first.
- PR workflow now invokes `full-spec-ci`, but hosted CI, clean clone,
  negative fixtures, full gate coverage, availability, plugin distribution,
  and rollback have not been independently verified. The candidate is not
  merge-ready.

## Remaining acceptance blockers

1. Review upstream/tool matrix with actual version/maintenance/license
   compatibility and remove redundant checks, without shrinking Issue #19
   requirements.
2. Rework oversized CLI functions or deliberately document exceptional
   legacy debt; retain complexity and size gates that reject real defects.
3. Resolve dependency-license finding through traceable dependency
   classification, not suppressions; verify secret/vulnerability scans cover
   expected inputs.
4. Add honest negative cases, coverage/source inventory validation,
   end-to-end new and legacy pilots, build/package and applicable
   UI/accessibility tests.
5. Implement managed configuration rollout/drift/upgrade/rollback, real
   release provenance and safe CI/hook/MCP distribution; verify in
   independent projects.
6. Run full-spec on a clean clone, capture revision/exit/duration receipts,
   then verify the actual PR workflow. Obtain separate review before merge.
