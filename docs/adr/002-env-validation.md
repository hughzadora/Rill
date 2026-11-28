---
id: ADR-002
title: @t3-oss/env-core plus Zod for fail-closed runtime limits
status: active
last_updated: 2026-11-28
related_code:
  - src/env.ts
  - src/workflow.ts
---

# ADR-002: @t3-oss/env-core plus Zod for fail-closed runtime limits

## Status

active

## Context

The workflow engine requires hard ceilings on work performed per run: `RILL_MAX_STEPS`,
`RILL_TIMEOUT_MS`, and `RILL_MAX_TOKEN_BUDGET`. A hand-written validation path could silently
accept out-of-range values, and a missing variable could produce `undefined` that behaves as
"unbounded" once arithmetic is applied.

## Decision

Validate environment variables once at start-up with `createEnv` from `@t3-oss/env-core`,
backed by Zod schemas in `src/env.ts`. Every limit is non-optional and has an explicit maximum.
`src/workflow.ts` consumes the parsed `workflowLimits` and the reducer transitions to
`failed` when a limit is exceeded; no limit is clamped or silently widened.

## Consequences

- A malformed or missing limit fails at start-up rather than mid-run.
- The workflow reducer is a pure function of `(state, event, config)`, so limit behaviour is
  directly testable.
- Adding a new limit requires updating the schema, the config factory, and the reducer.

## Related

- docs/adr/README.md
- AGENTS.md
- docs/INDEX.md
