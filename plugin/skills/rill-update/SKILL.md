---
name: rill-update
description: Inspect, prepare, independently review or recover a versioned Rill Plugin update in an existing Git product repository. Use for product Plugin upgrades, conflict handling, or non-destructive rollback; do not apply updates or change native Hook trust without owner authorization.
---

# Rill Update and Recovery

Use upstream Git and the Codex Plugin CLI. Never create an updater, backup database, bespoke approval mechanism, or legacy Rill compatibility adapter.

1. Read the consumer's product `PRD.md` requirements by bounded search, actual Git status/HEAD, `.rill/plugin/plugin.json`, source `VERSION`, and current Codex Plugin command help. The blueprint edition is not a product release.
2. Run `rill update <consumer-root> --json` for a **read-only plan**. A clean Git root with a tracked, versioned Plugin is required. If source provenance, symlink safety, SemVer ordering, or the managed file set cannot be verified, refuse or mark the exact conflict. A nonempty `pendingReview` is **not** an approval.
3. Use `rill update <consumer-root> --yes --json` only when creating an isolated native Git review worktree is authorized. It returns `PREPARED_NOT_VERIFIED` and does not change the original product working tree. It deliberately preserves files absent from the new source, including consumer additions. Inspect `git diff --name-status` and `git diff -- .rill/plugin` in that review worktree, including every overwritten or retained managed asset.
4. Run the consumer's own applicable test, safety and source-inventory checks on the exact review candidate. Obtain actual independent diff review and native approvals before committing or merging into a product branch. Do not alter consumer `AGENTS.md`, `PRD.md`, CI, business source, or `.codex` settings as a side effect of Plugin update.
5. Check native Codex Plugin installation/marketplace version and any Hook trust **separately**. A marketplace refresh or changed local source is not proof that an installed Plugin cache updated or that Hooks executed. Do not use `--dangerously-bypass-hook-trust` or alter user-global settings without explicit approval.
6. To recover a clean, authorized merged Git update, prefer native `git revert` to append a reviewed inverse commit. For an update merge commit, identify its first parent and use `git revert -m 1 <merge-sha>` **only after verifying the parent**. If a revert conflicts, stop, inspect user changes, then use `git revert --abort` to preserve original state. Never `git reset --hard`, force push, delete consumer files, or silently re-run an interrupted update.
7. Record the exact product Git SHA, Rill source version, tested build, preserved consumer changes, conflicts, actual CLI/plugin status, independent review and protected approval status in the existing GitHub Issue/PR. Do not change requirements to `[DONE]` without actual external acceptance.
