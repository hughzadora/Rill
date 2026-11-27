---
id: REQ-003
title: ADLC Engineering & Execution Manual (Legacy Correction)
status: deprecated
superseded_by: SPEC-002
last_updated: 2026-11-27
related_code:
  - docs/01-specs/ADLC_MASTER.md
---

# ADLC Engineering & Execution Manual

## Native GitHub + Isolated Worktree + Heavy Local Compute Verification

- **Status**: Active Development Realignment (Supersedes legacy custom state-machines / Rill orchestration)
- **Architecture**: Full-Stack TypeScript (`tsrs` + `Oxc` + `Bun` + `mise` + `GitHub CLI`)
- **Core Philosophy**: **Minimize Agents, Maximize Deterministic Local Compute.**
  - **No custom workflow engine or state DB**: GitHub Issues/PRs own state and acceptance contracts; Git Worktrees own workspace isolation.
  - **Single Worker Agent**: One primary Codex Harness agent executes end-to-end. Do not spawn multi-agent swarms or role chains; only spawn **one read-only Reviewer session** right before PR creation.
  - **Brute-Force Local Verification**: Offload anti-cheating, AST inspection, branch coverage, mutation testing, concurrency stress, and real container E2E to local CPU/GPU/Docker via `mise`.

---

## 0. Immediate Realignment Protocol (Execute First on In-Flight Repos)

**If you are resuming a repository that is already under active development, halt new feature coding and execute this corrective sequence immediately:**

1. **Freeze Primary Root**: Do not write code in the main checkout directory or on an untracked/dirty branch.
2. **Audit & Bind to GitHub Issue**:
   - Inspect `git status --short`, `git worktree list`, and `gh issue list --state open`.
   - Every piece of in-progress work must map to a structured **GitHub Issue** (Section 4). If none exists for your current task, stop coding and create it via `gh issue create` first.
3. **Evacuate Active Work into an Isolated Worktree**:
   - Create a dedicated worktree outside the main repo folder:
     ```bash
     git worktree add ../wt-<issue-id> -b feat/<issue-id>-<slug> main
     ```
   - Move uncommitted changes to `../wt-<issue-id>`, reset the primary root to clean `main`, and lock `PROJECT_ROOT` to `../wt-<issue-id>`.
4. **Purge Anti-Patterns & Wire Local Compute Gates**:
   - Audit existing `git diff` for patch-style cheating: hardcoded test literals in `src/`, `as any`, `as unknown as`, `@ts-ignore`, empty `catch`, `setTimeout` race-condition hacks, or mocked backend responses.
   - Ensure `mise.toml` implements the 3-Tier Local Compute Pipeline (Section 2 & Section 5).

---

## 1. End-to-End ADLC Pipeline (13-Stage Loop)

Every increment follows two strict phases. Do not skip stages.

```text
[1. Intent] ─▶ [2. Explore & Research] ─▶ [3. Brainstorm & Design] ─▶ [4. GitHub Issue]
                                                                             │
┌────────────────────────────────────────────────────────────────────────────┘
▼
[5. Isolated Worktree] ─▶ [6. Vertical Slice] ─▶ [7. Fast Local Checks] ─▶ [8. Full Verification]
                                                                                   │
┌──────────────────────────────────────────────────────────────────────────────────┘
▼
[9. Independent Review] ─▶ [10. Clean & Update] ─▶ [11. PR & CI] ─▶ [12. Release] ─▶ [13. Iterate]
```

### Phase A: Discovery & Convergence (Read-Only on Codebase)

- **1. Intent**: Clarify user goal, constraints, and non-goals. Ask one concise question only if business intent is missing.
- **2. Explore & Research**: Read existing code, schemas, and git history (`rg`, `git log`). **Zero file mutations.**
- **3. Brainstorm & Design**: Define data contracts (Zod/OpenAPI/DB schema), layer boundaries, and failure modes. Select required heavy verification profiles.
- **4. GitHub Issue**: Persist the design and verifiable acceptance criteria as a GitHub Issue (Section 4) labeled `ready`. This Issue is the sole task contract.

### Phase B: Isolated Delivery (Executed Inside `../wt-<issue-id>`)

- **5. Isolated Worktree**: Create `../wt-<issue-id>` branched from `main`. All file edits, installs, and container tests happen here.
- **6. Vertical Slice**: Build a complete, observable slice across `schemas -> domain -> adapters -> ui/api`. Write requirement-derived tests in `tests/behavior`. **No fake stubs or hardcoded JSON.**
- **7. Fast Local Checks (`Tier 1`)**: Run `mise run check-fast` after every edit batch (< 500ms).
- **8. Full Verification (`Tier 2 + Tier 3`)**: Run `mise run verify` and `mise run qualify` using local CPU/GPU/Docker heavy checks before requesting review.
- **9. Independent Review**: Spawn **one separate read-only session** (fresh context) to audit `git diff` against `gh issue view <id>` using Section 3.
- **10. Clean & Update**: Fix review findings, run `knip` to purge dead code, update `docs/` if behavior changed, format with `oxfmt`, and re-run `mise run verify`.
- **11. PR & CI**: Push branch, open PR via `gh pr create` (`Closes #<id>`), and pass the GitHub Actions `acceptance` aggregate gate.
- **12. Release**: Execute authorized release/deployment workflow and verify live/packaged artifact health.
- **13. Iterate**: Remove merged worktree (`git worktree remove ../wt-<issue-id>`) and return to Stage 1 for the next slice.

---

## 2. Anti-Cheating & Heavy Local Compute Pipeline

Because local hardware resources are abundant, **never rely on trust or LLM self-policing**. Enforce mechanical verification across three compute tiers:

### Tier 1: Sub-Second Static & AST Guardrails (`mise run check-fast`)

Run on every file write / edit cycle:

1. **Sole Type Authority (`tsrs`)**: `TSRS_FAST=0 tsrs --noEmit -p tsconfig.json`. Strictly zero type errors.
2. **Strict Linting (`oxlint --type-aware --deny-warnings`)**:
   - Hard-bans `any`, `@ts-ignore`, `@ts-expect-error`, unsafe type assertions, floating promises, empty `catch`, focused/skipped tests (`.only`/`.skip`), and cyclomatic complexity > 10 (prevents nested `if (input === 'test')` patch trees).
3. **Formatting (`oxfmt`)**: Single authoritative formatter (`oxfmt --check --disable-nested-config .`).
4. **AST Hardcode Cross-Check (`oxc-parser` script)**:
   - Parses `tests/` and `src/` ASTs. Fails immediately if string/numeric literals from test fixtures appear hardcoded inside `src/` business logic.
5. **Local GPU Guardrail (Optional Hook)**:
   - If local vLLM/Ollama (`Qwen2.5-Coder-7B/14B`) is running, pipe `git diff` on file write for instant binary classification (`PATCH_OR_WORKAROUND: YES/NO`) to reject lazy edits at zero cloud token cost.

### Tier 2: Architecture, Type Lineage & Diff Branch Coverage (`mise run verify:static`)

Run before declaring a vertical slice complete:

1. **Unidirectional Architecture (`dependency-cruiser`)**:
   - Enforces `UI -> Application -> Domain <- Adapters`. `src/domain/**` must have zero imports from `adapters`, `ui`, `process.env`, filesystem, network, or DB SDKs.
2. **Dead Code & Ghost Dependency Purge (`knip`)**:
   - Fails on any unreferenced files, unused exports (e.g., `handleSubmitV2` patch clones), or unlisted dependencies.
3. **Type Lineage Audit (`ts-morph`)**:
   - Fails if `as unknown as` double-assertions are used to spoof return shapes between DB adapters and API responses.
4. **100% Diff Branch Coverage (`NODE_V8_COVERAGE`)**:
   - Computes branch coverage specifically over lines added/modified in `git diff`. Every new `if/else` or ternary branch must execute **both `true` and `false` paths** during behavior tests (exposes hidden backdoor branches).

### Tier 3: Heavy Dynamic Compute & Full-Stack Truth (`mise run verify:heavy` & `qualify`)

Run on local multi-core CPU / Docker before Independent Review:

1. **Property-Based Testing (`fast-check`)**:
   - Mandatory for domain algorithms, parsers, validators, and state transitions. Generates hundreds of random boundary/unicode/malformed inputs to defeat sample-specific fitting.
2. **Mutation Testing (`StrykerJS`)**:
   - Runs `bun run test:mutation` against modified `src/domain/**` files. Automatically mutates operators (`===` to `!==`, `&&` to `||`, emptying arrays) across parallel local workers. **Mutation score threshold: 100% on critical domain logic** (surviving mutants prove weak assertions or dead patch code).
3. **Real Containerized Stack + Trace Assertion (`Testcontainers` + `OpenTelemetry/Jaeger`)**:
   - Spins up real PostgreSQL/Redis containers locally.
   - Integration tests assert both **real database row mutations** and **OpenTelemetry span traces** (`Controller -> Service -> Repository -> DB`), catching controllers that short-circuit and return fake `{ success: true }` responses.
4. **Real Browser E2E + Network Audit (`Playwright`)**:
   - Runs parallel headless browsers against the built full-stack app. Mounts `page.on('request')` listeners to verify the UI actually sends real HTTP requests to the backend and receives 2xx responses (prevents frontend mock-state cheating).
5. **Concurrency & Fuzzing (`k6` / `Jazzer.js`)**:
   - Runs local `k6` parallel bursts (50+ VUs) against stateful endpoints to catch global-variable caches or `setTimeout` hacks.
   - Uses coverage-guided fuzzing (`Jazzer.js`) on complex parsers/inputs to break hidden conditional branches.
6. **Negative Rule Qualification (`mise run qualify`)**:
   - Runs in an isolated disposable copy, injecting deliberate type errors, `any` casts, domain->adapter imports, and hardcoded literals to prove the toolchain actually fails with expected diagnostics.

---

## 3. Single Independent Review Checklist (Stage 9)

Instead of complex multi-agent orchestration, spawn **one read-only Reviewer session** with a clean context window. The Reviewer inspects `gh issue view <id>` and `git diff` and must reject the candidate if any check fails:

- [ ] **Contract Fidelity**: Does the implementation satisfy every happy-path, invalid-input, and invariant oracle in the GitHub Issue?
- [ ] **Zero Sample Fitting**: Are `src/` modules completely free of test-specific literals, magic numbers, or special-case `if` branches?
      Use code with caution.
      • Zero Oracle Weakening: Were existing tests, schemas (zod/OpenAPI), or linter rules deleted, skipped, or loosened (toBeDefined())?
      • End-to-End Data Truth: Do API handlers persist to real DB tables and do UI components consume real API responses?
      • Minimal Coherent Footprint: Did knip pass, and does every new module/abstraction have a real production consumer?

4. Standardized GitHub Issue Template (Stage 4 Output)

All Brainstorm & Design work must produce a GitHub Issue in this exact format:

```markdown
1. User Outcome & Boundaries

• User Outcome:
• Out of Scope:

2. Architecture & Contract Changes

• Impacted Layers: <e.g., src/schemas, src/domain, src/adapters/db, src/ui>
• Contract / Schema: <Exact Zod/OpenAPI/DB schema changes; no unapproved weakening>
• Domain Invariants:

3. Verifiable Acceptance Oracles

• Happy Path: <Given initial state X, action Y produces observable output Z and DB state W>
• Failure / Invalid Input: <Malformed payload, unauthorized actor, or conflict returns exact error without corrupting state>
• Regression Invariants:

4. Activated Local Compute Gates

• mise run check-fast (oxfmt + oxlint + tsrs + AST hardcode check)
• mise run verify (depcruise + knip + V8 diff-branch coverage + fast-check + Testcontainers + Playwright)
• mise run verify:heavy (StrykerJS mutation + k6 concurrency + Jazzer.js fuzzing, when triggered)
• mise run qualify (Negative fixture validation)
```

5. Canonical mise.toml Task Contract

Bind all local tools to these exact task names so the primary Agent and CI share one execution interface:

````toml
[env]
TSRS_FAST = "0"
[tasks."format"]
run = "oxfmt --write --disable-nested-config ."
[tasks."format-check"]
run = "oxfmt --check --disable-nested-config ."
[tasks."lint"]
run = "oxlint --type-aware --deny-warnings src tests"
[tasks."typecheck"]
run = "tsrs --noEmit -p tsconfig.json"
[tasks."ast-anti-cheat"]
run = "bun run scripts/check-ast-hardcode.ts"
[tasks."check-fast"]
depends = ["format-check", "lint", "typecheck", "ast-anti-cheat"]
[tasks."arch"]
run = "bun run depcruise --config .dependency-cruiser.cjs --output-type err-long src"
[tasks."deadcode"]
run = "knip"
[tasks."test:behavior"]
run = "NODE_V8_COVERAGE=.coverage bun test tests/behavior && bun run scripts/check-diff-coverage.ts"
[tasks."test:contracts"]
run = "bun test tests/tooling/contracts"
[tasks."test:integration"]
run = "bun test tests/integration" # Testcontainers + OpenTelemetry trace assertions
[tasks."test:e2e"]
run = "bunx playwright test" # Real browser + network request audit


直接给我一个完整的md文档,方便我复制和让agent来纠偏,因为当前已经进入开发了
然后加上前面我想要的,请你多多思考思考,然后方案尽量减少agent二次思考摩擦的可能

为了彻底消除 Agent 在执行过程中的“二次思考摩擦”（即反复猜路径、纠结工具选择、自创状态流、或用打补丁/硬编码绕过测试），下面这份文档设计成了一套“确定性命令驱动 + 零歧义状态机 + 强硬本地算力门禁”的完整规范。
你可以直接全选复制以下内容，覆盖保存为仓库根目录的 AGENTS.md（或 docs/ADLC_MASTER.md 并在 AGENTS.md 中直接引用）。
markdown
# ADLC Execution & Realignment Protocol (Zero-Friction Edition)

> **SYSTEM DIRECTIVE FOR CODEX HARNESS**:
> Read this file as your **sole operational authority**. Do NOT invent custom task schedulers, state files, or workarounds. Every state transition is owned by **GitHub Issues / PRs**, every workspace is isolated via **Git Worktree**, and every quality gate is executed deterministically via **`mise` + local heavy compute (`tsrs` / `Oxc` / `Knip` / `StrykerJS` / `fast-check` / `Testcontainers` / `Playwright`)**.

---

## 0. IN-FLIGHT REALIGNMENT PROTOCOL (EXECUTE THIS FIRST)

**If the repository is already mid-development, execute Steps 0.1 → 0.5 sequentially BEFORE writing any new product code. Do not ask for permission to organize your own workspace.**

### Step 0.1: Freeze & Inspect Current Workspace
Run in bash:
```bash
git status --short
git branch --show-current
git worktree list
gh issue list --state open --limit 20
````

### Step 0.2: Anchor Current Work to a GitHub Issue

- **Rule**: No code exists without an owning GitHub Issue containing verifiable acceptance criteria.
- If the current work lacks an open GitHub Issue, **halt coding immediately**, synthesize the current task into **Section 4 (Issue Contract Template)**, and run:
  ```bash
  gh issue create --title "<feat|fix>: <concise outcome>" --body "<filled template>" --label "ready"
  ```
- Capture the resulting `<ISSUE_ID>`.

### Step 0.3: Migrate Dirty/In-Flight Changes into an Isolated Worktree

- **Rule**: Never develop directly in the primary repository root (`main`).
- Execute this exact migration sequence (replace `<ISSUE_ID>` and `<SLUG>`):
  ```bash
  # 1. Stash any uncommitted work in primary root
  git stash push -u -m "realign-issue-<ISSUE_ID>" || true

  # 2. Create isolated worktree off main
  git worktree add ../wt-<ISSUE_ID> -b feat/<ISSUE_ID>-<SLUG> main

  # 3. Enter worktree and pop stashed changes
  cd ../wt-<ISSUE_ID>
  git stash pop || true
  ```
- **Bind Context**: From this moment onward, treat `../wt-<ISSUE_ID>` as your sole `PROJECT_ROOT`.

### Step 0.4: Purge Any Existing Anti-Patterns ("Cheating" Audit)

Scan your current diff (`git diff`) and immediately eliminate:

1. Hardcoded test inputs/IDs/strings inside `src/` (sample fitting).
2. Type escapes (`as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`).
3. Swallowed errors (`catch {}`, empty `.catch(() => {})`, floating promises).
4. Fake full-stack stubs (in-memory mock arrays pretending to be DB persistence, or frontend mock responses bypassing real API endpoints).
5. Disabled or weakened tests (`.only`, `.skip`, `passWithNoTests`, or replacing concrete value assertions with `toBeDefined()`).

### Step 0.5: Wire Local Compute Gates

Verify `mise.toml`, `.oxlintrc.json`, `.dependency-cruiser.cjs`, and `stryker.config.json` match **Section 5**. Run `mise run check-fast` to confirm baseline health, then resume at **Stage 6 (Vertical Slice)**.

---

## 1. DETERMINISTIC 13-STAGE ADLC PIPELINE

Follow this exact flow. **Never skip a stage. Never combine Discovery (Phase A) and Implementation (Phase B) in the same turn.**

```text
[1. Intent] ──▶ [2. Explore & Research] ──▶ [3. Brainstorm & Design] ──▶ [4. GitHub Issue]
                                                                                 │
┌────────────────────────────────────────────────────────────────────────────────┘
▼
[5. Isolated Worktree] ──▶ [6. Vertical Slice] ──▶ [7. Fast Local Checks] ──▶ [8. Full Verification]
                                                                                       │
┌──────────────────────────────────────────────────────────────────────────────────────┘
▼
[9. Independent Review] ──▶ [10. Clean & Update] ──▶ [11. PR & CI] ──▶ [12. Release] ──▶ [13. Iterate]
```

### Phase A: Discovery & Convergence (Codebase is READ-ONLY)

| Stage                      | Trigger & Action                                                              | Hard Constraints (Zero Friction)                                                                                                         | Required Exit Artifact                       |
| :------------------------- | :---------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| **1. Intent**              | Clarify user outcome, target surface, and non-goals.                          | Ask **at most 1 concise question** if business intent is ambiguous. Never ask the user to pick packages, folder names, or test commands. | Clear 1-paragraph goal statement.            |
| **2. Explore & Research**  | Inspect codebase, DB schemas, dependencies, and docs (`rg`, `git log`, `gh`). | **ZERO file mutations allowed.** Map existing patterns so you reuse them instead of inventing parallel abstractions.                     | List of affected files & existing contracts. |
| **3. Brainstorm & Design** | Design data contracts (Zod/OpenAPI/DB), domain invariants, and failure modes. | Design **contracts first**. Identify which local heavy-compute gates apply (`fast-check`, `StrykerJS`, `Playwright`, `Testcontainers`).  | Concrete schema diff & test oracle list.     |
| **4. GitHub Issue**        | Persist the single source of truth via `gh issue create`.                     | Use **Section 4 Template** verbatim. Do not store task state in local markdown TODO files.                                               | `GitHub Issue #<id>` with label `ready`.     |

### Phase B: Isolated Delivery (Executed Strictly Inside `../wt-<id>`)

| Stage                     | Deterministic Execution Command / Action                                                                                                                                                                                   | Hard Constraints (Zero Friction)                                                                                                                                  | Mandatory Exit Gate                               |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **5. Isolated Worktree**  | `git worktree add ../wt-<id> -b feat/<id>-<slug> main && cd ../wt-<id>`                                                                                                                                                    | Verify `pwd` is `../wt-<id>` and `git status` is clean before coding.                                                                                             | Worktree bound to `<id>`.                         |
| **6. Vertical Slice**     | Implement end-to-end in strict order:<br>1. Shared Schema (`src/schemas`)<br>2. Pure Domain (`src/domain`)<br>3. Real Adapters (`src/adapters`)<br>4. UI/API Surface (`src/ui`)<br>5. Independent Tests (`tests/behavior`) | **No horizontal layering without vertical proof.** Build one complete working path first. Expected test values must NEVER be computed by calling production code. | Runnable vertical slice with real persistence/IO. |
| **7. Fast Local Checks**  | Run after **every** file edit batch:<br>`mise run check-fast`                                                                                                                                                              | Executes `oxfmt --check` + `oxlint --type-aware` + `tsrs` (`TSRS_FAST=0`). Fix diagnostics immediately; never suppress them.                                      | Exit code `0` (0 warnings, 0 errors).             |
| **8. Full Verification**  | Run when slice is feature-complete:<br>`mise run verify` AND `mise run qualify`                                                                                                                                            | Exploits local CPU/Docker: runs `depcruise`, `knip`, `fast-check`, `StrykerJS`, `Testcontainers`, `Playwright`, plus negative `qualify` fixtures.                 | Both tasks exit `0` with fresh reports.           |
| **9. Independent Review** | Spawn a **separate read-only Reviewer Agent** (fresh context) with `gh issue view <id>` and `git diff`.                                                                                                                    | Self-review in the same context does NOT count. Reviewer runs **Section 3 Checklist** to detect sample-fitting or weakened assertions.                            | Explicit `APPROVED` verdict from Reviewer.        |
| **10. Clean & Update**    | Post-review cleanup inside worktree:<br>1. `bun run knip` (delete dead exports/files)<br>2. Update `docs/` if behavior changed<br>3. `mise run format && mise run verify`                                                  | Do NOT clean before Stage 9 review; clean after review feedback is resolved so the final diff is spotless.                                                        | Clean `git status`, `verify` exits `0`.           |
| **11. PR & CI**           | `git push -u origin feat/<id>-<slug>`<br>`gh pr create --fill --body "Closes #<id>"`                                                                                                                                       | Wait for hosted GitHub Actions `acceptance` aggregate check to pass. Merge only when all required checks are green.                                               | PR merged into `main`.                            |
| **12. Release**           | Run authorized release/deploy workflow if in Issue scope.                                                                                                                                                                  | Verify live/packaged artifact health; never claim release from a build alone.                                                                                     | Verified artifact/deployment digest.              |
| **13. Iterate**           | Clean up merged worktree:<br>`cd <PRIMARY_ROOT> && git worktree remove ../wt-<id> && git pull`                                                                                                                             | Return to **Stage 1** for the next product slice.                                                                                                                 | Clean primary repo; stale worktree deleted.       |

---

## 2. ANTI-CHEATING & LOCAL COMPUTE ENFORCEMENT RULES

To maximize local hardware and make "patch-style cheating" impossible, these rules are non-negotiable:

1. **Single Type Authority (`tsrs`)**:
   - Always run with `TSRS_FAST=0`. Never install or run `tsc` as a second checker.
   - `tsconfig.json` must enforce `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"verbatimModuleSyntax": true`.
2. **Zero-Tolerance Linting (`Oxlint`)**:
   - Ban `typescript/no-explicit-any`, `typescript/no-unsafe-*`, `typescript/ban-ts-comment`, `typescript/no-floating-promises`, `no-empty`, `jest/no-focused-tests`, `jest/no-disabled-tests`, and cap `eslint/complexity` at `10` (prevents `if (input === "test_case")` patch branching).
3. **Strict Architectural Boundaries (`dependency-cruiser`)**:
   - `src/domain/**` MUST have **zero** imports from `src/adapters/**`, `src/ui/**`, `node:*`, `bun:*`, `process.env`, or external SDKs.
   - `src/ui/**` MUST NOT import `src/adapters/**` or backend DB models directly.
4. **Property-Based & Mutation Testing (Local CPU Exploitation)**:
   - **Property Testing (`fast-check`)**: Every domain parser, calculator, validator, and state machine MUST have `fc.assert(fc.property(...))` tests generating randomized edge inputs (empty strings, Unicode, negative/boundary numbers, malformed shapes).
   - **Mutation Testing (`StrykerJS`)**: Before Stage 9, run `bun run test:mutation` scoped to modified `src/domain/**/*.ts` files (`break: 100` threshold for critical business/auth logic). Surviving mutants prove your tests are weak—strengthen assertions until mutants die.
5. **Real Full-Stack Execution (`Testcontainers` + `Playwright`)**:
   - Database/adapter tests MUST run against real local Docker containers via `Testcontainers` (PostgreSQL/Redis/etc.), never mocked repository classes.
     Use code with caution.
     • Browser E2E tests via Playwright MUST assert real HTTP network requests (page.waitForResponse) and verify persisted state across page reloads.
6. 2-Strike Repair Limit (Anti-Loop Rule):
   • If a repair attempt fails twice with the same error signature, STOP patching. Run a discriminating diagnostic (git diff, trace logs, or isolated reproduction) to identify the root cause before editing again.

7. INDEPENDENT REVIEWER CHECKLIST (STAGE 9 MANDATE)

When acting as the Independent Reviewer Agent in Stage 9, read ONLY gh issue view <id> and git diff main...HEAD. Reject (REQUEST_CHANGES) immediately if ANY check fails:
• Zero Sample Fitting: Search git diff for string/number literals in src/ that match test fixtures in tests/. Any match = REJECT.
• Zero Oracle Weakening: Check git diff tests/. Were any assertions deleted, changed to .toBeDefined() / .toBeTruthy(), or skipped? Any weakening = REJECT.
• Zero Escape Hatches: Search git diff for any, unknown as, @ts-, oxlint-disable, eslint-disable, or empty catch. Any occurrence = REJECT.
• True End-to-End Flow: Verify data travels from UI/API input -> Zod schema validation -> pure src/domain -> real src/adapters DB query. Hardcoded JSON returns = REJECT.
• No Speculative Bloat: Confirm knip passed and no unused helper files or unrequested dependencies were added.

4. GITHUB ISSUE CONTRACT TEMPLATE (STAGE 4)

Copy this exact markdown structure when creating any GitHub Issue in Stage 4:

```markdown
1. User Outcome & Scope

• User Story: As a , I want to , so that .
• Out of Scope:

2. Architecture & Contract Changes

• Affected Paths: <e.g., src/schemas/order.ts, src/domain/pricing.ts, src/adapters/pg-order.ts, src/ui/Checkout.tsx>
• Input / Output Schema (Zod/OpenAPI):
ts // Exact request, response, and error shapes  
• Persistence / Migration: <SQL/Schema changes or "None">

3. Verifiable Acceptance Oracles

• Primary Flow: Given , when , then AND <exact DB/UI state>.
• Negative / Boundary Cases: <invalid input, unauthorized user, duplicate/concurrent request> -> <exact error code & unchanged state>.
• Invariants (Property Rules): <e.g., total price is always >= 0 and idempotent across retries>.

4. Activated Local Gates

• mise run check-fast (oxfmt + oxlint + tsrs)
• mise run verify (depcruise + knip + test:behavior + test:contracts)
• mise run qualify (Negative rule fixtures)
• Heavy Compute (check required): [ ] fast-check [ ] StrykerJS [ ] Testcontainers [ ] Playwright
```

5. CANONICAL TOOLCHAIN CONFIGURATIONS (DROP-IN READY)

If any of these configuration files are missing or incomplete during Step 0.5, write them directly without asking:

5.1 mise.toml (Authoritative Local Task Runner)

```toml
[env]
TSRS_FAST = "0"
[tasks."format"]
run = "oxfmt --write --disable-nested-config ."
[tasks."format-check"]
run = "oxfmt --check --disable-nested-config ."
[tasks."lint"]
run = "oxlint --type-aware --deny-warnings src tests"
[tasks."lint-fix"]
run = "oxlint --type-aware --fix src tests"
[tasks."typecheck"]
run = "tsrs --noEmit -p tsconfig.json"
[tasks."arch"]
run = "bun run depcruise --config .dependency-cruiser.cjs --output-type err-long src"
[tasks."deadcode"]
run = "knip"
[tasks."check-fast"]
depends = ["format-check", "lint", "typecheck"]
[tasks."test:behavior"]
run = "bun test tests/behavior"
[tasks."test:contracts"]
run = "bun test tests/tooling/contracts"
[tasks."test:mutation"]
run = "bun run stryker run"
[tasks."qualify"]
run = "bun test tests/tooling/qualification"
[tasks."verify"]
depends = ["check-fast", "arch", "deadcode", "test:behavior", "test:contracts"]
```

5.2 .oxlintrc.json (Anti-Patch & Type-Safe Rules)

json { "$schema": "./node_modules/oxlint/configuration_schema.json", "plugins": ["typescript", "import", "unicorn", "jest"], "categories": { "correctness": "error" }, "rules": { "typescript/no-explicit-any": "error", "typescript/no-unsafe-assignment": "error", "typescript/no-unsafe-argument": "error", "typescript/no-unsafe-call": "error", "typescript/no-unsafe-member-access": "error", "typescript/no-unsafe-return": "error", "typescript/no-unsafe-type-assertion": "error", "typescript/no-floating-promises": ["error", { "ignoreVoid": false }], "typescript/ban-ts-comment": [ "error", { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false } ], "eslint/complexity": ["error", { "max": 10 }], "eslint/max-depth": ["error", { "max": 3 }], "eslint/no-empty": "error", "eslint/no-global-assign": "error", "eslint/no-implicit-globals": "error", "jest/no-focused-tests": "error", "jest/no-disabled-tests": "error" } }

5.3 .dependency-cruiser.cjs (Full-Stack Unidirectional Boundaries)

javascript module.exports = { forbidden: [ { name: "no-circular", severity: "error", from: {}, to: { circular: true } }, { name: "no-unresolved", severity: "error", from: {}, to: { couldNotResolve: true } }, { name: "no-undeclared-dependencies", severity: "error", from: {}, to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] }, }, { name: "domain-stays-pure", severity: "error", from: { path: "^src/domain/" }, to: { pathNot: "^src/domain/" }, }, { name: "application-stays-independent", severity: "error", from: { path: "^src/application/" }, to: { pathNot: "^src/(application|domain|schemas)/" }, }, { name: "ui-does-not-import-infrastructure", severity: "error", from: { path: "^src/ui/" }, to: { path: "^src/(adapters|application)/" }, }, { name: "browser-ui-has-no-runtime-builtins", severity: "error", from: { path: "^src/ui/" }, to: { dependencyTypes: ["core"] }, }, ], options: { doNotFollow: { path: "node_modules" }, builtInModules: { add: ["bun", "bun:test", "bun:sqlite"] }, tsPreCompilationDeps: true, tsConfig: { fileName: "tsconfig.json" }, }, };

5.4 stryker.config.json (Domain Mutation Gate)

json { "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json", "testRunner": "command", "commandRunner": { "command": "bun run test:behavior" }, "coverageAnalysis": "off", "incremental": false, "mutate": [ "src/domain/**/\*.ts", "!src/domain/**/_.test.ts", "!src/domain/\*\*/_.spec.ts" ], "thresholds": { "high": 100, "low": 90, "break": 90 }, "reporters": ["clear-text", "json"] }
