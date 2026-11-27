---
name: rill
description: In an adopted Rill workspace, use for a user's plain-language request to build or improve a product, or for a request to verify, release, or recover it. Also use when the user names or selects Rill. Follow the root-cause-first, intent-to-machine-spec, and no-hardcoded-intent rules in AGENTS.md and DESIGN.md.
---

# Rill

1. Open [Delivery](../../../workflow/DELIVERY.md) for every invocation. Resolve the selected workspace, current product brief, Git state, and next observable outcome there. Ask in the user's language only for a consequential missing fact, target, or authorization.
2. Follow the stage links from Delivery. Use the profile routes when scope or source activates a gate, candidate acceptance when verifying or hardening, and release and recovery when the user requests those actions or an authorized release fails.
3. Run the native tasks on the actual inputs and use the [blueprint](../../../modern-ai-dlc-engineering-master-blueprint.md) for exact requirements and exit conditions. Return what the user can try, the evidence for that result, and any incomplete requirement.

## Root cause first (blueprint 6.1)

On test failure or type error, do not output a patch directly. Output three causal sentences first:
[root cause] -> [affected upstream/downstream modules] -> [why local hardcoding/special-casing cannot fix it].

## Intent → machine-language gateway (anti patch-cheating)

Before code generation, convert user natural-language intent into a standard machine-language spec (input/output, boundary, invariant, failure mode), then write code. User intent must not be written into source as a hardcoded string (e.g. "grocery list", "no signal").

## Test assertion isolation (blueprint 6.2)

Fixing bugs does not alter assertion conditions in existing `*.test.ts` unless business requirements themselves changed. PR review uses difftastic structural diff to spot illicit test tampering at a glance.

## Zero dead code tolerance (blueprint 6.3, knip)

Run `bunx knip` before every iteration ends. Orphan files and unused exports must be cleaned up; no `funcV2` alongside the old function.
