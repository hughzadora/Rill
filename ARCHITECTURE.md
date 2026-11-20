# Rill Architecture

## Factory, not an application-specific workflow

Rill defines an adoptable standard for multiple independent product
repositories. Each product retains its own business domain, Git history,
version control, product requirements and deployments.

    Owner intent -- native harness decisions and permissions
         |
    Product requirements + design + acceptance
         |
    GitHub native project / parent and sub-issues / dependencies
         |
    Native Codex coordinator and independent agents
         |
    Actual product source (React/Tailwind | Node/TS | Python | Shell)
         |
    Maintained language-specific lint, tests and security checks
         |
    Build, integration, review, user trial and CI
         |
    Verified PR / release / rollback evidence

    Read-only delivery console <- GitHub issues, project fields, PR checks
                                <- actual candidate and quality receipts

## Sources of truth

- **Owner and native harness**
  - Owns: Scope, major decisions, protected permissions
  - Must never impersonate: The tool runner or fabricated approval
- **GitHub Issues**
  - Owns: Parent/sub tasks, acceptance, blockers, dependencies
  - Must never impersonate: Proof of real runtime behavior
- **GitHub Projects (when enabled)**
  - Owns: Priority, status, iteration and native views
  - Must never impersonate: A second specification
- **Git/PR**
  - Owns: Revision, review, changes and merge record
  - Must never impersonate: User acceptance
- **Version-controlled docs**
  - Owns: Product, architecture, design, handoff and quality contract
  - Must never impersonate: An unverified live status
- **Native agents**
  - Owns: Session, compaction, delegation, tool sandbox
  - Must never impersonate: Local replacement runtime
- **Maintained quality tools**
  - Owns: Executed tests and reports
  - Must never impersonate: Claims that untested paths work
- **HTML dashboard**
  - Owns: Readable live aggregate with traceable sources
  - Must never impersonate: Task writes, credentials or authorization

## Modules and boundaries

- Native role declaration: `.codex/config.toml` and three `.codex/agents/` roles.
- Stack quality toolchain: #39 native root Just/Mise tool locks.
- Delivery console: React/Tailwind apps/console and read-only tools/preview.mjs;
  this repository's UI is not factory-wide acceptance.
- Cross-project standard: native Copier configuration at copier.yml and
  versioned standard source in standards/template; generated CI executes
  against product files and never replaces the harness. Candidate only.
- Pipeline entry: justfile and .github/workflows/quality.yml.
- Product documentation: PRD, DESIGN, POLICY, PROJECT_MANAGEMENT, HANDOFF,
  MULTI_AGENT and the #39 native quality requirements; all must remain discoverable.

The browser must never receive GitHub tokens. Treat issue bodies, URLs and
metadata as untrusted input. Use text nodes, restrict API methods and paths,
report stale or partial source data and do not infer absent fields as passed.

## Installed Rill CLI ownership and runtime

`src/py/rill_cli/cli/` routes Typer/Rich commands and Git policy entrypoints;
`core/installer.py` provides clean-repo Copier init/upgrade and atomic Git
commits. `state.py` writes `.rill/state.json` atomically; `git_policy.py`
checks branch, commit size and independent frontend/backend changes;
`guardrails.py` and `hooks.py` implement scoped write warnings and bounded
symbol extraction. `dashboard.py` renders local facts and an ephemeral
loopback receipt endpoint, with a single-file embedded HTML asset.

`VERSION` is the source for installed `rill-factory` metadata. Paths,
limits, roles and state keys belong to the CLI constants registry.
`standards/template/` is the canonical Copier tree; the source
`src/py/rill_cli/template/` is a symlink, not a maintained copy.
Frozen PyInstaller onedir builds explicitly add that tree and the HTML asset.

Normal edits cannot change Tier 0 framework files through a compliant
pre-tool native Hook, and ordinary writes are restricted to task scope.
Post-tool audit reports violations, but must not silently restore or delete
unknown human work. The native sandbox and approval boundary remains in
charge; Hook JSON alone does not prove native interception occurred.

Local `just check-fast`, `just ci` and `just ci-full` are progressive gates.
PR CI is a single cached Ubuntu L2 job. `v*` Tag builds alone may invoke
release runners for Linux x64/ARM64 and Apple Silicon macOS 26+.
An installed `rill ui` single-file project dashboard is separate from the
repository's React/Tailwind engineering console; neither represents
unverified approval as a completed action.

## New and existing project adoption

New: inspect the desired stack; establish root docs, native repo setup,
actual product build, package locks, parent/sub-issues and applicable gates;
run positive and negative behavior in a clean clone.

Existing: inspect the current repository, effective tools, baseline failures,
security, data and module boundaries before integrating. Preserve unrelated
work. Add only valuable missing gates; carry forward actual legacy debt and
prove removal/rollback. Do not replace mature native tooling for stylistic
uniformity.

## Release and failure model

The untagged candidate uses Copier's version-aware answers, generated
applicable per-stack GitHub workflows and native Git update/rollback.
Temporary new-project generation, independent React/Node/Python/Shell
source and Chrome/CLI checks, and Node brownfield recovery are automated.
The actual standard release tag, hosted non-synthetic target checks,
and owner acceptance **remain unverified**.
Local fixture success is not a trusted standard release. On an unknown
result, failed API, broken native hook or stale test, show an explicit
blocker rather than an optimistic badge.

Dependencies should form an acyclic graph; packages exist for real independent
functions rather than a cosmetic monorepo structure. Cleanup eliminates
duplicate runtimes but never deletes durable project-management authority.
