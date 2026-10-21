# Rill kernel

Status: Active owner decision, confirmed on 2026-10-21. This is the project's sole authoritative policy entry point.

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

### 3.5 Owner-controlled P0–P3 priorities

Every active work item, ticket, bug or actionable review finding needs exactly one **owner-approved** P0–P3 priority. Use Google's published P0–P3 impact/workaround definitions as the reference, adapted for the owner's Codex/GitHub workflow; Google also documents P4, which Rill does not import.

- **P0 — Critical:** essential workflow completely unavailable, no viable workaround, or immediate risk to critical work. Surface immediately; act only with authorization.
- **P1 — High:** material core capability blocked; no reasonable workaround or only an impractical partial one. Do before lower-priority tasks.
- **P2 — Medium:** bounded impact with a reasonable workaround; defer unless the owner selects it.
- **P3 — Low:** cosmetic or nonblocking improvement; defer or close unless the owner selects it.

**Only the owner classifies or changes priority.** Agents may collect observable impact and workaround facts and carry the owner-assigned value across Issue/PR/work items; they must never infer, raise, lower or default a priority. Without one confirmed value, an item stays untriaged and dependent implementation stops. Reuse the recorded owner decision instead of repeatedly asking.

For the personal GitHub repository, record authorized priorities as exactly one native label: `priority:P0`, `priority:P1`, `priority:P2` or `priority:P3`. An active child ticket or actionable finding requires its own recorded priority, not automatic inheritance from a parent. Labels are storage, not enforcement. Organization-only native Issue priority fields may replace labels if the actual repository becomes eligible and the owner approves. Applicable mandatory quality/security checks remain required even on authorized lower-priority work.

### 3.6 Source authority

OpenAI governs claims about Codex, GitHub governs GitHub semantics, and each language/tool maintainer governs its APIs. Anthropic's `claude.dev` is an official first-party engineering publication for methods and comparison, not a Codex API specification. Do not import another vendor's interface as a Codex capability.

## 4. Authority and supporting evidence

The owner confirmed the native-first principle on 2026-10-21 and supplied the complementary engineering contract in section 3 on 2026-10-22. The owner explicitly placed upstream/native precedence above the delivery objective. This decision supersedes earlier project clauses permitting custom adaptation to retain conflicting requirements. It does not by itself approve the remaining rebuild implementation or external operations.

The [capability map](capability-map.md) connects native Codex capabilities with Matt Pocock skills. [Upstream engineering facts](rebuild/foundation-inputs.md) provide the supporting evidence. Both are revisable inputs, not additional policy authorities.
