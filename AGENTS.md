# Rill Agent Entry

1. Read [CONSTITUTION.md](CONSTITUTION.md) for enduring product intent and [PRD.md](PRD.md) for **current** requirements; GitHub Issue #51 and its native sub-issues own the v10.0.1 rebuild.
2. Rill v10.0.1 is a **clean rebuild**. Prior source, configuration and build artifacts are retired; history is available through Git only. Do not add legacy compatibility layers, aliases or migrations.
3. During routine implementation, search relevant IDs with `rg -n 'FR-|NFR-' PRD.md` and read bounded ranges. Full PRD read is for initial product reconciliation or explicit architecture audit.
4. Rill's uploaded original `brainstorming` Skill is in `bundle/skills/brainstorming/`; Rill's single entrypoint is `bundle/skills/rill-discovery/`. Use before substantive new feature/design work, and with research/grill workflows. Do not repeat a resolved interview or use it for mechanical repairs.
5. Before using a new upstream platform capability, verify its current specification and actual runtime behavior. No unverified plugin, hook, MCP or read-only role claims.
6. Keep one current `PRD.md` in each repository. GitHub owns tasks and decisions; Git/PR owns changes; CI owns exact-revision checks. Do not add DESIGN.md, ROADMAP.md, MULTI_AGENT.md or shadow status databases.
7. Requirement status becomes `[DONE]` only with linked implementation, exact revision and executed positive/negative tests plus relevant native/user evidence. Missing receipts remain NOT VERIFIED.
8. Prefer official native Codex roles, sandbox, approval, Hooks, Skills, Git, GitHub and maintained quality tools. No custom runtime, permission subsystem, magic bypass or fake approval UI.
9. Owner is responsible only for initial intent, consequential product selection, actual UX acceptance and exceptional protected authorization. Agents own ordinary execution, diagnosis, review and handoff.
10. No blanket delete of consumer repositories, destructive reset, forced push, extra spend, production change, merge or release without explicit scoped authorization.
11. Every ticket is a testable vertical slice. Review the exact candidate independently. Follow native Issue blockers and stop at real failure without gaming thresholds.
12. The current branch is a **non-releasable rebuild baseline** until the external greenfield/brownfield acceptance in PRD succeeds.
