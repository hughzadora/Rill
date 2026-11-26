# Rill delivery workflow

Open the adopted repository in Codex and say `用 Rill 开始：〈你的产品想法〉`. In a later session, ask Rill to continue the project or verify the current candidate. The [blueprint](../modern-ai-dlc-engineering-master-blueprint.md) governs how each stage is executed and accepted.

| Stage     | Do                                                                                                                                       | Evidence before moving on                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Prepare   | Resolve the workspace and Git state. Record the intended user, first action, expected result, target, and constraints.                   | Working directory and accepted initial scenario. See sections 1–2.                               |
| Prototype | Select relevant profiles and run the first journey on its real surface. Add native tasks once they have inputs.                          | Observable result with runtime and any simulated dependencies identified. See sections 3–5.      |
| Iterate   | Make and demonstrate a scoped change. Exercise the reported fault and relevant existing behavior.                                        | Reproducible result and regression evidence. See section 5.                                      |
| Qualify   | Run `mise run verify` and `mise run qualify` against the same candidate. Reinstall in a clean checkout and compare source and lockfiles. | Native results, negative cases, and applicable independent review. See sections 6–12.            |
| Accept    | Check the exact change and approved scope. Record the candidate, tool versions, evidence, review, and remaining limitations.             | A usable artifact and a report the owner can check. See sections 13–14.                          |
| Release   | Apply the authorized publication or deployment procedure and verify the running version.                                                 | Identity, tested recovery path, and observed post-release behavior. See sections 11, 13, and 14. |
| Recover   | Reinspect source and reports first. Reproduce failure, protect current state, and rerun invalidated checks.                              | Observed state, correction, and new results for the affected gates. See sections 10 and 13–14.   |

Select profiles using blueprint section 3.1. Section 15 maps the controls to their proof. An expected check that cannot run is blocked or incomplete. Record the exact missing input, environment, or capability and continue independent work.
