# Rill kernel

Status: Active owner decisions, initially confirmed on 2026-10-21; owner context and operating constraints updated on 2026-10-22. This is the project's sole authoritative policy entry point.

## 1. Highest priority: upstream and native development only

Use supported upstream and platform-native capabilities, interfaces, formats and workflows directly. This principle takes precedence over the delivery objective below and every pre-existing project requirement, plan, assumption, structure and implementation.

Build Rill around official Codex and its native platform on macOS. The foundation is a map of supported native capabilities together with Matt Pocock skills for engineering methods. Codex supplies the runtime and platform controls; the capability map connects work to verified native entry points and upstream evidence; the skills guide the engineering work. Use these supported extension points directly, subject to this kernel. Do not reproduce Codex orchestration, session management or platform controls in a separate Rill runtime. CLI utilities remain supporting tools, and another vendor's interface is not a Codex capability.

Project facts describe the current state; they do not make that state a preservation requirement. When a project fact or constraint conflicts with upstream/native development, remove or replace the conflicting state and update its documentation. Existing code, invested effort and previously approved plans do not justify keeping the conflict.

Compatibility development and technical debt are not accepted deliverables. Do not create compatibility layers, shims, parallel state systems or custom replacements for upstream/platform facilities to preserve an incompatible project design. Do not defer removal through a temporary workaround or a promise to clean it up later.

When the native capability cannot meet a stated requirement, revise, simplify or remove that requirement within the authorized scope. Report any remaining product decision concretely. An unsupported requirement does not authorize a custom adapter, a downgraded guarantee presented as success, or an exception to this principle.

### Apply the principle

1. Establish the relevant capability from the upstream owner's current documentation, release information, source or API. Identify the applicable product surface and version.
2. Verify the native interface and the behavior required by the task. Distinguish published capability, locally observed behavior and an unverified integration.
3. Align the project with that capability. Remove conflicting requirements, code, configuration and documentation in the authorized change scope; use the native path directly.
4. Complete the change only when its relevant references and acceptance claims agree with the resulting native behavior. Leave no compatibility implementation or deferred technical debt behind.

## 2. Delivery objective, subordinate to section 1

Deliver the owner's own macOS development workflow using Codex and GitHub: tools perform mechanical operations; agents clarify requirements, judge structure and logic, diagnose, implement and review. The owner decides product tradeoffs and authorization, without performing routine formatting repairs, re-entering state or reminding agents to invoke configured tools.

### 2.1 Owner context and priorities

The owner develops part-time alongside non-engineering work, has no software-development experience, and cannot provide full-time engineering coordination or maintenance. The intended division of work is approximately 99.99% Agent/tool execution; this is an owner expectation, not measured automation coverage. Limited experience does not lower the required code standard, repository cleanliness, naming consistency or product quality.

Within section 1 and non-negotiable correctness, security, privacy and reliability, optimize first for **development agility and budget**, then usable, coherent product design and human interaction, low maintenance burden and incremental extensibility. The owner considers design and interaction important to market viability; aesthetic quality is an acceptance concern, not proof of market demand. The current Rill scope is, by the owner's description, less than 10% of the broader vision. Future ideas are candidates for later small increments, not authorization to prebuild speculative systems.

Use **GitHub Free with predominantly private repositories** as the operating baseline. Paid subscriptions, plan upgrades, credits, API billing and additional services are **declined by default**. Branch protection/rulesets for private repositories are unavailable under this baseline; they are not pending acceptance work or reasons to demand an upgrade. Use native local checks and actual separate-agent review, record evidence in ordinary GitHub objects when authorized, and disclose that local checks are bypassable rather than claiming server enforcement. Current upstream eligibility and usage limits are documented in [owner-context evidence](rebuild/engineering-policy-sources.md#owner-context-and-platform-boundaries).

### 2.2 Requirements review and pollution control

**Every incoming idea first receives review and audit, not automatic adoption.** Treat the owner's spontaneous input as valuable but potentially incomplete, contradictory or unstructured. Treat the Agent's own suggestions with the same scrutiny. The owner explicitly calls unfiltered idea accumulation **pollution**; model hallucinations can compound that pollution. Preserve this risk description without treating the owner as the problem.

Before promoting input into a requirement: identify the intended outcome and user; separate facts, explicit decisions, preferences, assumptions and unsupported claims; clean repetition and contradictions; distill the smallest useful requirement; briefly brainstorm native alternatives including simplification or doing nothing; audit product value, design, security, cost, maintenance and scope impacts against current evidence. Use Matt's grilling methods for assumption testing, **not** its default repeated interview. Make review proportional: a small clear request needs a short check, not a new planning project.

Promote only evidence-supported, authorized requirements with observable acceptance. Retain only the distilled decision and necessary provenance in the authoritative spec/Issue; keep raw ideation and discarded alternatives out of persistent Agent instructions and implementation scope. Briefly disclose material omissions, deferrals or reinterpretations. Explicit owner decisions remain authoritative within the kernel: review is neither silent veto nor permission to add new requirements. Unsupported product tradeoffs go through section 2.3; routine engineering choices stay with the Agent.

### 2.3 Owner interaction and authority

The owner participates in initial intent and exceptional high-risk authorization, not routine research, commands, test planning, formatting, repository coordination, review meetings or repeated sign-offs. An approved outcome authorizes routine, reversible engineering within its scope and existing host permissions. Reuse existing authorizations; do not turn each internal phase or ticket into another owner approval. Payment, upgrades, destructive actions, sensitive credentials, production access and actions outside the approved scope retain their protected authorization boundaries.

When essential information or a material choice cannot be derived from tools, approved decisions or current artifacts, use **Codex's native structured selection control only**: short decision title, concrete choices and consequences, a recommendation, and an optional other/freeform choice where supported. No prose questionnaires, multi-round Q&A, numbered text pretending to be a selector, or asking the owner to infer a decision from a long report. For protected operations, use the platform's native permission/approval control; a product choice is not permission escalation. Payment/upgrade remains rejected unless explicitly authorized for that action.

If the current host does not expose the required native control, report that capability as unavailable, hold only the dependent decision/action and continue safe independent work. Do not fabricate a control, write a custom replacement, silently choose a high-risk answer or make the owner perform engineering work. Normal progress and delivery messages are concise results, evidence and genuine blockers, not a reading-comprehension assignment.

### 2.4 Agile solo development using upstream engineering practices

Keep established upstream conventions, small testable increments, separation of implementation and review, reproducible checks and recoverable delivery. Remove organizational overhead: team meetings, committees, multiple human approvals, mandatory remote CI/CD and repeated multi-party coordination. Native multi-agent execution supplies bounded engineering roles; it must not recreate an enterprise bureaucracy. The Agent owns sequencing, delegation, integration, diagnosis and handoff.

**Rill is the brand, not a source of new engineering vocabulary.** Use the owning platform's filenames, API names and ecosystem conventions for naming and repository structure; prefer ordinary names such as `src`, `tests`, `docs`, `worker` and `reviewer`. Avoid invented role brands, framework layers and duplicated standard concepts. Use plain domain-specific identifiers only where the product actually needs them. Keep generated files, temporary outputs, obsolete configs, unused dependencies and duplicate authorities out of the maintained repository; preserve unrelated owner changes and source material. No repository-wide renaming solely for stylistic novelty.

### 2.5 Native multi-agent execution

Multi-agent execution is a core Rill delivery capability, not optional role-play. The owner reports repeated practical benefit from real separate agents over one conversation pretending to be several reviewers; preserve that experience as owner evidence, not a fabricated benchmark. Use official Codex spawning, agent threads and native workspace isolation where needed. The primary integrates decisions; workers implement bounded changes; a **separate reviewer thread** evaluates the same candidate's spec conformance, correctness, tests, security and maintainability. An author is not its own sole reviewer. Automated tests still run in tools; agents cannot simulate their results.

Operational baseline: one primary and **at most two active delegated agents**, one writer per shared file/index scope, and no recursive delegation by default. Use one independent reviewer across the relevant review axes for a small change; split Standards/Spec or other specialist investigations only when genuinely independent, justified by risk and inside the budget. These are project execution rules until verified in the native host, not claims of hard sandbox enforcement. Never expand concurrent agents just to create an appearance of teamwork.

Every delegation identifies the bounded question, authorized write scope or read-only task, candidate revision, necessary evidence, expected result and stopping condition. Send distilled relevant context instead of the full raw conversation. Require distinct native thread/run identities and evidence-bearing results before reporting separate-agent review. Shared models/permissions do not create third-party organizational independence; that limitation does not justify replacing real threads with main-context impersonation. Recheck substantive fixes against the changed revision; stop circular debate and return to reproduction/evidence. If delegation is unavailable or budget cannot cover it, label independent review unavailable/incomplete and do not claim the review passed.

### 2.6 Five-hour allowance and spending discipline

Treat the owner's reported **five-hour usage window** as a real planning constraint: avoid exhausting it in roughly 30 minutes and losing the remaining 4.5 hours of productive access. This is the owner's failure scenario, not a measured run or a universal ChatGPT plan rule. Account-specific limits, remaining usage and reset times come from the native usage surface when available; report unknown values honestly. Never equate context tokens or elapsed minutes with exact quota or billing.

Before discretionary model work, use deterministic tools for extraction, checks, schema validation and diagnostics. Read targeted files/diffs; reuse still-valid primary-source findings and test evidence for the unchanged candidate/config/tool inputs; return compact failure/result digests with raw-evidence references. Re-run checks when relevant inputs change and keep mandatory delivery gates. Avoid duplicate research, full-log replay, repeated summaries, unnecessary model deliberation and polling that starts new model turns. Prefer on-demand references over ever-growing always-loaded instructions.

Budget primary and subagent work together. Use the least costly supported model/effort inside the already approved settings that can meet the task's acceptance; never silently upgrade models, effort, speed tier, plan or billing mode. Reserve capacity for independent review, correction, required gates and a recoverable handoff before expanding scope. Limit delegation breadth and output rather than discarding meaningful independent review. At an observed allowance warning, reduce optional scope, close completed threads and preserve a tested small increment with the exact next action; at exhaustion, stop model-dependent work without a retry storm, paid fallback or promise of automatic later resumption.

Judge efficiency by accepted increments per available allowance, useful independent findings, avoided rework, owner interruptions and maintenance cost. Use native usage measurements when exposed; otherwise label estimates and missing instrumentation. No unmeasured percentage savings or guarantee of uninterrupted five-hour operation.

### 2.7 Product design, maintenance and extensibility

User-facing acceptance includes coherent visual hierarchy, familiar interaction patterns, accessibility, keyboard/focus behavior, clear status, empty/loading/error states, recovery and user control. Inspect actual rendered behavior with supported tools when a UI exists; code quality alone does not establish a usable product. Aesthetic conclusions are judgments, and market success remains unproven without product evidence.

Prefer mature maintained upstream tools, small understandable modules, meaningful automated regression tests, actionable diagnostics, minimal deployment dependencies and documented native recovery. Expose failures before release to reduce the owner's future maintenance load; testing is an investment in sustainable part-time ownership, not a substitute for product acceptance. Preserve clear boundaries for later features without speculative plugin systems, future-proof frameworks, compatibility debt or including every idea in the current release.

## 3. Engineering execution contract (owner supplement, subordinate to section 1)

The following rules extend—not replace—the native-first kernel and delivery objective. They apply to Rill's authorized work. Their exact upstream evidence and platform boundaries are recorded in [engineering supplements](rebuild/engineering-policy-sources.md).

### 3.1 Policy engineering, not prompt engineering

Define checkable policy contracts and map each applicable invariant to a supported native enforcement interface: Codex permissions/configuration, compiler, formatter, schema validator, tests, Git/GitHub controls or reviewed owner decision. Treat agent instructions as routing/context, not as proof of enforcement. Verify positive and negative cases, actual invocation, failure behavior and scope before claiming a gate exists. A reported, skipped, unsupported or unexecuted check is not a passing check.

### 3.2 Delivery-first engineering loop

Deliver a functioning development feedback loop before discretionary features: applicable code quality/format rules, effective compiler/static analysis and diagnostics, high-quality reproducible tests (including negative/boundary cases), and the minimum observable traces/logs needed to diagnose real failures. Use tools for mechanical repairs; the owner is not the formatter or log interpreter. Configure only tools required by actual files and consumers; quality controls never imply installation of every candidate tool. Preserve real errors, exact inputs and revision identity.

### 3.3 Long-running execution and context economy

Keep deterministic call sequencing, safe bounded retry, output collection and digesting in the **supported Codex native sandbox/tool/harness** where available. Send the model only a compact, verifiable decision packet: operation, input identity, pass/fail/unknown, exit/status, changed files, minimal diagnostic, and a retrievable reference to raw evidence. Keep complete original evidence accessible for deeper diagnosis, subject to privacy/retention controls. Retry only identified transient operations with verified safe re-execution and a fixed bound; never blindly retry ambiguous writes. Do not build a separate Rill orchestrator to imitate absent native capabilities. Measure rather than assume token savings.

### 3.4 Code evidence before model judgment

Use executable tests, compilation, schema validation, static analysis, file/API checks and deterministic assertions whenever they can answer the question. Model assessment is reserved for judgment code cannot settle. For that remainder, use a claim-by-claim factual checklist (expected property, artifact/source, evidence, pass/fail/unknown) or a controlled blind A/B comparison; do not use vague 1–5 quality scores as acceptance. Never promote a model's confidence or prose into a mechanical check result.

### 3.5 Google Issue Tracker P0–P4: exact upstream rubric

Use **Google Issue Tracker's published common P0–P4 definitions**, including P2 as its documented default, without substituting a Rill-specific severity rubric. [Google source](https://developers.google.com/issue-tracker/concepts/issues). Google states that individual teams may use different criteria; Rill deliberately selects this published common rubric unchanged.

| Priority | Google's published meaning                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | Act immediately with as many resources as needed. Full outage or critical product function unavailable to everyone, with no known workaround.                                                                                                                                            |
| **P1**   | Act quickly. Significant impact to a large share of users; workaround, if any, is partial or excessively painful. A core organizational function is affected or another team is fundamentally impeded.                                                                                   |
| **P2**   | Address within a reasonable timescale. A would-be P0/P1 with a reasonable workaround, important impact to many users in a core function, or blocking another team without a reasonable workaround. Important for first-use and installation issues. **Google's default priority is P2.** |
| **P3**   | Address when possible. Relevant to core functions or other teams but not blocking progress, or a reasonable workaround exists.                                                                                                                                                           |
| **P4**   | Address eventually. Not relevant to core functions or other teams, or only affects presentation, attractiveness or pleasantness.                                                                                                                                                         |

**Priority authority:** The owner decides whether an issue fits Google's published criteria and authorizes any priority change. An Agent can gather observed impact/workaround evidence, read and validate the recorded priority, report discrepancies, and execute already authorized work. An Agent must not infer, assign, raise, lower or automatically default an issue's priority. A missing/conflicting GitHub priority remains untriaged for owner decision. Google's P2 default is a fact about **Google Issue Tracker**, not permission for the Agent to fill in an absent GitHub value.

Priority classification must not become a routine owner questionnaire. Keep a new backlog item untriaged when no approved value exists; already-authorized engineering within the current task can proceed without inventing a priority. Escalate only a real scheduling/product conflict through the native selection control.

Store owner-authorized priority on the native GitHub Issue record. The personal repository may use native labels `priority:P0` through `priority:P4` where labels are the supported issue metadata; use a native typed priority field only if genuinely available. No duplicated prioritization database or custom classifier. Do not invent a new project-specific rule that all P2/P3 work must be declined: authorization and actual task value remain the owner's decisions. Applicable quality/security controls are independent of priority.

### 3.6 Locked implementation language and native tools

Rill's first-party executable source language is **TypeScript 7.0.2 only**, on **Node.js 24 LTS** with **pnpm 12.14.0**. No first-party Python, JavaScript or Shell implementation. Shell can invoke pre-existing commands; packages and native tools may themselves be implemented in any language. Codex App configuration and skills remain official native formats rather than being rewritten as TypeScript.

For every actual code or documentation change, use the single locked [engineering feedback loop](engineering-loop.md): `.editorconfig` baseline; Biome 2.6.2 as the sole TS/JSON/Markdown formatter and applicable linter; markdownlint 0.42.0 as supplementary Markdown rules; TS7 compiler diagnostics; Vitest 5 + V8 coverage for tests; Ajv 8 for JSON Schema; and the native Just/Gitleaks/Lychee/Lizard/Trivy/Knip/Tokei gates. Command contracts, versions, fixes and observable failure behavior live in native project configuration and the linked loop, not an Agent's independent tool selection.

### 3.7 Source authority

OpenAI governs claims about Codex, GitHub governs GitHub semantics, and each language/tool maintainer governs its APIs. Anthropic's `claude.dev` is an official first-party engineering publication for methods and comparison, not a Codex API specification. Do not import another vendor's interface as a Codex capability.

## 4. Authority and supporting evidence

The owner confirmed the native-first principle on 2026-10-21 and supplied the complementary engineering contract in section 3 on 2026-10-22. The owner explicitly placed upstream/native precedence above the delivery objective and added the section 2 operating context on 2026-10-22. That context customizes execution without relaxing section 1 or replacing deterministic quality gates. This decision supersedes earlier project clauses permitting custom adaptation to retain conflicting requirements. It does not by itself approve the remaining rebuild implementation or external operations.

The [capability map](capability-map.md) connects native Codex capabilities with Matt Pocock skills. [Upstream engineering facts](rebuild/foundation-inputs.md) provide the supporting evidence. Both are revisable inputs, not additional policy authorities.
