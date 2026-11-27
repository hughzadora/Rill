---
id: SPEC-001
title: Rill Product Brief
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - docs/02-requests/active/GOAL-ADLC-ZERO-FRICTION.md
  - workflow/DELIVERY.md
  - workflow/ACCEPTANCE.md
---

# Rill Product Brief

Single source of truth for Rill product scope and acceptance. Defines what Rill is, who it serves, and how acceptance is judged.

## Adoption

Use a versioned repository template. Start a new product in a separate workspace and describe the problem in plain language. One sentence about the desired result is enough to begin. Codex draws on the request and workspace, records product assumptions, and makes routine toolchain and implementation choices. Each adopted project keeps its own product brief, tool configuration, local evidence, and Rill version.

GitHub holds the Rill development source. The development checkout is replaceable. Adopt a published GitHub Release asset from a fixed tag, verify its checksum, and extract it into the consumer repository. Adoption requires the release artifact and the consumer's selected toolchain.

**Leading word: `adopted`.** A product starts from a fixed-version kit, never from a floating checkout.

## First acceptance

From a clean environment where the Rill source checkout is inaccessible, verify and adopt only the fixed-version release kit. Use the TypeScript + Bun route first. Open the resulting independent project in a fresh Codex session and submit a natural product request with an observable outcome. Codex resolves the target, records the brief and assumptions, installs the locked toolchain, delivers a runnable increment, and exercises the primary journey and a material failure through the actual product surface. Run `mise run verify` and `mise run qualify` and observe an injected violation fail with its expected diagnostic. Compare source and lockfiles across read-only acceptance. Retain the prompt, result, artifact digest, and exact revision reviewed.

In a separate fresh session, submit a request with two materially different plausible outcomes, such as a family list where sharing affects who sees and changes the data. Acceptance requires a specific product question that names the practical choice and recommends a default. Record the asked question and the observed state of work depending on the answer. Assess both journeys with the release candidate procedure in `workflow/ACCEPTANCE.md`.

**Leading word: `observable`.** Acceptance is judged on observable outcomes, not on intent restated.

## Complete delivery

The engineering blueprint defines the full lifecycle and activation conditions. Rill routes from brief and prototype through iteration, review, qualification, release, and recovery. Each applicable profile needs executable native checks and candidate-bound evidence. Validate profiles in representative projects and record the results. The initial TypeScript + Bun journey is one acceptance case for this wider contract.

Ask the owner only for consequential product facts and authorization that is missing. Use plain language and recommend a decision. Report actual results with their inputs; distinguish local execution, hosted execution, and platform enforcement.

The supplied master blueprint ships as a verbatim reference. Oxfmt owns repository-authored text and leaves that reference and generated files to their original owners.

**Leading word: `evidence`.** Every claim is backed by native reports, digests, or observed state.
