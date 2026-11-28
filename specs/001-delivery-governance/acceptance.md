---
id: DOC-009
title: Delivery governance acceptance
status: active
superseded_by:
last_updated: 2026-11-28
related_code:
  - .github/workflows/ci.yml
  - .github/workflows/publish.yml
  - .github/workflows/release.yml
  - tooling/document-metadata.mts
  - tooling/workflow-inputs.mts
---

# Delivery governance acceptance

Run `mise run verify` for the candidate. On an isolated GitHub repository, open a PR for a product change with and without the linked feature record. Confirm the evidence check passes with the four populated artifacts and rejects missing or ambiguous declarations. Confirm a maintenance PR with a rationale reaches review.

Trigger a Changesets version PR and confirm the version workflow preserves the generated body, inserts the maintenance declaration, and triggers verification on the edit event. Confirm a Dependabot PR with only supported dependency files reaches review and an undeclared Dependabot PR with an unrelated changed path fails evidence validation.

For independent enforcement, open the PR with the contributor identity. Confirm a candidate change to CI cannot satisfy the trusted check on its own, GitHub blocks merge before the owner approves, and a new commit invalidates the previous approval. Exercise intake and handoff with a low-reasoning agent and ask a fresh maintainer to reproduce the result from the feature record.

The current GitHub rules require a PR with zero approvals. The authenticated CLI identity is the sole repository administrator. Independent enforcement and the agent exercise remain pending.

## Local release rehearsal

An isolated copy of the current template with a real TypeScript workspace package reproduced the original rejection using `mise run changeset` and `mise run docs:check`. After the fix, `mise run verify` passed with a generated Changeset and native Spec Kit scaffolds. `mise run version` consumed the Changeset, generated the package changelog, and advanced the package from `0.0.0` to `0.1.0`. `mise run qualify` passed with the generated changelog, package tests, and one of one mutants killed.

`npm pack` produced the versioned tarball. A separate consumer installed it and checked a valid input and a rejected input through the exported API using Node.js. `npm publish --dry-run --access public --provenance` passed. Hosted workflow dispatch, registry publication, and trusted-publishing authentication require a configured release environment and owner authorization.

## Independent CLI journey pilot

The automation consumer exports sorted relative TypeScript paths as JSON. The pilot used the existing isolated `file-inventory` 0.2.0 rehearsal repository at `361197b609bf257ab8253c9c49c3d2698a3ba587`, with a separate clean clone for each run.

1. From the clone root, run `mise run setup` and `mise exec -- bun run --filter file-inventory build`.
2. Create a temporary fixture with empty files `z.ts`, `src/b.ts`, `src/a.ts`, and `src/notes.md`. Unset `FILE_INVENTORY_GLOB` for the replay.
3. Run `mise exec -- node packages/file-inventory/dist/cli.js --root "$fixture" --glob '**/*.ts' --format json`, with `fixture` set to the absolute fixture path. Expect exit 0, empty stderr, and exactly `["src/a.ts","src/b.ts","z.ts"]` followed by one LF on stdout.
4. Repeat with `--format yaml`. Expect exit 1, empty stdout, and exactly `--format must be json` followed by one LF on stderr. Remove the temporary fixture when done.

A fresh verifier received the journey instructions and a clean clone. It reported a byte-for-byte match in both cases with zero owner interventions and zero clarifications. Its setup, build, valid invocation, and invalid invocation took 0.58 s, 1.04 s, 0.09 s, and 0.07 s respectively. The agent ran for 29.2 s in total. The initial standalone OMP launch could not resolve `magpie/codex/gpt-6.2-sol`, so the coordinator switched once to the current host's native agent runner. This single CLI run establishes observed replayability on that host. The paired comparison in the research proposal remains unmeasured.
