# Rill product brief

Rill gives a person using Codex a repeatable way to turn a short product request into a usable result and evidence for accepting it. The person decides what the product should do and authorizes consequential external actions. Codex owns routine technical decisions, installation, implementation, debugging, and verification.

## Adoption

Use a versioned repository template. Start a new product in a separate workspace, open that workspace in Codex, and say `用 Rill 开始：〈一句话描述想做的产品〉`. The repository skill also provides an explicit invocation. Each adopted project keeps its own product brief, tool configuration, local evidence, and Rill version.

## First acceptance

From an empty, independent repository, apply the TypeScript + Bun template and invoke Rill in a fresh Codex session. Supply a short product request with an observable outcome. Codex must identify the target, record the brief, and run real locked setup and checks. Verify `mise run verify` and `mise run qualify`, an actual runnable increment, and rejection of an injected violation with the expected diagnostic. Compare source and lockfiles across read-only acceptance. Record the artifact and exact revision reviewed.

## Complete delivery

The [engineering blueprint](../modern-ai-dlc-engineering-master-blueprint.md) defines the full lifecycle and activation conditions. Rill must route from brief and prototype through iteration, review, qualification, release, and recovery. Each applicable profile needs executable native checks and candidate-bound evidence. Validate profiles in representative projects and record the results. The initial TypeScript + Bun journey is one acceptance case for this wider contract.

Ask the owner only for consequential product facts and authorization that is missing. Use plain language and recommend a decision. Report actual results with their inputs and distinguish local execution, hosted execution, and platform enforcement.

The supplied master blueprint ships as a verbatim reference. Oxfmt owns repository-authored text and leaves that reference and generated files to their original owners.
