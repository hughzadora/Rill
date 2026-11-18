# Owner working agreements

Use the host's native interactive selection/input control for consequential owner questions. Investigate facts available in the environment before asking. Keep approvals in the host's native approval mechanism. If the needed control is genuinely unavailable, state the limitation and use a concise text question.

Keep this agreement and approved task constraints available across compaction and handoffs. Recover them from their authoritative source instead of asking the owner to repeat them. Continue routine authorized work; ask only for information or decisions that affect the requested outcome.

In enrolled projects, establish the complete agreed design before implementing slices. Preserve the approved scope; record owner decisions before dependent changes. Use the delivery stages, human checkpoints, engineering defaults, and test timing confirmed in Rill #16 as owner preferences on top of the selected Matt Pocock methods.

## Native workflow reuse

Start one fresh bounded worker context for each source-bearing workflow. Keep that worker and its context for same-domain increments. Before assigning work, the coordinator checks the native roster and exact thread binding: continue a running worker; follow up its idle, interrupted, or completed thread. Absence from a roster is not proof that a worker is unavailable; inspect the binding and native thread state. Use a new worker only for independent scope, a required specialty the bound worker lacks, invalid context, or no suitable existing binding, and record the reason. Only the coordinator dispatches; keep the native concurrency cap and configured role models.

At a workflow handoff, record one checkpoint in the existing bound task with a stable workflow ID, parent and worker thread IDs, owned scope, source checkpoint revision, verified source paths and hashes, completed evidence, and exact next action. Continue from that checkpoint and the native binding; checkpoint metadata alone does not establish that a thread is still available. Do not create a workflow registry or scheduler.

Treat the current session's user-level AGENTS text as native-loaded context. Reuse it within the workflow while its recorded source hash is unchanged. Read a pointed policy or project source only when its trigger applies and it has not been read in this context; refresh it when its revision or hash changes. Source facts that can change outside GitHub or the repository still require current verification. Do not reread unchanged source files or raw logs just to start another increment.

CI policy:

- Commit hooks run lint only. Development increments select checks by behavioral risk, not changed line count: text/format-only changes use lint; behavior changes and bug repairs run targeted checks that demonstrate the changed behavior.
- Before the batch PR is ready for review, run local full-spec CI once against approved acceptance, including type checks, applicable tests and integration validation. Report uncovered acceptance as unverified.
- Reuse a passing result only for the same candidate. Changes to code, dependencies, check configuration or merge base require affected checks; uncertain impact requires full checks.
- Before merge, verify evidence against the final candidate: revision, working-tree state, environment, exact commands, exit codes and unverified items. Old evidence cannot certify new content.
- Preserve failures. Diagnose with local tools first; use agent judgment for what tools cannot establish. Keep retries, timeouts, tests and assertions honest.
- Use existing Just, Husky, Biome, TypeScript and test tooling. Measure duration and coverage gaps before optimizing. Tool migrations, paid runners and screenshot time budgets require separate justification.
- Local hooks are bypassable convenience guards; repository merge protection is a separate control. Matt Pocock owns engineering methods; Rill owns these preferences and their executable integration.

For the same original bug, retain failed attempts across chats, compaction, hypotheses, and agent handoffs. Two consecutive failed repair rounds require re-diagnosis and new discriminating evidence before another repair. Stop repeated diagnostics that yield no new information. Independent review/fix is capped at three rounds before reconsidering the approach. Unverified results remain unverified.
