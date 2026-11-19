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

| Contract       | Product result                                                         | Required evidence                                     |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Intake         | Detect stack, dependencies, constraints, current tests and risk        | Greenfield and brownfield real pilots                 |
| Requirements   | Business result, in/out scope, positive and failure cases              | Native GitHub parent/sub-issue and versioned docs     |
| Prototype      | Runnable, clickable user journey                                       | System Chrome interaction and mobile proof            |
| System design  | Interactive flows, dependency and risk tradeoffs                       | Human inspectable design, native consequential choice |
| Implementation | Actual application code with existing regressions preserved            | Candidate diff and executed checks                    |
| Integration    | Service, browser, accessibility and failure-path operation             | Current-candidate positive and negative tests         |
| Cleanup        | Remove obsolete code, reduce complexity, add needed tests and comments | Static analysis, focused regression and review        |
| Delivery       | Full quality matrix and independent review                             | CI, actual owner click test, scoped PR                |
| Handoff        | Exact next work without copied transcript store                        | Fresh agent reads Issues, Git and docs                |

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

## Industrial acceptance

The [quality matrix](QUALITY_STANDARD.md) covers lint, types, contracts,
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
