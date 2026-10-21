# Rill — Codex-native rebuild plan

Status: **foundation research and policy alignment prepared; implementation not approved by this document**. Updated 2026-10-21.

Local target: `/Users/hugh/Projects/rill` (an existing Git repository). This plan does not authorize external writes, installation, changes to personal/global configuration, deployment or release.

## 1. Governing principle and outcome

The [kernel](docs/policy.md) is the sole active project policy and takes precedence over every project fact and this plan. Work from **official Codex**, its **native capability map**, and **Matt Pocock skills**. When legacy structure, preferences or planned guarantees conflict with an upstream-supported path, simplify or remove the conflict. Do not build shims, dual state, compatibility layers, alternative host runtimes or deferred cleanup.

**Delivery outcome:** a dependable **owner-operated macOS Codex + GitHub development workflow**. Tools handle repeatable mechanics; agents clarify requirements, reason about design and logic, diagnose, implement and review. The owner supplies product judgments and authorizations, not routine formatting, re-entering state or reminders to call configured tools.

This is not a general multi-user product. GitHub contains native execution objects, the repository contains human-readable specifications, and Codex contains the agent runtime. [Capability map](docs/capability-map.md) and [upstream facts](docs/rebuild/foundation-inputs.md) are evidence, not parallel policy or execution engines.

## 2. Constraints and decisions for this rebuild

- **Platform:** macOS and the owner's real Codex App workflow in this round. Other operating systems, broad compatibility and migration support are out of scope.
- **Language:** Use native Codex and Markdown first; TypeScript 7 strict is the candidate when a real code consumer exists. Official Python SDK is an alternative. No speculative scaffolding.
- **Content:** Markdown for human-facing explanations, decisions, plans, specifications and reviews. Use machine-readable formats only for supported native configuration or a demonstrated consumer.
- **GitHub:** real Issues, parent/sub-issue/dependency relations, labels, milestones and Issue–PR/Development links where relevant. No GitHub Projects or second execution-state database.
- **Priority:** owner-only P0–P3 assignment. Active work must have one authorized GitHub Issue priority label; P0/P1 are the delivery queue, P2/P3 deferred unless the owner opts in. Untriaged work is blocked, never auto-defaulted.
- **Engineering contract:** [kernel section 3](docs/policy.md) governs policy-as-code, tool-first evidence, bounded execution digests and factual evaluation. See [source research](docs/rebuild/engineering-policy-sources.md).
- **Engineering controls:** use mature tools only for actual file types and real failure risks. Checks and fixes must have separate observable behavior; never claim a check ran without execution evidence.
- **Metrics:** retain candidate project limits of **500 code LOC** for new/changed first-party source files and **CCN 15** for supported functions, including the applicable pre-PR scope. Code lines are not bytes. No generic document byte gate. A claimed blocking scope remains conditional on native tool capability and an actual validation path.
- **Models and delegation:** use only real Codex App settings and supported model/effort options, verified in their actual execution surface. Do not treat example labels or an agent description as effective runtime restrictions.
- **Authorizations:** remote publishing, merges, releases, purchases, credentials and personal/global changes have separate boundaries. This document is not blanket authorization.

## 3. Implement through native phases

Each phase starts from observed repo and App state. A proposal, declared configuration or past test is not a completed run.

### Phase 1 — Ground the first real task

Select the owner's approved P0/P1 work item, or a P2/P3 item only when explicitly authorized. Verify the GitHub priority label first; leave missing priorities untriaged for the owner's decision. Resolve material unknowns using Codex plus Matt `research` / `grilling` only when they apply. Record a single Markdown spec with observable acceptance and separate any authorization required to perform the task.

**Exit:** real task, scope, upstream references, expected result and blocker decisions are explicit. Do not first build a universal workflow framework.

### Phase 2 — Match the capability map to the App

Open the actual Rill project as the primary Codex folder. Verify instruction discovery, relevant skill availability, permissions, Git integration, available native execution paths, and the real configuration fields/versions. Compare requested behavior with [the map](docs/capability-map.md) and [facts](docs/rebuild/foundation-inputs.md).

**Exit:** each needed capability has an actual native entry, testable acceptance and explicit *verified/documented/unknown* state. Drop or revise unsupported controls without compatibility code.

### Phase 3 — Connect only necessary mechanical checks

Deliver executable quality checks, compiler diagnostics, tests and failure observations before discretionary features. Choose appropriate supported formatter, linter, tests, type and security checks for actual files. Assign one formatting writer per format dimension. Separate `check` from `fix`; inspect effective config and mutation behavior. Prefer Codex's direct native task execution. Configure supported hooks only if a concrete requirement needs an event and its failure semantics are understood.

**Exit:** real good/bad inputs, observed tool invocation and diagnostics, successful repair, repeat-run stability, scope and non-mutation evidence. Unapplicable, blocked and unexecuted checks are distinguished. No owner-performed routine repairs.


### Phase 4 — Exercise Git and review on the real task

Using Matt methods only at their relevant phase, follow clarification → spec → architecture review → implementation scope → actual Codex edits/checks → independent semantic review → PR when authorized → retrospective. Repeat edit/check/review after a second change. Where required, test a real `pre-commit` event and partial staging in a disposable branch/worktree.

**Exit:** two stable edit cycles and a same-revision check/review record. Test actual Git index boundaries; do not claim a hook protected the entire App or server if the documented surface cannot.

### Phase 5 — Verify GitHub delivery and failure recovery

With separate remote authorization, use GitHub's native Issue relations, branches/commits, PR, checks and review, then read those objects back. In safe disposable contexts, test wrong directory, bad configuration, check failure, interruption and uncommitted-content preservation.

**Exit:** a concrete linked Issue/spec/PR/revision where applicable, reliable native readback and recoverable working state. Unknown or failed checks remain visible. No checkpoint engine, fake CI or sync database.

### Phase 6 — Accept and hand off

From the documented entry point, repeat the owner's actual macOS task. Review whether the tools performed all routine mechanical work and whether the outcome meets the spec. Document only the commands, paths, dependencies and repair/rollback steps actually verified; keep maintenance instructions proportional.

**Exit:** the real task succeeded; relevant checks and independent review apply to the delivered revision; any outstanding limitation is explicit. Do not claim zero future failures, token/cost savings or universal enforcement without measured evidence.

## 4. What this plan deliberately does not build

No custom scheduler, planning database, checkpoint store, synthetic policy-enforcement service, compatibility adapter, copied legacy script stack, general record schema, duplicate GitHub metadata, or release machinery. No pre-created empty app structure, unrelated runtimes, cloud CI mandate or cross-platform implementation. If there is no actual consumer, do not create a configuration or integration for it.

The native-first decision is **not** permission to skip a material safety or correctness need. Record the observed unsupported guarantee and ask the owner for the corresponding product-scope decision; do not disguise a gap as a successful check.

## 5. Authority and current status

Already confirmed in the [kernel](docs/policy.md): upstream/native precedence and owner-only authorization of new policy. Prepared here: [capability map](docs/capability-map.md), [upstream engineering evidence](docs/rebuild/foundation-inputs.md) and phased acceptance strategy. **Not claimed complete:** App integration, skill execution, selected real task and frozen spec, formatter/quality gates, real Git event, GitHub publication, independent review, recovery validation or workflow acceptance.

The Mac repository already exists; this planning update neither initializes another repository nor changes the remote. Implementation, permission-sensitive actions and acceptance remain separate from second-round document preparation.
