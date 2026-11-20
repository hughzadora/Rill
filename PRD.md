# Rill Product Requirements

## Definition

Rill is a reusable **full-lifecycle software delivery system** for both new
and existing repositories. Its output is verified, maintainable software with
reproducible engineering evidence. It is neither one business application nor
an Issue title browser. The owner supplies outcomes and consequential product
decisions; native agents and maintained tools carry out research,
implementation, testing, repair and review.

Default supported stack: **React + Tailwind CSS, Node.js + TypeScript, Python,
and Shell**. Every present language gets its applicable, executable gates.
The standard must be adoptable without copying the Rill repository or
replacing functioning tools in an existing product.

## Delivery contracts

- **Intake**
  - Product result: Detect stack, dependencies, constraints, current tests
    and risk
  - Required evidence: Greenfield and brownfield real pilots
- **Requirements**
  - Product result: Business result, in/out scope, positive and failure cases
  - Required evidence: Native GitHub parent/sub-issue and versioned docs
- **Prototype**
  - Product result: Runnable, clickable user journey
  - Required evidence: System Chrome interaction and mobile proof
- **System design**
  - Product result: Interactive flows, dependency and risk tradeoffs
  - Required evidence: Human inspectable design, native consequential choice
- **Implementation**
  - Product result: Actual application code with existing regressions
    preserved
  - Required evidence: Candidate diff and executed checks
- **Integration**
  - Product result: Service, browser, accessibility and failure-path
    operation
  - Required evidence: Current-candidate positive and negative tests
- **Cleanup**
  - Product result: Remove obsolete code, reduce complexity, add needed tests
    and comments
  - Required evidence: Static analysis, focused regression and review
- **Delivery**
  - Product result: Full quality matrix and independent review
  - Required evidence: CI, actual owner click test, scoped PR
- **Handoff**
  - Product result: Exact next work without copied transcript store
  - Required evidence: Fresh agent reads Issues, Git and docs

## Large-feature lifecycle

1. Requirements and acceptance.
2. Fast clickable prototype; owner checks experience.
3. Interactive design and major decision through native harness control.
4. Agent implementation with existing regressions (new unit tests follow later).
5. Integration, simulated and genuine owner use.
6. Deep clean, documentation, necessary why-comments and focused unit tests.
7. Full second regression, independent reviewer and owner click acceptance.
8. Focused PR with complete evidence, then separate protected merge/release.

Small tasks may combine stages but cannot skip risk-relevant quality checks.
Owner checkpoints are prototype, major design choice and final real behavior.

## Standalone local CLI acceptance

The owner uses an installed `rill` binary without cloning the factory or
maintaining its Python virtual environment. The complete lifecycle is
`version`, `init PATH --yes`, `upgrade PATH --yes`, `status`, `doctor`,
`ui PATH [--no-open] [--serve]`, and `hook EVENT`. Machine-readable calls use
`--json`; failures distinguish policy denial (1) and environment error (2).

An initialized project must receive a clean Git repository, a protected
feature branch, versioned Copier assets, an atomic harness initialization
commit, and a compact private state anchor. Upgrade must require a clean
worktree, verify managed-file hashes and retain the prior Git HEAD as a
restore point. Copier and Git perform the actual update; no manually
reimplemented commit parser or unsafe blanket reset may replace them.
Product-owned files remain outside Rill's upgrade scope.
The dashboard is an offline HTML view of real state, bounded symbols, Git
history and revision-bound CI receipts. A dirty working tree cannot certify
a Git commit; a one-shot localhost decision records owner input but does not
authorize releases or destructive operations.

The native agent roster contains Explorer, module-owner Worker (including
its tests) and read-only Reviewer, with a three-child limit and maximum
one nesting level. Full local CI must pass before candidate-bound review;
if a second review still fails, stop rather than loop or weaken tests.
A live Codex dispatch must confirm whether model and permission settings
actually took effect; TOML parsing is insufficient evidence.

Supported release archives target Linux x64/ARM64 and Apple Silicon macOS 26+
only. GitHub PR CI uses one Ubuntu runner and the light L2 gate; costly
macOS release runners are Tag-only. No Windows or Intel Mac release target.

## Industrial acceptance

The [quality matrix](README.md) covers lint, types, contracts,
unit/component/integration/CLI/browser/accessibility and negative tests,
build, coverage, performance where relevant, dependency/license/secrets/SBOM,
recovery, independent review and actual product acceptance.

Project-management needs actual priority, ownership, stages, acceptance,
blockers, dependencies, candidates, reviews and next human action, not a
static tree of titles. GitHub remains the native authority; the interactive
console is a live presentation, not a second mutable project database.

A fixture gate does not prove real project adoption. The factory is complete
only after **new-project and existing-project** installations, version
distribution, observed execution, upgrade and rollback are verified.

## Authority

Only the real native harness may bind consequential owner selection or
protected approval. No purchase, upgrade, privilege expansion, production
change or merge is implied by this specification. Never hide failures by
lowering thresholds or masking source roots.

The current product engineering parent is
[Issue #22](https://github.com/hughzadora/Rill/issues/22), and
[Issue #23](https://github.com/hughzadora/Rill/issues/23) is the permanent
bug parent. Closed historical #10 and #18 remain evidence, not live backlogs.
