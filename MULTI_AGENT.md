# Native Multi-Agent Operating Model

## Ownership and configuration

Codex owns sessions, compaction, sandbox, delegated tools, permissions
and native owner decisions. Use native roles from .codex/agents and the
project layer .codex/config.toml, not a hand-rolled workflow engine.
Claude Code subagents use a different native format and must not be
falsely reported as configured by Codex TOML.

Official references:
[Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[Codex config](https://learn.chatgpt.com/docs/config-file/config-reference),
[Claude Code subagents](https://claude.com/resources/articles/subagents-in-claude-code).

## Roles

| Role          | Work                                                                      | Required handoff                                          |
| ------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Coordinator   | Scope from owner intent, issue/PR and available evidence; budget/sequence | Clear next action and approvals needed                    |
| Explorer      | Read-only source audit, root cause, current vendor docs                   | Source links, versions, unknowns and alternatives         |
| Worker        | Bounded implementation on the real worktree                               | Changed paths, actual command results and remaining risks |
| Default       | General bounded task when specialty adds no value                         | Concrete source and results                               |
| Reviewer      | Independent review of final diff and real outputs                         | Ranked reproducible findings and accepted limitations     |
| Risk reviewer | Security, trust, migrations, licensing, privacy, irreversible actions     | Attack/failure cases and risk posture                     |

The native configuration retains cost-aware coordinator defaults, a
two-child limit and intentionally bounded specialist roles. Workers do
not spawn additional children; the coordinator integrates work and uses
a fresh independent reviewer rather than pretending to review itself.

A role file must contain the native name, description and
developer_instructions. Model and effort are explicit defaults, not
evidence that a particular model actually handled an actual turn.
No paid-model fallback or automatic escalation is approved.

## Delegation contract

Assign native child issue, target revision, owned files, acceptance,
available tools and stop conditions. Return actual observations, not
a simulation of a panel of agents. Reuse the same agent for related
incremental work where its real context is still valid; prefer
parallel work only for genuinely independent exploration.

At the end of code work, create a separate reviewer context with the
current candidate and raw evidence. Review actual readability,
design, functionality, security, tests, docs and user effect according
to Google's code review guide. Findings are sent back to the
coordinator/worker; reviewer does not edit implementation.

## Verification and limits

- Native TOML parser checks all role definitions and the configured cap.
- Observe real fresh-session spawn to establish routing/model and sandbox.
- Test candidate-bound independent reviewer from a separate context.
- Verify owner interactions through the real harness, not a mock HTML dialog.
- Compare costs, correctness and actual agent work when changing the role set.

Current project roles are **configuration** until dispatch/review
is observed in the target host session. The retired global Rill
plugin remains a separate, known risk in bug #31.
