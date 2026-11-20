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

- Native role declaration: .codex/config.toml and .codex/agents.
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
