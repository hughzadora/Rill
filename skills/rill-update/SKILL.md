---
name: rill-update
description: Verify, safely prepare, and recover a Codex-native Rill Plugin upgrade using the official Codex plugin marketplace and GitHub evidence. Use for installed Rill version checks, update review, and non-destructive recovery; never copy plugin files into a consumer repository.
---

# Native Rill Plugin Update

The Rill repository root is the **only** Rill Plugin source. Consumer repositories have their own `PRD.md`, `AGENTS.md`, and optional project-level `.codex/config.toml`; they do not contain `.rill/plugin` or a second Rill Marketplace.

1. Identify the Rill source Git revision and manifest with `git rev-parse HEAD` and root `plugin.json`. Verify actual Codex capabilities using `codex plugin --help`, `codex plugin marketplace --help`, `codex plugin list --json`, and `codex plugin marketplace list`; do not invent an updater command.
2. Compare the installed `rill@rill-source` identity/version and its source Marketplace to the desired revision. A Git push, Marketplace refresh, or editable repository does **not** prove the host's installed plugin cache changed.
3. Check the configured Marketplace source **before** any update. For the Git-backed `rill-source` Marketplace, refresh **only Rill** with `codex plugin marketplace upgrade rill-source` (the unqualified command refreshes **all** Git marketplaces). For a local-path Marketplace, `upgrade` does not refresh the source: export the desired reviewed Git SHA to a clean directory, use the documented native Marketplace and Plugin install/remove commands **only after explicit approval**, and then confirm the installed version and cached files. Never treat a same-version local source edit as a completed Plugin update. Do not update unrelated marketplaces, the user's Plugin cache, global settings, Hook trust, source repository, or consumer files silently. Never copy a Plugin into a consumer repository.
4. Review the exact upstream change with Git and GitHub, run applicable tests against the checked candidate, and obtain an independent reviewer before a protected merge/release. The user's `PRD.md` and code remain their property.
5. Check `hooks/list` and the actual native event trace separately after permitted installation. A Hook must be trusted for its **current definition**; missing trust, missing callback, or duplicate `SessionStart` callbacks are NOT_VERIFIED or BLOCKED, not PASS. Do not use `--dangerously-bypass-hook-trust`.
6. For a Git-managed source rollback, use the native Git history, a reviewed revert/checkout and a fresh native Marketplace install as appropriate. Resolve exact Git conflicts without `reset --hard`, force pushes, deleting consumer files, or impersonating approval.
7. Record the exact source SHA, installed Plugin ID/version, native Hook trust and invocation, check results, independent review, and any protected authorization in the existing GitHub Issue/PR. If a native API cannot provide the required evidence, say UNKNOWN rather than creating a parallel state database.

This is a narrow operational procedure, not a custom package manager, updater, approval system or proof that an upgrade occurred.
