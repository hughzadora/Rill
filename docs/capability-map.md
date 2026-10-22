# Rill — Codex capability map

Updated: 2026-10-22. Purpose: connect the owner's engineering workflow to official Codex capabilities and Matt Pocock skills without creating a second runtime.

**Authority:** [kernel](policy.md) > [rebuild plan](../rill-rebuild-plan.md). This map is an evidence-index and task router, not another policy source. Consult [upstream engineering facts](rebuild/foundation-inputs.md) before relying on any version-sensitive interface.

## Interpretation

- **Codex:** official host, workspace, instructions, native tools, execution, review and permissions.
- **Matt skills:** engineering method selected for the task, not a substitute for platform actions or authority.
- **GitHub:** native execution record (Issues, dependencies, commits, PRs and reviews); repository Markdown holds specifications.
- **Capability state:** _documented_ means an official source describes it; _available_ means a local interface was observed; _verified_ means the actual workflow ran and its result was checked. Do not treat these states as equivalent.

## Task-to-capability mapping

| Goal                                                 | Official Codex / GitHub entry                                                                 | Matt skill (when relevant)                         | Evidence and boundary                                                                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Load the right instructions and files                | Codex App primary project folder; root `AGENTS.md`; supported config and skills discovery     | `writing-for-agents` for agent-facing instructions | [O2–O4, O8](rebuild/foundation-inputs.md). Project-root selection and loaded instructions still need a real App check.                                                   |
| Investigate upstream and current implementation      | Codex native research/tools and authorized repository inspection                              | `research`                                         | Primary-source claim → exact interface, version/surface, limitations, observation status. No other vendor's API is treated as Codex.                                     |
| Audit and distill raw requirements                   | Official research/tools, then native Codex selection only for essential unresolved choices    | `grilling` / `grill-with-docs` assumption testing  | Kernel section 2.2: clean pollution and model assumptions before promotion; no default interview, questionnaire or repeat approval.                                      |
| Capture scope and acceptance                         | Markdown specification and native GitHub Issue reference                                      | `to-spec`, `domain-modeling`                       | No duplicate JSON/YAML status or a second spec authority. Publishing an Issue needs authorization.                                                                       |
| Select architecture or an interface                  | Native workspace source, tests and review                                                     | `codebase-design`, `domain-modeling`               | Prefer supported upstream/native behavior; reject speculative adapters.                                                                                                  |
| Reduce a design unknown                              | Disposable native local worktree and test                                                     | `prototype`                                        | Prototype is disposable evidence, not automatically production code.                                                                                                     |
| Define actionable implementation pieces              | GitHub parent/sub-issue and dependency links                                                  | `to-tickets` when justified                        | Real native relations, verified after an authorized write. No parallel tracker.                                                                                          |
| Route work by owner priority                         | Native GitHub Issue priority metadata: P0–P4 per Google's published scheme                    | `to-tickets` after owner decision                  | Google's P2 is its system default, **not** permission for the Agent to choose any priority. Read, validate and preserve the owner's value. [Policy §3.5](policy.md)      |
| Enforce policy mechanically                          | Native Codex permissions, compiler, schema validator, tests, Git/GitHub check surfaces        | `tdd` for behavior evidence, not permission policy | Test real positive/negative cases and blocking behavior; documentation alone is not an enforced rule.                                                                    |
| Capture bounded execution evidence                   | Native Codex sandbox/terminal, structured tool results, native trace/log paths when available | `diagnosing-bugs` on ambiguous failures            | Model receives compact result plus raw-evidence reference; no independent Rill harness or unbounded automatic retry.                                                     |
| Implement behavior                                   | Codex edit/terminal/worktree actions; actual project tools                                    | `implement`, `tdd`, `implement-spec`               | Verify commands and output in the selected environment. Do not manufacture a Rill execution engine.                                                                      |
| Diagnose unexpected results                          | Codex terminal/tests/diff and relevant upstream documentation                                 | `diagnosing-bugs`                                  | Preserve reproduction, competing hypotheses, changed-file evidence and observed outcome.                                                                                 |
| Perform mechanical checking                          | Rill justfile, TS7/Vitest/Biome/Knip/Tokei/Lizard/Lychee/Gitleaks/Trivy and native Git hooks  | `tdd` as method, not formatter                     | Use documented native CLI gates in [engineering loop](engineering-loop.md). Local Git-event evidence does not claim remote or App-wide enforcement.                      |
| Review the candidate revision                        | Actual native Codex reviewer thread against the same candidate; authorized GitHub PR record   | `code-review` Standards and Spec methods           | Reviewer differs from author. Same-context role-play is not independent review. Native activity/result evidence required; third-party human independence is not claimed. |
| Deliver, learn and recover                           | Native Git worktree/index, Issue/PR links, README and current files                           | `retro`, `handoff` when needed                     | Re-read current state; a conversation summary is not a checkpoint engine.                                                                                                |
| Obtain essential information or high-risk permission | Native Codex structured selection or platform permission control                              | No wizard or scripted questionnaire by default     | Kernel section 2.3: concise choices only; payment/upgrade declined by default; unavailable control blocks only the dependent action.                                     |

## Owner context and execution boundaries

The [kernel owner contract](policy.md#21-owner-context-and-priorities) governs all routes: part-time non-developer, budget/agility first inside safety and correctness, GitHub Free private baseline, minimal owner interruption and maintained upstream naming. Use real native multi-agent threads with the kernel's bounded concurrency and single-writer rule; no role-play or custom orchestration. Each job carries a distilled question, candidate revision, write scope and verifiable result; send summaries rather than full traces.

Native choice UI, actual multi-agent execution and quota telemetry require verification in the selected Codex host. Paid private-repository branch protection/rulesets, required human review teams and mandatory remote CI/CD are **out of scope**, not missing acceptance gates. Existing upstream facts about those features are conditional product information, not requirements for this account.

## Non-goals and selection rules

The map does **not** prescribe installing every skill, configuring hooks automatically, building custom orchestration, duplicating GitHub state, using every available tool, or claiming that a skill invocation enforced a policy.

Pick the smallest applicable native path for a real task. Where a native interface cannot support a demanded guarantee, revise or drop that requirement under the kernel; document the gap and do not implement a compatibility layer.

## Verification status

- **Documented:** Codex project instructions, skills, local tools, hooks and review; GitHub issue hierarchy/dependencies and PR relationships. See [foundation-inputs](rebuild/foundation-inputs.md).
- **Observed locally in earlier read-only research:** Codex CLI and GitHub CLI version/help, the installed App bundle metadata. These observations do not prove execution inside an App thread.
- **Verified locally:** single Biome formatter (including Markdown), markdownlint, TS7 strict checks, Vitest + Ajv, Just, Knip, Tokei 500 LOC, Lizard CCN 15, offline Lychee, Gitleaks staged/history, Trivy high/critical scan with devDependencies, Husky pre-commit/pre-push behavior and coverage-threshold negative cases. See [engineering loop](engineering-loop.md).
- **Not yet verified:** primary-folder and skill discovery in the actual Codex App, native choice UI, distinct worker/reviewer thread execution, effective model/concurrency settings, usage visibility and budget behavior, GUI PATH, authorized GitHub delivery records, interrupted-session recovery and end-to-end delivery.

## Native sources

OpenAI: [App/project documentation](https://learn.chatgpt.com/docs/projects?surface=app), [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), [hooks](https://learn.chatgpt.com/docs/hooks), [code review](https://learn.chatgpt.com/docs/code-review?surface=app). GitHub: [Issue hierarchy release](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/), [Issue edit CLI](https://cli.github.com/manual/gh_issue_edit). Matt: [source repository](https://github.com/mattpocock/skills) and the installed matching skill instructions.
