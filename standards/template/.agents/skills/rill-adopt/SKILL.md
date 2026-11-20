---

name: rill-adopt
description: Adopt the already packaged Rill software factory in a new or existing product without recreating its configuration or tooling.
---

# rill-adopt

This skill applies when installing, updating or diagnosing Rill adoption.

1. Inspect the actual target Git repository, committed source roots, locks,
   existing native AGENTS/Skills/Codex/Actions config and uncommitted work.
2. For a new target, use the reviewed Rill source checkout's
   `python3 tools/adopt_rill.py <target> --source <reviewed-source> --ref
   <reviewed-tag> --data ... --apply`. Its native Copier invocation
   detects existing files and persists ownership flags automatically.
   For updates, use native Copier's tracked version and answers. See
   .rill/STANDARD.md and never recreate Rill role, Skill or CI code.
   Never independently rewrite reusable Rill role definitions or CI scripts.
3. For existing repos, preview exact changes in an isolated branch/worktree.
   Copier must keep pre-existing product code, tests and other workflows.
4. Run `python3 .codex/hooks/rill.py status`. If AGENTS.md,
   .codex/config.toml or hooks.json pre-existed, keep them but report a
   native-integration CONFLICT until reviewed; never call partial installs done.
5. Validate real locked tools, concrete positive/negative behavior and native
   hosted CI at the exact product SHA. Use Git revert for tested rollback.
6. Record source, version, actual checks, blockers and next safe step in
   the product's GitHub Issue/PR. Don't open a new Rill-internal ticket.
