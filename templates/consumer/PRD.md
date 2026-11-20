# Product Requirements

> The consuming product's **single living specification**. Do not copy Rill's factory product requirements into a consumer project. Replace placeholders with actual product facts.

## Vision, Scope & Non-Goals

**Outcome:** [Describe the user-facing product result.]

**In scope:** [Current product capabilities and applicable supported environments.]

**Non-goals:** [Explicit exclusions; never silently infer a product feature from the Rill template.]

## Functional Requirements

Stable IDs are never recycled. `[DONE]` requires exact source, passing tests and relevant runtime evidence.

| ID | Observable behavior and acceptance | Code path | Status |
|---|---|---|---|
| FR-01 | [Positive behavior, boundary and failure acceptance.] | [Path or pending] | [PLANNED] |

## Non-Functional Requirements

| ID | Measurable constraint and verification | Status |
|---|---|---|
| NFR-01 | [Security, performance, accessibility, reliability or privacy test.] | [PLANNED] |

## Traceability and Updates

- GitHub Issues own tasks, blockers, decisions and history; Git/PR own code changes; CI owns revision-bound executed evidence.
- Modify the *current requirement in place* when decisions change. Keep obsolete rationale in Git and Issues, not an appended PRD diary.
- For routine tasks, read only matching FR/NFR and bounded nearby lines with `rg -n`. Whole-document reading is allowed at initial product design and for explicit comprehensive audits.
- Mark `[DONE]` only after implementation is linked to exact code paths, current SHA and actual passing tests; closed Issues or asserted completion do not constitute proof.
- Preserve the consumer repository's existing assets. Adopting Rill never authorizes wiping consumer code, Git history, secrets or custom controls.
