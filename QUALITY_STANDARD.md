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
- Lizard and Tokei use real source inventory. The profile's own
  TypeScript inventory is 16/16, including fixture source and config;
  missing or newly introduced paths outside declared roots fail closed.
  Function complexity, function length and 500-code-line limits are active.
- The candidate release verifies per-file SHA-256 of 19 tools,
  configurations, and lock files before resolving a bound version.
  A changed source invalidates prior bindings. Release publishing,
  authenticity and trusted cross-project distribution remain incomplete.
- The proposed local audit composes target-native full-spec CI and the
  external versioned metrics without overwriting the target's tools.
  Both gates were actually executed against Rill #18. Failed gates
  remain failures, and a profile marker does not certify readiness.
- `just lint`, TypeScript typecheck, Vite build and sample test suites
  passed on the local dirty worktree. Gitleaks history found no leaks. Trivy
  secret scanner returned exit 0 but lockfile rows showed `not scanned`;
  coverage must not be claimed from that result.
- Dependency audit first flagged `graceful-fs@4.2.12` through
  `@tailwindcss/vite` as a development dependency. Its SPDX-listed,
  OSI-approved `BlueOak-1.0.0` license is now explicitly accepted;
  distribution requires the license or a link to it. Unknown new licenses
  still fail. See [SPDX BlueOak-1.0.0][blueoak-spdx]. Neither a blanket
  allowlist nor a waived exit code is acceptable; verify the dependency path.
- A scoped PNPM build-script permission for esbuild 0.28.2
  enables locked clean installation without disabling strict build
  checks. The profile's local full-spec run passed; hosted PR CI
  is not yet verified.
- The real Rill #18 trial is documented in
  [Rill #18 pilot evidence](docs/quality/rill-18-pilot.md). On a
  current integrity-valid candidate, its native full-spec CI and
  measured complexity gate both returned exit code 1.
- Controlled negative scans detected a synthetic credential fixture:
  Trivy reported two findings and Gitleaks one. No real credential
  was used, and the temporary fixture was deleted. This is a
  sampled negative check, not proof of complete secret coverage.

Installed dependency directories and generated `.venv` are omitted from
Trivy filesystem scanning because committed PNPM and uv dependency
locks supply the vulnerability/license inventory; authored files remain
covered. This exclusion must be included in source-coverage validation.

## Remaining acceptance blockers

1. Rill #18's committed Vitest suite and its established code-size and
   complexity violations remain failing. No exception has been approved.
2. Native Just and hosted PR CI wiring on Rill #18 is not yet installed;
   the local external CLI invocation is not automatic repository enforcement.
3. Managed upgrades, rollback, drift reconciliation, release provenance,
   signing and trusted distribution are not implemented.
4. The full upstream plugin/tool matrix and a separate production-quality
   new-project pilot are incomplete. Framework E2E, accessibility,
   container and IaC gates remain subject to actual project applicability.
5. Reproduce full-spec on a clean clone, verify hosted PR CI and obtain
   independent review before merge or final owner acceptance.

[blueoak-spdx]: https://spdx.org/licenses/BlueOak-1.0.0.html
