# ADLC Execution & Realignment Protocol (Zero-Friction Edition)

> **SOLE OPERATIONAL AUTHORITY**. Read this file as your only execution contract. Do NOT invent custom task schedulers, state files, workarounds, or parallel state machines. Every state transition is owned by **GitHub Issues / PRs**, every workspace is isolated via **Git Worktree**, and every quality gate is executed deterministically via **`mise` + local compute** (`tsrs` / `oxlint` / `oxfmt` / `knip` / `tsconfig`).

> Leading word: **zero-friction** — every instruction below collapses a decision you would otherwise guess at. If a step says "run `mise run check-fast`", run exactly that; do not substitute another command, do not skip it, do not ask which package to install.

---

## 0. IN-FLIGHT REALIGNMENT PROTOCOL (EXECUTE THIS FIRST)

**If the repository is already mid-development, execute Steps 0.1 → 0.5 sequentially before writing any new product code. Do not ask for permission to organize your own workspace.**

### Step 0.1: Freeze & Inspect Current Workspace

Run in bash:

```bash
git status --short
git branch --show-current
git worktree list
gh issue list --state open --limit 20
```

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
| **2. Explore & Research**  | Inspect codebase, schemas, dependencies, and docs (`rg`, `git log`, `gh`).    | **ZERO file mutations allowed.** Map existing patterns so you reuse them instead of inventing parallel abstractions.                     | List of affected files & existing contracts. |
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
   - Browser E2E tests via Playwright MUST assert real HTTP network requests (`page.waitForResponse`) and verify persisted state across page reloads.
6. **2-Strike Repair Limit (Anti-Loop Rule)**:
   - If a repair attempt fails twice with the same error signature, STOP patching. Run a discriminating diagnostic (`git diff`, trace logs, or isolated reproduction) to identify the root cause before editing again.

---

## 3. INDEPENDENT REVIEWER CHECKLIST (STAGE 9 MANDATE)

When acting as the Independent Reviewer Agent in Stage 9, read ONLY `gh issue view <id>` and `git diff main...HEAD`. Reject (`REQUEST_CHANGES`) immediately if ANY check fails:

- **Zero Sample Fitting**: Search `git diff` for string/number literals in `src/` that match test fixtures in `tests/`. Any match = REJECT.
- **Zero Oracle Weakening**: Check `git diff tests/`. Were any assertions deleted, changed to `.toBeDefined()` / `.toBeTruthy()`, or skipped? Any weakening = REJECT.
- **Zero Escape Hatches**: Search `git diff` for `any`, `unknown as`, `@ts-`, `oxlint-disable`, `eslint-disable`, or empty `catch`. Any occurrence = REJECT.
- **True End-to-End Flow**: Verify data travels from UI/API input -> Zod schema validation -> pure `src/domain` -> real `src/adapters` DB query. Hardcoded JSON returns = REJECT.
- **No Speculative Bloat**: Confirm `knip` passed and no unused helper files or unrequested dependencies were added.

---

## 4. GITHUB ISSUE CONTRACT TEMPLATE (STAGE 4)

Copy this exact markdown structure when creating any GitHub Issue in Stage 4:

````markdown
1. User Outcome & Scope

• User Story: As a <role>, I want to <action>, so that <benefit>.
• Out of Scope: <boundaries>

2. Architecture & Contract Changes

• Affected Paths: <e.g., src/schemas/order.ts, src/domain/pricing.ts, src/adapters/pg-order.ts, src/ui/Checkout.tsx>
• Input / Output Schema (Zod/OpenAPI):

```ts
// Exact request, response, and error shapes
```
````

• Persistence / Migration: <SQL/Schema changes or "None">

3. Verifiable Acceptance Oracles

• Primary Flow: Given <initial state X>, when <action Y>, then <observable output Z> AND <exact DB/UI state W>.
• Negative / Boundary Cases: <invalid input, unauthorized user, duplicate/concurrent request> -> <exact error code & unchanged state>.
• Invariants (Property Rules): <e.g., total price is always >= 0 and idempotent across retries>.

4. Activated Local Gates

• `mise run check-fast` (oxfmt + oxlint + tsrs)
• `mise run verify` (depcruise + knip + test:behavior + test:contracts)
• `mise run qualify` (Negative rule fixtures)
• Heavy Compute (check required): [ ] fast-check [ ] StrykerJS [ ] Testcontainers [ ] Playwright

````

---

## 5. CANONICAL TOOLCHAIN CONFIGURATIONS (DROP-IN READY)

If any of these configuration files are missing or incomplete during Step 0.5, write them directly without asking.

### 5.1 mise.toml (Authoritative Local Task Runner)

```toml
[env]
TSRS_FAST = "0"

[tasks.build]
run = "bun run build"

[tasks.format]
run = "oxfmt --write --disable-nested-config ."

[tasks."format-check"]
run = "oxfmt --check --disable-nested-config ."

[tasks.lint]
run = "oxlint --type-aware --deny-warnings src tests"

[tasks."lint-fix"]
run = "oxlint --type-aware --fix src tests"

[tasks.typecheck]
run = "tsrs --noEmit -p tsconfig.json"

[tasks.knip]
run = "bun run knip"

[tasks."arch"]
run = "bun run depcruise --config .dependency-cruiser.cjs --output-type err-long src"

[tasks."deadcode"]
run = "knip"

[tasks."check-fast"]
depends = ["format-check", "lint", "typecheck"]

[tasks.test]
run = "bun run test"

[tasks."test:mutation"]
run = "bun run stryker run"

[tasks.qualify]
depends = ["test"]
run = "bun run test:qualification"

[tasks."scan-secrets"]
run = "gitleaks dir --redact=100 ."

[tasks."scan-history"]
run = "gitleaks git --redact=100 ."

[tasks."scan-dependencies"]
run = "osv-scanner scan source --recursive ."

[tasks.spelling]
run = "typos"

[tasks.links]
run = "lychee --offline --no-progress AGENTS.md README.md 'docs/**/*.md' 'workflow/**/*.md' '.agents/**/*.md' modern-ai-dlc-engineering-master-blueprint.md"

[tasks.workflow-lint]
run = "bun run oxlint --deny-warnings .github/scripts/require-results.js && actionlint -shellcheck shellcheck -ignore 'specifying action.*locked-setup.*ref is missing' .github/workflows/acceptance.yml && shellcheck -s bash .github/actions/locked-setup/install.sh && zizmor --offline .github/workflows/acceptance.yml .github/actions/locked-setup/action.yml"

[tasks.verify]
depends = [
  "check-fast",
  "knip",
  "test",
  "scan-secrets",
  "scan-dependencies",
  "spelling",
  "links",
  "workflow-lint",
]
````

### 5.2 .oxlintrc.json (Anti-Patch & Type-Safe Rules)

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "import", "unicorn", "jest"],
  "categories": { "correctness": "error" },
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/no-floating-promises": ["error", { "ignoreVoid": false }],
    "typescript/ban-ts-comment": [
      "error",
      { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false }
    ],
    "eslint/complexity": ["error", { "max": 10 }],
    "eslint/max-depth": ["error", { "max": 3 }],
    "eslint/no-empty": "error",
    "eslint/no-global-assign": "error",
    "eslint/no-implicit-globals": "error",
    "jest/no-focused-tests": "error",
    "jest/no-disabled-tests": "error"
  }
}
```

### 5.3 .dependency-cruiser.cjs (Full-Stack Unidirectional Boundaries)

```javascript
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    { name: "no-unresolved", severity: "error", from: {}, to: { couldNotResolve: true } },
    {
      name: "no-undeclared-dependencies",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "domain-stays-pure",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { pathNot: "^src/domain/" },
    },
    {
      name: "application-stays-independent",
      severity: "error",
      from: { path: "^src/application/" },
      to: { pathNot: "^src/(application|domain|schemas)/" },
    },
    {
      name: "ui-does-not-import-infrastructure",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: "^src/(adapters|application)/" },
    },
    {
      name: "browser-ui-has-no-runtime-builtins",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { dependencyTypes: ["core"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    builtInModules: { add: ["bun", "bun:test", "bun:sqlite"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
```

### 5.4 stryker.config.json (Domain Mutation Gate)

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "command",
  "commandRunner": { "command": "bun run test:behavior" },
  "coverageAnalysis": "off",
  "incremental": false,
  "mutate": ["src/domain/**/*.ts", "!src/domain/**/*.test.ts", "!src/domain/**/*.spec.ts"],
  "thresholds": { "high": 100, "low": 90, "break": 90 },
  "reporters": ["clear-text", "json"]
}
```

---

## 6. COMPLETION CRITERIA (ALL AUTOMATICALLY CHECKABLE)

1. `git status --short` is empty.
2. `git worktree list` shows only the main worktree (or the current task's `../wt-<issue-id>`).
3. Exactly one open GitHub Issue with label `ready`, matching current work.
4. `mise run check-fast` = exit `0`, 0 warnings, 0 errors.
5. `mise run verify` = exit `0`.
6. `mise run qualify` = exit `0` (includes negative / fault-injection cases).
7. `bun run knip` = exit `0`, no orphan files or unused exports.
8. Independent Reviewer Session outputs `APPROVED` on `git diff main...HEAD` (zero patch cheating, zero assertion weakening, zero type escape).
9. `.github/workflows/acceptance.yml`: all three macOS jobs use `macos-26` and include `test "$(uname -m)" = "arm64"`; acceptance aggregate uses `if: ${{ always() }}` and covers `merge_group`.

---

_Leading word summary: **zero-friction**. Every step above names the exact command, file, and exit code. Do not paraphrase; do not substitute. Run, observe, proceed._
