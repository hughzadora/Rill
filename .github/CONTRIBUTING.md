# Contributing to Rill

## Start from the current task

Read [AGENTS.md](../AGENTS.md) and [project policy](../POLICY.md). GitHub [#17](https://github.com/hughzadora/Rill/issues/17) owns approved design; [#18](https://github.com/hughzadora/Rill/issues/18) owns the active delivery and remaining gates; [#16](https://github.com/hughzadora/Rill/issues/16) owns engineering stages and human checkpoints. Use the installed Matt Pocock method appropriate to the work. Root documents describe the product and source; they do not supersede owner decisions or prove acceptance.

Inspect Git status before editing. Preserve unrelated work and pending task facts. Work on the authorized task branch/worktree; this approved delivery stays in one batch PR. Propose changes to scope, publisher authority, permissions, cost or other consequential decisions through the owner's native input checkpoint before dependent work. Routine work within approved scope continues without repeated confirmation.

## Checks and evidence

Use [README commands](../README.md#commands) and the [Justfile](../justfile). The [personal CI policy](../skills/rill-preferences/references/personal-policy.md) decides when to run them: commit is lint only, increments use risk-based checks, and the final batch gets local full-spec CI plus its separate acceptance evidence. Preserve failures and unresolved coverage. Check evidence belongs to the current candidate; changed inputs require affected checks or the full fallback when impact is uncertain. Hook bypass does not establish acceptance, and local hooks do not enforce GitHub merge protection.

## Prepare the batch PR

Follow #16/#18's approved human checkpoints, independent whole-batch review and current-candidate evidence requirements. Summarize the concrete behavior, linked task/specification, validation commands/results, and unverified items. Publish/read back task facts and verify actual PR head/base. PR creation does not imply merge, release or cleanup authorization. Keep incomplete acceptance open and retract invalid old completion claims while retaining their evidence.

Put collaboration and governance material in `.github/`. Keep project development entry documents at root and link existing authority instead of adding parallel workflow guides. Add an ADR only for an important durable technical decision not sufficiently captured by existing sources; no ADR convention or new qualifying decision was found in this pass. No Issue/PR templates or agent-specific duplicate instructions are required by the current task. Report security issues using [SECURITY.md](SECURITY.md).
