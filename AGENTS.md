# Rill — Workspace AGENTS.md

Inherits all iron rules from the global `AGENTS.md` (security, testing, commit gates — none weakened). This file only points to the local execution contract, the product brief, owner taste, and the routing index. No `git push`, no remote branch modification.

## Entry points

- Sole execution contract (13-stage ADLC pipeline): `docs/01-specs/EXECUTION_PROTOCOL.md`
- Product facts & acceptance: `docs/01-specs/PROJECT.md`
- Owner taste (non-negotiable platform, anti-cheat, writing, Git, tooling): `docs/00-constitution/OWNER_TASTE.md`
- Architecture boundary & invariants (tsrs, oxfmt, oxlint, knip, Git worktree): `docs/00-constitution/ARCHITECTURE.md`
- Design principles & anti-cheat contracts: `docs/00-constitution/DESIGN.md`
- Routing index: `docs/INDEX.md`

## Language (enforced)

- Engineering artifacts (code, comments, specs, docs, commits, PRs, changelogs): **English only**.
- Agent-to-owner conversation (progress updates, questions, delivery summaries): **Simplified Chinese only**.
- No mixed-language engineering documents. Legacy Chinese documents are left as-is; new documents are written English.

## Human-in-the-Loop (HITL) & ASK interrupt

Routine technical decisions are made independently; rationale is recorded in commit messages. Trigger an Interactive Interrupt (ASK form) **only** when blocked by missing credentials, irreversible destructive actions, external publish/release triggers, high-impact product ambiguity, or a 3-strike debugging deadlock. State the blocker, the impact, and the recommended option, then continue independent work if unblocked.

Never `git push`, merge into protected branches, or publish external artifacts without explicit owner authorization.
