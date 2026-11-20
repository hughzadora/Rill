---

name: rill-recover
description: Resume a Rill task in a fresh or compacted Codex session from actual GitHub and Git facts instead of conversation history.
---

# rill-recover

Use when the agent restarts, compacts, switches worktrees or inherits work.

1. Run `python3 .codex/hooks/rill.py status` from product root.
2. Check actual repo, branch, HEAD, dirty paths, parent/sub-issue links,
   dependencies, open acceptance and current candidate PR/CI.
3. Reconstruct next safe action only from current primary sources.
4. If no bound verified Issue, missing tools or contradictory evidence,
   mark BLOCKED and stop rather than silently choosing a task.
5. Continue within existing permission scope. Verify and update exact-source
   evidence; native Codex owns sessions/compaction, not an Rill transcript DB.
