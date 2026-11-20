---
name: rill-research
description: Research a Rill software-product question from primary sources, verifying native capabilities and tests before changing an existing product requirement. Use for research that may affect design or architecture.
---

# Rill Research

Use the installed `rill-discovery` Skill as the single design-intake gate before substantive new research. Do not separately run brainstorming: it happens inside discovery at most once for this decision.

1. Discover the current repository and relevant FR/NFR by targeted PRD search, not an entire transcript.
2. Research original provider documentation, native APIs, real source/configuration and deterministic test output. Distinguish verified behavior, reported guidance, assumptions and unknowns.
3. If research uncovers a consequential new tradeoff, return through `rill-discovery` only if that decision was not already approved; avoid a repeated owner interview.
4. Write current product conclusions **in place** to the PRD only after a legitimate scope decision. Preserve historical rationale in native GitHub Issues/PRs.
5. Hand approved implementation to native delivery roles. Never represent a search snippet, model assertion or copied file as executed proof.

For already-approved work, research only the unresolved fact and return evidence: do not trigger a new brainstorming phase.
