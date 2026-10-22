# Rill — complete Codex-native build and acceptance plan

State captured: **2026-10-22**, local branch `chatgpt/rill-native-foundation-20261022`. This file is the **single executable rebuild plan**, not a second kernel or an Agent-managed state machine. **Source of authority:** [kernel](docs/policy.md) > this plan; operational commands live in [the native engineering loop](docs/engineering-loop.md), and official capability evidence lives in [the capability map](docs/capability-map.md) and [upstream source register](docs/rebuild/engineering-policy-sources.md).

## 1. Fixed result and decision hierarchy

**Delivery:** a **single-owner macOS Codex App + GitHub development workflow**. Official Codex executes and reviews in the owner's real workspace; Matt Pocock skills supply engineering method; official GitHub Issues/relations/PRs hold delivery state. Existing tools do deterministic tasks. The owner selects product decisions and authorizes operations, not routine formatting, parsing, tool coordination or redundant status entry.

**Non-negotiable kernel precedence:** official upstream/native features outrank any project fact. Remove an unsupported legacy requirement rather than implementing a compatibility layer, second harness, synthetic check engine, duplicate GitHub object store or cross-platform migration. A plan row, log line, skill description or model opinion is **not** evidence that a gate ran. The kernel can change only through the owner's explicit instruction.

**Locked first-party code stack:** TypeScript **7.0.2 strict only**, Node.js **24 LTS**, pnpm **12.14.0**. No Rill Python, Go, Rust or Shell implementation; built-in POSIX command invocations and third-party native executables are allowed. Codex App configuration, Markdown, `AGENTS.md` and supported Skills stay in their upstream-native formats. No SDK wrapper where an official App operation suffices.

**One writer per file format:** `.editorconfig` baseline and **Biome 2.6.2 for TS/JSON/CSS/Markdown**. Prettier is **not** part of Rill. Markdownlint remains a complementary checker, not a second formatter. Fixes only through `just fmt`; all check and Git hook commands must be non-writing.

**Priority source:** Google's documented P0–P4 definitions and P2 default **exactly as published**. Only the owner authorizes a priority attached to a real GitHub Issue; the Agent may gather facts and read/validate labels but may not assign, infer or default. Google's P2 default is not a license to tag unknown GitHub work. Local technical phases below express **dependencies and acceptance**, not issue priorities.

### Owner-specific operating baseline

Apply kernel sections 2.1-2.7 throughout this plan: part-time owner without development experience; exceptionally low tolerance for routine coordination and maintenance; GitHub Free, predominantly private repositories; paid upgrades declined; native choices only for essential missing information or high-risk authorization. Every idea receives requirements review, audit, cleaning, distillation and proportionate alternative exploration before entering the spec. Confirmed decisions are preserved; pollution and model guesses are not promoted.

Use short vertical slices: audit/distill -> implement/test -> separate-agent review -> deliver/recover. The phases below are dependencies and evidence categories, **not sequential owner-approval meetings**. Existing authorization carries across ordinary reversible work. No human team, remote CI/CD, private-repository branch protection or ruleset is a required dependency. Local checks and native reviewer results provide inspectable evidence, not unavailable server enforcement.

Real native multi-agent execution is required for substantive review, with a primary and at most two active delegated agents by default. Budget the whole team within the reported five-hour allowance, keep a single writer per shared file/index scope, and preserve capacity for gates, review, correction and handoff. Use standard roles and upstream repository conventions, not invented names or a custom scheduler. Product UI quality, recoverability and future maintenance are acceptance dimensions; future ideas do not enlarge current scope automatically.

## 2. Architecture — direct native boundaries

| Layer                   | Upstream owner                  | Rill artifact or interface                                                                         | Never build                                                                |
| ----------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Human/product authority | Owner + kernel                  | `docs/policy.md`, authorization decision                                                           | Alternative project facts treated as immutable                             |
| Host and permissions    | OpenAI Codex App                | Primary macOS project, discovered `AGENTS.md`, native skills, permitted tools, native review       | Replacement Agent runner, App bridge, or unsupported hook emulation        |
| Engineering judgment    | Agent + Matt Pocock skills      | Research → spec → test/implementation → bug diagnosis → code review                                | Agent grading schema/compile results or ranking GitHub issue priorities    |
| Local execution/quality | Tool maintainers + Just         | `justfile`, lockfile, official CLI configuration, Husky native Git events                          | Custom formatter, compiler, unit framework or multi-language tool daemon   |
| Delivery record         | GitHub                          | Native Issue/spec, parent/sub-issue/dependency edges, PR, HEAD SHA, checks/reviews                 | Second task tracker, shadow PR status, GitHub Projects prerequisite        |
| Evidence and recovery   | Codex tool results + Git/GitHub | Durable commits/PR/Issue comments when authorized; bounded digest plus original tool log reference | Endless tool trajectory in model context or a homemade checkpoint database |

Only the layer owning a contract can verify it. An official CLI flag is not proof of Codex App mode behavior; a local `just gate` is not GitHub branch protection; a model's narrative is not a test.

## 3. Native quality gates — selected, not optional shopping

The installed tools and exact accepted commands are defined in [engineering-loop.md](docs/engineering-loop.md) and executed by **`justfile`**.

| Event / trigger                | Command                                                | Required verified decision                                                                                                          |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Initial local environment      | `just doctor`, `pnpm install --frozen-lockfile`        | Required versions present; project lock unchanged; missing binary is blocking.                                                      |
| Deliberate mechanical repair   | `just fmt`                                             | Biome only; second pass yields zero changes; source owner research remains byte-identical.                                          |
| Fast developer loop            | `just check`                                           | Justfile format, Biome, Markdownlint, TypeScript, Vitest, Knip, Tokei 500 LOC, Lizard CCN 15, offline Lychee.                       |
| Native Git pre-commit          | `just precommit`                                       | Read-only lint-staged and native Gitleaks `git --staged`; malformed staged content blocks; partial staging preserved.               |
| Native Git pre-push            | `just gate`                                            | Fast checks with Vitest **coverage** + Knip + LOC/CCN + local links + Gitleaks history + Trivy with native DB refresh + pnpm audit. |
| Online information maintenance | `just links-online`, `just security-db-update`         | Explicit network-dependent action; do not silently treat a timed-out fetch or stale vulnerability DB as fresh evidence.             |
| Review evidence                | `just report`, native `git diff` and GitHub PR objects | Same tested/reviewed revision SHA, nonzero failures visible, raw report recoverable on demand.                                      |

**Hard thresholds:** TypeScript strict diagnostics; **500 source-code LOC maximum per TypeScript file** as counted by upstream Tokei (501 fails); **CCN 15 maximum** from upstream Lizard (16 fails); Vitest/V8 **80% statements, 80% branches, 85% functions, 80% lines**. Measure the maintained LOC helper plus future `src/**/*.ts`; the exact current include scope is in `vitest.config.ts`. Coverage of that helper is meaningful workflow evidence, not a claim that every executable or future product is covered. Trivy blocks **HIGH/CRITICAL** native advisory/misconfiguration findings; pnpm audit blocks **MODERATE+**. Gitleaks findings block and are redacted. Knip unused findings and Lychee broken **local** links block.

**Security boundaries:** `trivy fs` must include development dependencies; its current scan finds a pnpm lockfile but **no applicable infrastructure configuration files**. The full pre-push run allows native Trivy DB refresh and **fails** if required network refresh cannot complete. `just security-offline` is cache-only diagnostic evidence, not a fresh security sign-off. Current npm audit discloses one LOW indirect KaTeX finding and zero MODERATE/HIGH/CRITICAL findings; do not report “zero vulnerabilities.”

**Single-purpose non-handmade adapters:** `tools/check-markdown.ts` delegates all rules to published markdownlint; `tools/check-metrics.ts` delegates counts to Tokei and enforces the owner's numeric limit. They are TypeScript-only entry points, not analyzers, Agent tools, orchestrators or replacement engines. Knip ignores only the documented `@types/markdown-it` external declaration dependency and the global `just`/`tokei` binaries. Markdownlint MD032 is disabled only because the installed Biome formatter's canonical blank-line style conflicts; it is not a general lint bypass.

## 4. Execution phases (dependency-ordered, with stop conditions)

Phases are **implementation sequence** and contain no Agent-selected P0/P1 severity. Remote writes, global configuration changes and owner-specific product decisions remain subject to their normal authorization boundary.

### Phase 0 — Fix one project authority and facts

**State: VERIFIED LOCALLY.** Inputs are the owner-confirmed kernel, Rill capability map and first-party source research, not any former project architecture. Preserve a single `docs/policy.md` as authority; `AGENTS.md` must link it and route to the current map/plan/gates. No duplicate policy JSON/YAML.

**Acceptance:** all internal relative links resolve; published references are attributed to their vendor; conflicts with official Codex/GitHub are deleted or recorded as unsupported, never papered over. Real App instruction discovery remains a Phase 3 acceptance, not assumed here.

### Phase 1 — Lock native runtime and tools

**State: VERIFIED LOCALLY.** Use TypeScript 7.0.2, Node24, pnpm 12.14; project-local exact npm devDependencies and reproducible lockfile; `.editorconfig`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, native `justfile`, Husky and lint-staged. Host already contains the six external executables (see `just doctor`); no global installation or personal configuration was performed by this phase.

**Acceptance:** `pnpm install --frozen-lockfile` leaves the lockfile intact; `just --fmt --check` passes; `just fmt` runs twice without further diff on the second execution; Prettier and multiple format writers are absent; TypeScript emits no code during checking.

**Failure:** missing or changed tool is reported as blocked. Do not install a new language, shims or compatibility scripts to make a fabricated green check.

### Phase 2 — Deliver all mechanical quality gates with real failures

**State: VERIFIED LOCALLY FOR CURRENT REPO.** `just check` and `just gate` execute the matrix in §3, including the requested **Gitleaks, Lychee, Lizard, Trivy, Just and Knip**, plus TypeScript/Vitest/Ajv/Biome/Markdownlint/Tokei/pnpm audit.

**Acceptance tests already observed:** real positive checks; injected wrong TS type; bad Biome format; Markdownlint MD012; Knip unused source; 501 LOC; complexity above CCN15; nonexistent relative link; staged synthetic fake secret; Dockerfile HIGH misconfiguration; uncovered production TS source below 80/80/85/80 V8 thresholds. Each erroneous input returned nonzero from its **upstream tool** and was deleted after inspection.

**Git-event acceptance already observed:** isolated Git `pre-commit` with partial staging (valid index, invalid unstaged work), failed staged checks with unchanged HEAD/index, and local bare-remote `pre-push --dry-run` rejecting invalid/accepting valid content. **Rill's current Git branch was not used as the disposable test repository.** A server-side policy is not claimed.

**Remaining acceptance:** candidate-specific behavior tests and review are tracked in issue #3; actual Codex App hook/tool invocation and recovery are tracked in issue #4. Security evidence is time-specific, not a continuing DB freshness guarantee. Paid private-repository branch restrictions are out of scope.

### Phase 3 — Validate native Codex interaction, subagents and budget controls

**State: NATIVE CLI ROLE WORKFLOW VERIFIED; MACOS APP ACCEPTANCE OPEN. Dependency: Phases 0-2.** Select the Rill primary project and read the kernel through `AGENTS.md`. The [development workflow](.agents/skills/development-workflow/SKILL.md) proactively selects dedicated native `planner`, `worker` and non-author `reviewer` profiles, with optional `explorer` for a bounded unresolved question. Standalone `.codex/agents/*.toml` files define responsibilities, model/effort and quiet result contracts. The owner's requested per-role model tuning is explicit; the parent model, provider, service tier and global settings remain user-selected.

The [native config](.codex/config.toml) sets `agents.max_concurrent_threads_per_session = 2`. Native `config/read` confirmed the enabled project layer and configured limit on macOS CLI 0.163.0. Actual rejection of excess concurrent work and App UI enforcement remain unverified. V2 can unload eligible completed residents for a distinct subsequent reviewer; do not invent a close tool. An ordinary CLI task has completed design, implementation, correction of a real review finding and candidate-matched review. Role identity, model/effort, quiet child output and final delivery evidence are tracked in [#6](https://github.com/hughzadora/Rill/issues/6). A configuration value or read-only assignment alone is not proof of enforcement.

**Acceptance:** exercise a native selection prompt when an actual essential non-derivable choice arises. If this increment has no such choice, retain `available, not exercised`; do not manufacture a question merely to satisfy a checklist. On a bounded real task, observe distinct native thread IDs, scope/revision assignments, worker output and separate review results. At least one reviewer must inspect the candidate independently of its author, with reproducible findings rather than simulated test results. Read the available native usage/reset indicator without assuming a particular plan or remaining allowance; record unavailable telemetry honestly. Return a compact digest and a raw-evidence reference, not all child transcripts.

**Failure:** hold only capabilities dependent on unavailable native UI/delegation or protected permissions; continue safe independent work. Do not imitate independent review in the main conversation, create a custom host, upgrade the subscription or move to paid API billing. This policy/document update alone does not satisfy these runtime checks.

### Phase 4 — Deliver through GitHub Free private-repository objects

**State: PARTIAL; REAL ISSUE RELATIONS READ BACK, CANDIDATE DELIVERY IN PROGRESS. Dependency: Phase 0 and relevant Phase 3 capabilities.** The owner's 2026-10-22 approval authorizes this delivery increment. [Issue #2](https://github.com/hughzadora/Rill/issues/2) owns the outcome; #3 and #4 are actual sub-issues, and #4 is blocked by #3. Remote branch/PR evidence is recorded against the final candidate, with no merge implied. Use ordinary private-repository Issues, real relationships, branches, commits and PRs. Read back the correct repository, Issue/spec and candidate SHA. Apply owner-assigned Google P0-P4 priority only when available; an untriaged backlog item is not permission to invent priority or interrupt every already-approved engineering subtask.

**Acceptance:** a real Issue/PR records the distilled outcome, acceptance, exact tested candidate and separate native-agent review evidence. Native Issue relations and PR linkage are read back rather than inferred from body text. Keep local `just gate` and review outcomes attached to the revision through existing authorized GitHub objects. A reviewer operating under the same account is not a third-party human approval; no artificial approval identity is created.

**Not applicable to this baseline:** private-repository branch protection, rulesets, required human review teams and mandatory remote CI/CD. They are not unfinished deliverables, upgrade requests or justifications for a substitute enforcement service. A local hook can be bypassed; document that limit. Reuse task-scoped remote authorization, ask only when the intended action exceeds it, and do not publish or merge merely because this plan exists.

### Phase 5 — Prove the task's implementation and test behavior

**State: LOC BEHAVIOR VERIFIED; FINAL CANDIDATE GATE/REVIEW RECORDED IN DELIVERY PR.** The existing `just loc` helper is the real consumer: malformed Tokei data must fail closed. Its executable TypeScript and behavior tests can establish this slice without inventing a product application or a `src` directory. Agent first reviews/audits and distills the raw input under kernel section 2.2, resolves factual/design questions with tools, creates a single spec on the authorized GitHub Issue, and then selects the simplest native Codex implementation path. Write TypeScript source only when a real consumer exists. Matt `research`, `domain-modeling`, `prototype`, `tdd`, `diagnosing-bugs` and `code-review` are methods where appropriate, not mandatory ceremony.

**Acceptance:** a real failing behavior test first; minimal TypeScript implementation; negative/boundary cases; no first-party Python/Shell glue; `just gate` green at the changed SHA with non-empty meaningful coverage; unchanged source on second `just fmt`; Knip and CCN/LOC rules apply to actual added files; a separate native reviewer thread confirms the Issue's observable acceptance independently of the implementing thread and mechanical tools. For user-facing work, inspect the rendered flow, accessibility, feedback and recovery; test maintainability and keep future extension boundaries minimal.

**Stop:** no passing test suite is enough if the task spec cannot be exercised. Tests must exercise maintained executable behavior, including real repository tools where they are the consumer. Nonempty helper coverage proves only that helper's measured scope; it does not prove every tool, future product behavior or App end-to-end delivery.

### Phase 6 — Review, diagnose and resume under interruptions

**State: NOT YET VERIFIED. Dependency: Phases 3-5.** In official Codex App + native Git/GitHub, repeat two edits, two check runs, and a review of the **same candidate revision**. Validate bad configuration, unavailable CLI, wrong working directory, cached/failed network scan, partially staged work and mid-task interruption. Carry only a bounded result digest into the model; keep full raw evidence available through tool logs/native artifacts and commit/Issue/PR state.

**Acceptance:** interrupted work resumes from real Git/Issue/PR state without owner retyping; mechanical retries occur only for proven safe transient/idempotent commands; ambiguous writes are not blindly retried; reviewer checks actual changed files and tested HEAD rather than outdated snapshots. Use observable allowance, elapsed time, review findings and avoided rework for comparison; a smaller digest alone does not prove a billing saving. Stop discretionary scope before the review/handoff reserve is consumed, avoid repeated polling/research, and report unknown usage rather than inventing a quota balance.

**Stop:** if the native host cannot provide a guaranteed boundary, revise the requirement under the kernel; do not build an independent Rill harness or checkpoint server.

### Phase 7 — Owner macOS end-to-end delivery and maintenance

**State: NOT YET VERIFIED. Dependency: Phases 0-6.** Owner performs only authorization/product judgment while Codex performs a real Issue-driven development task through tests, native Git PR/review and recovery. A complete delivered result references correct upstream source, Issue/PR/commit IDs and true check outcomes.

**Acceptance:** one realistic workflow succeeds on the owner's macOS; deliberate regression is stopped by the correct native tool; non-mechanical design/review is justified by inspectable facts; no repeated owner-assisted routine formatting or manual Agent tool reminders; local gate evidence and separate native-agent review results reference the delivered SHA in authorized native GitHub records; no unavailable paid server restriction is required. Documentation describes only commands actually verified.

**Not part of foundation:** mandatory browser E2E before a browser UI exists, network contract fixtures before an HTTP interface exists, mutation testing without real production code/tests, dashboard infrastructure without multi-suite reporting, or custom multi-Agent orchestration. Use official Playwright, MSW/Zod, Stryker or Allure **only when their corresponding observed need arises**.

## 5. Responsibilities, acceptance evidence and resumption

- **Owner:** initial intent and exceptional material/high-risk authorization through native controls. Existing task permissions carry through ordinary execution; no routine team review, command coordination, repeated approvals or payment/upgrade requests.
- **Agent:** audit/clean/distill input; investigate facts; decide routine engineering within scope; coordinate real native worker/reviewer threads; monitor observable budget; preserve product quality, repository hygiene and maintainability. Never self-assign priority, impersonate another agent or turn unknown into passed.
- **Tools:** actual file changes, formatting, type diagnostics, tests, schema, security, unused code, links, LOC/complexity and Git/GitHub readback. Their exit status and diagnosed inputs are the evidence; all check commands are fail-closed on nonzero.

- **Record format:** one decision-relevant digest containing exact command/input scope, exit status, relevant failing rule, changed file list, HEAD/PR SHA, and raw-log pointer. Native Issues/PR/commits carry durable execution state **after authorization**. No parallel orchestration-state file.
- **Reproduction:** run `just doctor` → `pnpm install --frozen-lockfile` → `just check` → `just gate`; explicitly distinguish read-only checks from `just fmt`; Trivy and pnpm audit can require network, and remote URL probing remains a separate optional diagnostic.
- **Current evidence:** Phases 0-2 have run locally. Distinct hosted agents, native macOS CLI role execution and GitHub issue relationships have been observed. The ordinary task in #6 verified configured planner/worker/reviewer models and efforts, quiet child result packets and candidate-matched review. Native `account/rateLimits/read` also returned actual account windows and reset times. Candidate-specific checks/review belong in the delivery PRs under issue #2. Mac App discovery, action execution, selector rendering, usage UI and recovery remain open in issue #4; CLI/API evidence does not substitute for that surface.

## 6. Definition of done for Rill

A Rill release is done only when **Phases 3-7 acceptance** is observed on the official App, a real owner-authorized Issue/PR and the owner's macOS, with nonempty behavior tests tied to the spec and `just gate` current for the same SHA. A passing local toolchain without production work is **foundation delivery**, not completed Rill.

No remote push/PR/merge or owner-global setting change is authorized by this document. Do not close an Issue on a model claim, a local green check, a link to a PR, or a stale prior review. For further official details use [OpenAI Codex](https://learn.chatgpt.com/docs/projects?surface=app), [GitHub native issue relations](https://cli.github.com/manual/gh_issue_edit), [Biome Markdown](https://biomejs.dev/internals/changelog/version/2-6-2/), [Just](https://just.systems/man/en/) and the [source register](docs/rebuild/foundation-inputs.md).
