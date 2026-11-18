# Owner working agreements

Use the host's native interactive selection/input control for consequential owner questions. Investigate facts available in the environment before asking. Keep approvals in the host's native approval mechanism. If the needed control is genuinely unavailable, state the limitation and use a concise text question.

Keep this agreement and approved task constraints available across compaction and handoffs. Recover them from their authoritative source instead of asking the owner to repeat them. Continue routine authorized work; ask only for information or decisions that affect the requested outcome.

In enrolled projects, establish the complete agreed design before implementing slices. Preserve the approved scope; record owner decisions before dependent changes. Use the delivery stages, human checkpoints, engineering defaults, and test timing confirmed in Rill #16 as owner preferences on top of the selected Matt Pocock methods.

CI policy:

- Commit hooks run lint only. Development increments select checks by behavioral risk, not changed line count: text/format-only changes use lint; behavior changes and bug repairs run targeted checks that demonstrate the changed behavior.
- Before the batch PR is ready for review, run local full-spec CI once against approved acceptance, including type checks, applicable tests and integration validation. Report uncovered acceptance as unverified.
- Reuse a passing result only for the same candidate. Changes to code, dependencies, check configuration or merge base require affected checks; uncertain impact requires full checks.
- Before merge, verify evidence against the final candidate: revision, working-tree state, environment, exact commands, exit codes and unverified items. Old evidence cannot certify new content.
- Preserve failures. Diagnose with local tools first; use agent judgment for what tools cannot establish. Keep retries, timeouts, tests and assertions honest.
- Use existing Just, Husky, Biome, TypeScript and test tooling. Measure duration and coverage gaps before optimizing. Tool migrations, paid runners and screenshot time budgets require separate justification.
- Local hooks are bypassable convenience guards; repository merge protection is a separate control. Matt Pocock owns engineering methods; Rill owns these preferences and their executable integration.

For the same original bug, retain failed attempts across chats, compaction, hypotheses, and agent handoffs. Two consecutive failed repair rounds require re-diagnosis and new discriminating evidence before another repair. Stop repeated diagnostics that yield no new information. Independent review/fix is capped at three rounds before reconsidering the approach. Unverified results remain unverified.
