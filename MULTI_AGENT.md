# Native, Context-Centric Multi-Agent Operation

Codex owns delegation, session state, sandboxes, compaction and approvals.
Rill supplies project-scoped role defaults, source guardrails, handoffs and
quality evidence; it does not replace native orchestration.

Canonical role source: `.codex/config.toml` and `.codex/agents/`. Release
consumer assets come only from `standards/template/`; the source
`src/py/rill_cli/template/` is a symlink. Frozen builds embed the same
tree. The live `REVIEW.md` contains failure modes.

## Configured roles (three only)

- **Explorer** (`gpt-6-luna`, low, read-only): narrow source slices,
  `path:start-end | summary`, at most 150 characters.
- **Worker** (`gpt-6-luna`, medium, workspace-write): own a module,
  its implementation and its regression tests in the same context.
- **Reviewer** (`gpt-6.2-sol`, low, read-only): after green full CI,
  check only Git diff, cite `path:line` or reply `LGTM`.

Coordinator remains the root agent, not an extra subagent role. Codex
`max_threads = 3`, `max_depth = 1`; host approval policy remains in control.
Only parallelize independent investigation or strictly disjoint modules.

## Review and quota stop conditions

After a successful `just ci-full`, review only if the diff exceeds 30 changed
lines or touches core/configuration/security/permissions/workflow code. One
independent reviewer acts at once. If it rejects a candidate, have the same
module owner repair it, rerun full CI and request a second review. If the
second review fails, stop and return the outstanding blockers to the owner.
No third loop, test weakening or automatic model escalation.

These are session instructions and configured capabilities, not proof of
execution. Actual native dispatch, selected model and effective sandbox
must be observed separately. A CLI's successful parse is not evidence of
successful agent routing. Claude Code uses different native agent files.
