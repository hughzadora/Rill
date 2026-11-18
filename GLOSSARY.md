# Rill domain glossary

Rill's domain is the relationship between an owner, an enrolled project, an authoritative task, and evidence for work performed across native sessions.

## Language

**Project enrollment**:
The explicit association between a repository and Rill's project-specific preferences and native controls.
_Avoid_: Installation (which can describe the plugin without opting a repository into project processing).

**Bound task**:
The GitHub issue selected as the current execution record for an enrolled project.
_Avoid_: Active issue when referring to an issue that has not been explicitly bound.

**Task fact**:
A requirement, correction, attempt, diagnosis, or checkpoint that contributes to a task's decision or execution history.

**Recovery snapshot**:
A local copy of synchronized task information that can be rebuilt from GitHub.

**Pending fact**:
A locally retained task fact that has not yet been confirmed on GitHub by publication and readback.

**Recovery gap**:
A known missing, conflicting, stale, or incomplete piece of information that limits which task work can safely continue.

**Repair round**:
A set of changes made for one original problem and the targeted check of whether its required behavior is now correct.

**Delivery audit**:
Rill's check of candidate-bound acceptance evidence and declared review/owner sources. A passing local audit becomes PR readiness only after publication/readback and live artifact checks; it does not itself create a PR, authorize a merge or establish semantic correctness.
