# Rill engineering supplements — upstream evidence

Status: owner-provided additions to the existing kernel, researched 2026-10-22. This is **evidence and application guidance**, not a second policy or authorization for implementation. The [kernel](../policy.md) remains the sole rule authority; the [Codex capability map](../capability-map.md) names the actual native entry points.

## Language recommendation: native configuration first; conditional TypeScript 7

- **First deliverable:** Markdown specifications and native Codex/GitHub configuration, skills, and supported tools. Do not initialize a language project until an identified runtime consumer exists.
- **When code is necessary:** use **TypeScript 7 stable with strict checking** as the primary candidate for Codex-facing integration or typed validation. Microsoft's 2026-07-08 TypeScript 7 announcement describes a released native compiler, built in Go, with typical 8–12x build speedups compared with the earlier implementation; benchmark speedups are not a guarantee for Rill's workload. [TS7]
- The **official Codex SDK** offers both TypeScript (`@openai/codex-sdk`, Node 18+) and stable Python (`openai-codex`, Python 3.10+) interfaces. Prefer neither SDK when a direct App action solves the task. The SDK controls Codex programmatically; it is not proof that the official App loads or executes project hooks identically. [CS]
- Python is an upstream-supported alternative for a clearly Python-native tool or established Python consumer; Go/Rust/Swift are not prerequisites. Adding them for a hypothetical harness or GUI conflicts with native-first. TypeScript choice remains subordinate to an actual supported consumer and the owner's scope.

## 1. Policy engineering, not prompt engineering

An instruction in `AGENTS.md` describes intent, but does not prove that a tool, gate or priority rule enforced anything. Map every applicable engineering invariant to its **native enforcement surface** (compiler, formatter, schema validator, tests, Git hook, Codex permission, GitHub restriction) and observable pass/fail/unsupported evidence. Execute one positive and one negative or boundary case before claiming enforcement. Keep the authority and the check separate: an agent cannot declare its own success a passing gate.

OpenAI documents Codex project configuration and hooks, including trusted-project boundaries. Codex OpenTelemetry export is documented but `otel` cannot be set via project-local `.codex/config.toml`; it belongs to the user configuration layer and requires separate authorization. [CFG][OTEL] This source boundary determines what Rill may truthfully promise; do not create a substitute runtime or silently skip an unavailable gate.

## 2. Deliver the engineering feedback loop before new features

Order of work: runnable checks and fix commands for *actual* file types; effective compiler/static analysis and clear diagnostics; high-quality tests covering successful, failed and boundary behavior; and observability sufficient to reconstruct failures. Each check states its real input, version, exit semantics, mutation behavior and scope. These are the first usable development capabilities, not a requirement to install a universal scanner stack.

With TypeScript source present, native TS7 strict checking plus relevant tests and JSON Schema validators are candidates. For all code, prioritize tests that fail on an introduced defect, not only test/coverage counts. Anthropic's engineering review write-up documents layering runnable builds/tests, machine checks, human review and rapid rollback; these are design lessons, not Claude Code APIs for Rill. [CR]

## 3. Long-running cost: keep tool trajectories out of model context

The owner's cost-model claim is operationally sound: repeated raw tool call/response histories can dominate future turns' input, even when the model needs only a decision-relevant result. The goal is **model for judgment; native harness and tools for mechanical steps**.

- Execute commands in the supported Codex sandbox/tool surface. Handle deterministic call sequencing, **bounded retries of known transient/idempotent operations**, and results parsing there when the official platform exposes those controls. A failed write or ambiguous timeout must not be retried blindly; classify its effects or ask for permission.
- Return a **bounded digest**: operation and inputs, outcome/pass/fail/unknown, exit code, elapsed time, relevant changed paths, failing assertion or diagnostic, and a reference to complete original evidence. Preserve raw logs for on-demand inspection; never fabricate their persistence or replace errors with “all good.”
- Aggregate repeated unchanged successes without re-posting identical transcripts. Escalate new, divergent, high-impact failures with enough diagnostic detail for model reasoning. Measure tool-to-model bytes/tokens and recovered failures in the real Codex workflow before claiming savings.
- Codex's documented platform differentiates `codex exec` for bounded automation, the official SDK for programmatic tasks, and app-server for custom clients. The **existing Codex App is Rill's host**; choosing one of these interfaces does not require building a new orchestrator. [PLATFORM][CS]

A compact digest may reduce repeated context payload; it does **not** guarantee bounded total conversational context, flawless recovery or zero token cost. Anthropic also finds that compaction alone is insufficient for long-running software tasks; persisted environment state and session handoffs matter. [LONG]

## 4. Deterministic evidence outranks model grading

Prefer the compiler, unit/property/integration test, real CLI/API readback, JSON Schema validation, static analyzer and reproducible assertions whenever they can decide an outcome. A model must **not** replace a deterministic pass/fail result with its own impression.

For an irreducibly semantic question, specify a **fact-check checklist** with an atomic claim, source or produced artifact, expected property, observable evidence, and true/false/unknown outcome. Where comparative judgment is unavoidable, use a blind A/B with a fixed task and outcome rubric, without telling the judge which candidate is favored. Do not substitute subjective 1–5 numerical ratings. Treat unknown and skipped as different from passed.

## 5. Priority research: Google definitions and GitHub native storage

Google Issue Tracker publishes a familiar, **five-level P0–P4 model**, explicitly noting that teams may use different criteria; it describes P0 immediate total critical-function outage without a workaround, P1 significant/core impact with incomplete or painful workaround, P2 reasonable-timescale work or critical impact with a reasonable workaround, P3 work that does not block progress, and P4 eventually/cosmetic work. P2 is **Google's default**, **not Rill's**. [GOOGLE]

The Rill owner's requested P0–P3 scope is a deliberate four-tier adaptation (P4 is not imported), not a claim that Google defines a four-tier universal standard. Rill is a single-owner workflow, so severity examples must refer to *the owner’s essential Codex/GitHub workflow* rather than Google's large-user percentages.


GitHub **Labels** are native/queryable on a personal repository. GitHub's more strongly typed Issue fields can represent priorities, but currently belong to organizations and are created by organization owners; they should not be assumed for Rill's personal repository. GitHub Projects custom fields are not required and cannot be treated as the only choice. [LABEL][FIELD]

Rill can use four mutually exclusive Issue labels: `priority:P0`, `priority:P1`, `priority:P2`, `priority:P3`. A label is **data**, not proof of authorization or automatic enforcement. An active work item needs an owner-approved single priority; an intake item without a priority remains untriaged. Agent behavior is restricted to collecting observable impact/workaround evidence, repeating owner-assigned values and flagging missing/conflicting labels. **Agent inference must never create, raise, lower or default the priority.** P0/P1 enter the active delivery queue; P2/P3 are deferred by default unless the owner selects them. Mechanical safety checks still apply to any work that is actually authorized.

## 6. Anthropic's `claude.dev` source identity

`claude.dev` states it is a site **operated by Anthropic, PBC**. It is an official Anthropic engineering blog featuring explanations and practices, including the 2026-10-15 review article and 2026-10-08 automation article. Its own terms warn content can be outdated or incomplete and to test code before relying on it. [ANTHROPIC-TERMS][CR][AUTOMATION]

For Rill, treat `claude.dev` as **first-party engineering insight**, not as the normative OpenAI/Codex API or a contract for Claude Code interfaces. Prefer OpenAI primary docs for Codex behavior, GitHub docs for GitHub behavior, and actual tool-maintainer documentation for tool semantics.

## Source register

- [TS7] Microsoft TypeScript Team, [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), **2026-07-08**.
- [CS] OpenAI, [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk): published TypeScript and Python interfaces and supported prerequisites.
- [PLATFORM] OpenAI, [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform), **2026-08-19**: `codex exec`, SDK, app-server and shared underlying harness.
- [CFG] OpenAI, [Advanced Configuration](https://learn.chatgpt.com/docs/config-file/config-advanced): trusted project config, hooks, native observability and scope.
- [OTEL] OpenAI, [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference): OTel exporter/configuration keys.
- [CR] Anthropic, [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/), **2026-10-15**.
- [LONG] Anthropic, [Effective harnesses for long-running agents](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents), compaction and recovery evidence.
- [GOOGLE] Google, [Issue Tracker — Issue priority](https://developers.google.com/issue-tracker/concepts/issues): documented P0–P4 **common** rubric.
- [LABEL] GitHub, [Planning and tracking work / Labels](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project).
- [FIELD] GitHub, [Managing issue fields in your organization](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization).
- [ANTHROPIC-TERMS] Anthropic, [claude.dev terms](https://claude.dev/terms/), last updated **2026-09-18**.

- [AUTOMATION] Anthropic, [Building effective agent automations](https://claude.dev/blog/building-effective-agent-automations/), **2026-10-08**.
- [OBS] OpenTelemetry maintainers, [Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/): traces, metrics and logs.

[TS7]: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
[CS]: https://learn.chatgpt.com/docs/codex-sdk
[PLATFORM]: https://developers.openai.com/blog/codex-as-a-platform
[CFG]: https://learn.chatgpt.com/docs/config-file/config-advanced
[OTEL]: https://learn.chatgpt.com/docs/config-file/config-reference
[CR]: https://claude.dev/blog/solving-code-review-at-anthropic/
[LONG]: https://www.anthropic.com/research/effective-harnesses-for-long-running-agents
[GOOGLE]: https://developers.google.com/issue-tracker/concepts/issues
[LABEL]: https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project
[FIELD]: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization
[ANTHROPIC-TERMS]: https://claude.dev/terms/
[AUTOMATION]: https://claude.dev/blog/building-effective-agent-automations/
[OBS]: https://opentelemetry.io/docs/concepts/observability-primer/
