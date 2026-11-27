# Goal: Rill ADLC zero-friction workflow & anti-patch-cheating enforcement

## Purpose (leading word: zero-friction)

Rill 完整体作为版本化固定版资产已交付，但实际工作模式存在大量补丁式作弊（硬编码、直写用户意图、无 git 卫生、未清理工作树）。本目标将 GitHub Issue 确立为唯一可持续状态中枢，全部写入遵循 `writing-for-agents`（步骤优先、每步以可检查的完成标准结尾、前置导向词、单一真理来源），CI 固定 `macos-26`/`arm64`，消除补丁式作弊漏洞（acceptance 聚合强制要求 `scan-secrets` 通过），所有历史与当前任务规划统一迁入 GitHub Issue。

## Steps (ordered actions; each ends on a checkable completion criterion)

1. **Closed & validated all open GitHub Issues (#16, #17)** — both are `writing-for-agents` formatted, all steps' completion criteria met, then closed.
   - Completion criterion: `gh issue list --state open` returns no issues matching `ready` label for completed work; #16 and #17 state `CLOSED`.

2. **Eliminated acceptance-gate patch-cheating loophole** — `require-results.ts` validates `scan-secrets` alongside `verify`, `qualification`, `artifact`; acceptance job `needs` includes `scan-secrets`; `mise.toml` `workflow-lint` references `require-results.ts`; contract test expects `scan-secrets` in the required job set.
   - Completion criterion: `mise run verify` exits 0; the acceptance aggregate rejects any run where `scan-secrets` is missing or non-success.

3. **Documented layer 1 secret provider in OWNER_TASTE.md** — Infisical/Doppler CLI recorded as user-managed manual install (layer 1 runtime secret isolation), NOT added to `mise.toml`/aqua (no aqua registry).
   - Completion criterion: `OWNER_TASTE.md` Tooling taste section contains layer 1 entry with manual-install note; `mise.toml` unchanged for layer 1.

4. **Completed secret-detection layers 1–4** — layer 1 documented (manual), layer 2 `AGENTS.md` secret-writing gate citing `.gitleaks.toml`, layer 3 GitHub Push Protection + Branch Protection on `integration/ai-dlc-foundation`, layer 4 `.github/workflows/secrets-audit.yml` Gitleaks Action fallback.
   - Completion criterion: `mise run scan-secrets` exits 0 with no leaks; branch protection requires `scan-secrets` status check.

5. **Verified all doors green** — `mise run verify` = 0 (10 checks, 5 tests pass); `mise run qualify` = 0 (31 tests, fault-injection + negative cases pass).
   - Completion criterion: both commands exit 0 with fresh reports; `git status --porcelain` empty.

6. **No stray worktrees or uncommitted state** — single worktree (main checkout), clean tree, no `../wt-*` remnants.
   - Completion criterion: `git worktree list` shows only the primary checkout; `git status --porcelain` empty.

7. **All writing-for-agents artifacts** — every document/issue/PR/plan/goal created explicitly with `writing-for-agents`; AGENTS.md, OWNER_TASTE.md, docs/ADLC_MASTER.md reference each other as single source of truth for owner taste; no local TODO files for task state.
   - Completion criterion: no prose-only requirement sections remain in committed artifacts; `OWNER_TASTE.md` is the non-negotiable taste source.

## Reference (consulted on demand)

- writing-for-agents (skill): steps + completion criteria, information hierarchy, leading words, pruning rules.
- [`OWNER_TASTE.md`](../../OWNER_TASTE.md): owner taste — platform macos-26/arm64, anti-patch-cheating, writing-for-agents, Git/workflow, tooling.
- [`docs/ADLC_MASTER.md`](../../docs/ADLC_MASTER.md): sole operational authority for the 13-stage ADLC pipeline.
- [`AGENTS.md`](../../AGENTS.md): sole entry pointer to owner taste + ADLC_MASTER.md + domain docs.

## Completion criterion (checkable and exhaustive)

- All seven steps above show their criterion met.
- `mise run verify` exits 0 and `mise run qualify` exits 0.
- `gh issue list --state open --label ready` returns empty (no open ready work).
- `git worktree list` shows only primary checkout; `git status --porcelain` empty.
- CI acceptance aggregate requires `scan-secrets` success on `macos-26`/`arm64`.

---

_Leading word summary: **zero-friction**. Every requirement names the exact file, tool, check, and exit code. Do not paraphrase; do not substitute._

- writing-for-agents (skill): steps + completion criteria, information hierarchy, leading words, pruning rules.
