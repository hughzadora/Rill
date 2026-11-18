# Rill behavioral design

## Direction

Keep Rill small at the system boundary: shared personal preferences and project adapters use Codex's native hooks, MCP tools, configuration, sessions, permissions, and interaction. GitHub remains the source for approved decisions and task execution; local recovery material protects work that has not synchronized yet. Matt Pocock skills provide engineering methods. Rill does not replace either system with its own workflow engine or session service.

The owner-confirmed visual review is [DESIGN.html](DESIGN.html), a dated view associated with the design in [issue #17](https://github.com/hughzadora/Rill/issues/17). The view is not a second specification and does not certify implementation. The complete decision source is #17; delivery evidence and remaining work are maintained in [issue #18](https://github.com/hughzadora/Rill/issues/18).

## Confirmed flows

### Enter a project

An owner explicitly enrolls a new or existing Git checkout. Enrollment resolves the GitHub repository and authorized publisher, preserves current project tools and configuration, and enables the Rill native plugin entry. The owner binds the current GitHub issue through task synchronization. Conflicting repository or publisher identity is surfaced for reconciliation. Native installation and trust are host actions; enrollment alone does not grant trust.

### Start or resume a task

At supported startup/resume events, Rill identifies the enrolled checkout and bound issue, then supplies shared preferences and a task summary. Recovery checks actual Git state and reads the task snapshot, pending records, and available native history. It presents what is reconciled, pending, missing, or unknown, then continues only work whose requirements are available. History-page coverage is evidence of what was read, not proof that all semantics were interpreted.

### Record and synchronize a new fact

Task facts are durably added to a local outbox before publication. When online, Rill checks the authoritative GitHub task, publishes the pending fact, and reads it back. The fact remains pending until readback confirms publication. A remote scope conflict is surfaced rather than silently replacing either version. Offline work can continue only within prior authorization and known requirements; delivery remains unconfirmed until synchronization succeeds.

### Diagnose and repair

The original failure and expected behavior are recorded against the current candidate. Checks retain command, output and exit status; diagnosis links evidence to the failure; interpretation records the reason and proposed repair. Two consecutive failed repair rounds require fresh discriminating evidence. Repeated diagnosis without new evidence stops. A successful check binds to its candidate and does not erase earlier failures. Relevant related behavior remains part of the repair proof.

### Complete or retract delivery evidence

Acceptance checks compare the current candidate with the approved scope, actual full-spec evidence, independent review, and owner decision. A mismatch or later-discovered missing requirement invalidates affected acceptance; the earlier pass stays in history while the affected criterion returns to incomplete or unknown. A local audit cannot create GitHub authorization, merge protection, or human acceptance.

### Leave a project

Leaving requires pending facts to be published and read back. Rill disables the project plugin entry and retains recovery cache, publisher authority, and shared personal policy. Native configuration reload and the actual cessation of hook invocation are checked as separate host behaviors.

## Interaction and human checkpoints

Use host-native selection/input for owner decisions that cannot be established from available facts; use host-native approvals for execution approval. The owner checkpoints from #16 apply: requirements and consequential trade-offs, review of the prototype/overall design, and user trial/final acceptance. The owner may explicitly choose evidence review where that checkpoint permits it. Routine authorized work proceeds without repeatedly asking for known decisions.

The approved design sequence follows #16: requirements, quick prototype, HTML design, implementation, integration and user testing, cleanup, second verification plus human check, then one batch PR. Small tasks may combine stages while preserving their completion criteria. Any scope reduction requires an owner decision.

## Rationale and limits

- GitHub authority and a local outbox separate approved decisions from offline facts, preventing cache freshness from being mistaken for remote truth.
- Native mechanisms keep sessions, permissions, prompts, and scheduling with the host instead of duplicating them in Rill.
- Actual command outputs, behavior checks, and candidate identity are required because documents or status labels cannot prove execution.
- Hook and MCP paths are complementary: hooks act at declared lifecycle/tool boundaries; MCP gives structured task and evidence operations. Neither alone proves the combined native package works.

The remaining negative recovery cases, combined native package trial, full-spec CI, independent review, owner acceptance, and PR are tracked in #18. Current design documents must not be read as evidence that these gates have passed.

## Implementation versus acceptance

At inspected revision `5ca5ab1`, the working tree also contains uncommitted recovery changes: startup refresh, explicit persisted recovery gaps, and allowing independent diagnostics while guarding supported dependent edits. These follow the intended flow above; their remaining negative-case checks and combined native execution are unverified. The existing manual/automatic compaction observations and repair-guard probe recorded in #18 concern their actual earlier versions and paths. The HTML view, this behavior description and content hashes are not evidence that this working tree has passed those scenarios.
