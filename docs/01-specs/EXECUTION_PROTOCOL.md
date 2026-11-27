---
id: SPEC-002
title: ADLC Execution & Realignment Protocol
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - docs/00-constitution/ARCHITECTURE.md
  - docs/00-constitution/OWNER_TASTE.md
  - mise.toml
  - .oxlintrc.json
  - src/template.ts
---

# ADLC Execution & Realignment Protocol

Sole operational authority for how work enters and leaves this repository. Every state transition is owned by GitHub Issues / PRs, every workspace is isolated via Git Worktree, and every quality gate runs deterministically through `mise` + local compute. Technical contract details (tsrs, oxfmt, oxlint, knip, Git worktree) live in `docs/00-constitution/ARCHITECTURE.md`; this protocol does not restate them.

**Leading word: `zero-friction`.** Every instruction names the exact command, file, and exit code. Do not paraphrase, do not substitute, do not ask which package to install. Run, observe, proceed.

## 0. In-Flight Realignment Protocol (Execute This First)

If the repository is already mid-development, execute Steps 0.1 → 0.5 sequentially before writing any new product code. Do not ask for permission to organize your own workspace.

### Step 0.1: Freeze & Inspect Current Workspace

Run in bash:

```bash
git status --short
git branch --show-current
git worktree list
gh issue list --state open --limit 20
```

**Completion criterion:** You can see the current branch, dirty files, worktrees, and open issues.

### Step 0.2: Anchor Current Work to a GitHub Issue

- **Rule:** No code exists without an owning GitHub Issue containing verifiable acceptance criteria.
- If the current work lacks an open GitHub Issue, halt coding immediately, synthesize the task into the Section 4 Issue Contract Template, and run:

```bash
gh issue create --title "<feat|fix>: <concise outcome>" --body "<filled template>" --label "ready"
```

- Capture the resulting `<ISSUE_ID>`.

**Completion criterion:** An open GitHub Issue labeled `ready` owns the current work; no local TODO files hold task state.

### Step 0.3: Migrate Dirty / In-Flight Changes into an Isolated Worktree

- **Rule:** Never develop directly in the primary repository root (`main`).
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

- **Bind Context:** From this moment onward, treat `../wt-<ISSUE_ID>` as your sole `PROJECT_ROOT`.

**Completion criterion:** `pwd` is `../wt-<ISSUE_ID>`, `git status` is clean, and the worktree is bound to `<ISSUE_ID>`.

### Step 0.4: Purge Any Existing Anti-Patterns ("Cheating" Audit)

Scan your current diff (`git diff`) and immediately eliminate:

1. Hardcoded test inputs / IDs / strings inside `src/` (sample fitting).
2. Type escapes (`as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`).
3. Swallowed errors (`catch {}`, empty `.catch(() => {})`, floating promises).
4. Fake full-stack stubs (in-memory mock arrays pretending to be DB persistence, or frontend mock responses bypassing real API endpoints).
5. Disabled or weakened tests (`.only`, `.skip`, `passWithNoTests`, or replacing concrete value assertions with `toBeDefined()`).

**Leading word: `root-cause`.** Every failure gets three causal sentences — `[root cause] -> [affected upstream/downstream modules] -> [why local hardcoding/special-casing cannot fix it]` — before any patch is written.

**Completion criterion:** `git diff` contains none of the five anti-patterns above.

### Step 0.5: Wire Local Compute Gates

Verify `mise.toml` and `.oxlintrc.json` match the technical contract in `docs/00-constitution/ARCHITECTURE.md`. Run `mise run check-fast` to confirm baseline health, then resume at Stage 6 (Vertical Slice).

**Completion criterion:** `mise run check-fast` exits 0 with 0 warnings and 0 errors.

---

## 1. Deterministic 13-Stage ADLC Pipeline

Follow this exact flow. Never skip a stage. Never combine Discovery (Phase A) and Implementation (Phase B) in the same turn.

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

| Stage                      | Trigger & Action                                                              | Hard Constraints (Zero Friction)                                                                                                     | Required Exit Artifact                       |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **1. Intent**              | Clarify user outcome, target surface, and non-goals.                          | Ask at most 1 concise question if business intent is ambiguous. Never ask the user to pick packages, folder names, or test commands. | Clear 1-paragraph goal statement.            |
| **2. Explore & Research**  | Inspect codebase, schemas, dependencies, and docs (`rg`, `git log`, `gh`).    | ZERO file mutations allowed. Map existing patterns so you reuse them instead of inventing parallel abstractions.                     | List of affected files & existing contracts. |
| **3. Brainstorm & Design** | Design data contracts (Zod/OpenAPI/DB), domain invariants, and failure modes. | Design contracts first. Identify which local heavy-compute gates apply (`fast-check`, `StrykerJS`, `Playwright`, `Testcontainers`).  | Concrete schema diff & test oracle list.     |
| **4. GitHub Issue**        | Persist the single source of truth via `gh issue create`.                     | Use the Section 4 Issue Contract Template verbatim. Do not store task state in local markdown TODO files.                            | GitHub Issue #<id> with label `ready`.       |

**Leading word: `issue-owned`.** No code exists without an owning GitHub Issue.

### Phase B: Isolated Delivery (Executed Strictly Inside `../wt-<id>`)

| Stage                     | Deterministic Execution Command / Action                                                                                                                                                                    | Hard Constraints (Zero Friction)                                                                                                                              | Mandatory Exit Gate                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **5. Isolated Worktree**  | `git worktree add ../wt-<id> -b feat/<id>-<slug> main && cd ../wt-<id>`                                                                                                                                     | Verify `pwd` is `../wt-<id>` and `git status` is clean before coding.                                                                                         | Worktree bound to `<id>`.                           |
| **6. Vertical Slice**     | Implement end-to-end in strict order: 1. Shared Schema (`src/schemas`) 2. Pure Domain (`src/domain`) 3. Real Adapters (`src/adapters`) 4. UI/API Surface (`src/ui`) 5. Independent Tests (`tests/behavior`) | No horizontal layering without vertical proof. Build one complete working path first. Expected test values must NEVER be computed by calling production code. | Runnable vertical slice with real persistence / IO. |
| **7. Fast Local Checks**  | Run after every file edit batch: `mise run check-fast`                                                                                                                                                      | Executes `oxfmt --check` + `oxlint --type-aware` + `tsrs` (`TSRS_FAST=0`). Fix diagnostics immediately; never suppress them.                                  | Exit code 0 (0 warnings, 0 errors).                 |
| **8. Full Verification**  | Run when slice is feature-complete: `mise run verify` AND `mise run qualify`                                                                                                                                | Runs local CPU / Docker checks plus negative `qualify` fixtures.                                                                                              | Both tasks exit 0 with fresh reports.               |
| **9. Independent Review** | Spawn a separate read-only Reviewer Agent (fresh context) with `gh issue view <id>` and `git diff`.                                                                                                         | Self-review in the same context does NOT count. Reviewer runs the Section 3 Checklist.                                                                        | Explicit `APPROVED` verdict from Reviewer.          |
| **10. Clean & Update**    | Post-review cleanup inside worktree: 1. `bun run knip` (delete dead exports / files) 2. Update `docs/` if behavior changed 3. `mise run format && mise run verify`                                          | Do NOT clean before Stage 9 review; clean after review feedback is resolved so the final diff is spotless.                                                    | Clean `git status`, `verify` exits 0.               |
| **11. PR & CI**           | `git push -u origin feat/<id>-<slug>` then `gh pr create --fill --body "Closes #<id>"`                                                                                                                      | Wait for hosted GitHub Actions `acceptance` aggregate check to pass. Merge only when all required checks are green.                                           | PR merged into `main`.                              |
| **12. Release**           | Run authorized release / deploy workflow if in Issue scope.                                                                                                                                                 | Verify live / packaged artifact health; never claim release from a build alone.                                                                               | Verified artifact / deployment digest.              |
| **13. Iterate**           | Clean up merged worktree: `cd <PRIMARY_ROOT> && git worktree remove ../wt-<id> && git pull`                                                                                                                 | Return to Stage 1 for the next product slice.                                                                                                                 | Clean primary repo; stale worktree deleted.         |

**Leading word: `clean`.** Tree and branches are clean before and after every operation.

## 2. GitHub Issue Contract Template (Stage 4)

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
• `mise run verify` (check-fast + knip + test + scan-secrets + scan-dependencies + spelling + links + workflow-lint)
• `mise run qualify` (Negative rule fixtures)
• Heavy Compute (check required): [ ] fast-check [ ] StrykerJS [ ] Testcontainers [ ] Playwright

```

## 5. Completion Criteria (All Automatically Checkable)

1. `git status --short` is empty.
2. `git worktree list` shows only the main worktree (or the current task's worktree in `.worktrees/`).
3. Exactly one open GitHub Issue with label `ready`, matching current work.
4. `mise run check-fast` = exit `0`, 0 warnings, 0 errors.
5. `mise run verify` = exit `0`.
6. `mise run qualify` = exit `0` (includes negative / fault-injection cases).
7. `bun run knip` = exit `0`, no orphan files or unused exports.
8. Independent Reviewer Session outputs `APPROVED` on `git diff main...HEAD` (zero patch cheating, zero assertion weakening, zero type escape).
9. `.github/workflows/acceptance.yml`: all three macOS jobs use `macos-26` and include `test "$(uname -m)" = "arm64"`; acceptance aggregate uses `if: ${{ always() }}` and covers `merge_group`.

---

_Leading word summary: **zero-friction**. Every step above names the exact command, file, and exit code. Do not paraphrase; do not substitute. Run, observe, proceed._

```
