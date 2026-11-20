# Rill Product Requirements — Blueprint 10.0.1

> **Blueprint edition:** 10.0.1 (design only). **Product version:** canonical root [`VERSION`](VERSION), initialized to `0.0.1` under SemVer 2.0.0; no release or Git tag is implied. This is the single **living** specification for Rill's current product. Permanent purpose and authority: [CONSTITUTION.md](CONSTITUTION.md). GitHub Issues/PRs and Git preserve execution history. Requirements are not evidence of completed implementation.

## Vision, Scope & Non-Goals

Rill is a distributable native-first Codex software factory. The owner specifies outcomes, consequential choices and protected authorization; native agents and maintained tools research, design, build, test, diagnose, independently review and recover real new/existing software projects. The product must work in an independent project without Rill's development conversation.

In scope: official native capability packaging, documented CLI, workflow Skills/roles/Hooks and justified MCP; real quality/security gates; accurate GitHub/CI evidence; safe project enrollment; accessible read-only status; fresh-session recovery.

Not in scope: custom agent runtime/scheduler/permission model, copied transcript DB, full-screen TUI, blanket wipe of **consumer** project work, fake approvals, universal open-source repository decoration, automatic paid fallback, parallel GitHub tracker, or compatibility layers for retired **Rill** versions. Rebuild Rill implementation cleanly on this isolated branch; Git retains prior history for research, but legacy interfaces/configuration are not supported.

## Functional Requirements

Status: `[PLANNED]`, `[IN-PROGRESS]`, `[DONE]`. A status reflects **verified current delivery**, never file presence or an Agent self-report. Native execution claims require traceable events and effective trust/permission evidence. Paths are planned anchors only until confirmed by code. All currently redesigned capabilities start as planned.

| ID | Outcome / acceptance | Proposed landing area | Status |
|---|---|---|---|
| FR-01 | Versioned, independently installable native Codex package; fresh trusted session proves actual loading, model/permissions/roles/Hooks and optional MCP. | `bundle/plugin/`, `.agents/plugins/marketplace.json`, `bundle/repo-common/.codex/` | [IN-PROGRESS] |
| FR-02 | `rill setup/init/doctor` operate on real isolated new/brownfield repos without destructive consumer overwrites; explicit JSON and exit codes. | `src/init.ts`, `src/adopt.ts`, `src/cli.ts`, `bundle/repo-common/` | [IN-PROGRESS] |
| FR-03 | Owner intent flows through proportionate brainstorming, primary-source research, grill and a current acceptance-ready spec before execution. | `bundle/plugin/skills/`, `PRD.md` | [PLANNED] |
| FR-04 | Native worker roles implement scoped code and regression tests; no hand-rolled agent runtime or unnecessary owner coordination. | `bundle/repo-common/.codex/agents/`, `bundle/plugin/skills/` | [PLANNED] |
| FR-05 | Applicable source-complete lint, type, integration, accessibility, secret, supply-chain, coverage and negative tests gate delivery and reject false PASS. | `biome.json`, `package.json`, `.github/workflows/quality.yml`, `bundle/stacks/` | [IN-PROGRESS] |
| FR-06 | Actual independent reviewer assesses exact tested candidate; two-round bound and platform-native protected authorization. | `bundle/repo-common/.codex/agents/`, `bundle/plugin/skills/` | [PLANNED] |
| FR-07 | Fresh agent recovers project, exact SHA, Issues/PR dependencies, tests and next action after interruption or context compaction. | `bundle/plugin/skills/`, GitHub | [PLANNED] |
| FR-08 | Versioned updates/rollback and conflict checks preserve consumer-owned files; no legacy Rill compatibility adapters. | `src/update.ts`, `bundle/plugin/skills/rill-update/` | [IN-PROGRESS] |
| FR-09 | Every enrolled product has **one** live root `PRD.md`; scoped reads, stable requirement IDs, status plus evidence-linked source traceability. | `bundle/repo-common/PRD.md` | [PLANNED] |
| FR-10 | Bundle an upstream-derived brainstorming Skill; Rill-controlled research/grill entrypoints invoke it before **substantive new design**, without duplicate interviews. | `bundle/plugin/skills/brainstorming/` | [IN-PROGRESS] |
| FR-11 | Optional accessible local status view displays version-bound actual gate state, blockers, unknowns and safe next action; never pretends to approve. | `src/`, `bundle/` | [PLANNED] |
| FR-12 | Independent external new/existing repositories prove actual feature, native workflows, genuine CI, fresh-agent recovery, independent PR and release/rollback. | External pilot evidence in GitHub | [PLANNED] |

## Non-functional and Resource Constraints

| ID | Contract / measurable proof | Status |
|---|---|---|
| NFR-01 | CLI startup benchmark on all supported targets; proposed <20ms is **not** a requirement until measured against real binary and load. | [PLANNED] |
| NFR-02 | Existing plan usage limits; local deterministic work before paid inference; bounded agents/retries and no unapproved paid service or credits. | [PLANNED] |
| NFR-03 | Measure Actions per stack and adopt tiered jobs; proposed <60s per job is an aspiration, not a universal correctness gate. | [PLANNED] |
| NFR-04 | Applicable real-source coverage with validated inventory; >=80% proposed floor subject to evidence, not a proxy for quality. | [IN-PROGRESS] |
| NFR-05 | Native sandbox, approvals and Hook trust are independently checked at runtime. Global instructions and reviewer prompts are not security isolation. | [PLANNED] |
| NFR-06 | TypeScript 7-first baseline unless a separately approved evidence-based change; standard tools and clean conventional structure. | [PLANNED] |

## Living Document and Evidence Rules

1. One current `PRD.md` per Rill or consumer repository. This constitution defines the Rill factory's **why** only. Retire redundant DESIGN/ROADMAP/MULTI_AGENT as *live specification authorities*, keeping historical reasoning in Git/Issues.
2. Modify relevant requirements in place upon product decisions, not append conversational histories. Deprecated behaviors disappear from the current PRD but their decision provenance survives in Git/Issues. Stable IDs are never recycled for unrelated meanings.
3. `AGENTS.md` is only a concise index. During routine work, use `rg -n` and bounded line slices for relevant FR/NFR and acceptance; full-file read is permitted for initial scope review and deliberate broad audits.
4. Transition to `[DONE]` only with actual implementation paths, exact source SHA, passing source-bound test receipts and required native/user evidence. GitHub issue closure is not sufficient proof. Record references in Issue/PR and keep reverse links where useful.
5. Conventional files and native platform capabilities are preferred. Do not hand-code parsers, package managers, Git commit logic, session managers, or incompatible platform controls.

## Acceptance and Authority

A reviewed, independently installed release completes genuine scoped work in one real greenfield and one brownfield product repository, passes applicable positive/negative hosted checks, survives session interruption, obtains separate reviewer findings, preserves consumer files on update, demonstrates rollback and produces a verifiable PR. A real owner accepts the actual feature separately. No specification grants permission for purchase, privilege escalation, production changes or protected merge.
