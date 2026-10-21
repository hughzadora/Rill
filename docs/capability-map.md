# Rill — Codex capability map

Prepared: 2026-10-21. Purpose: connect the owner's engineering workflow to official Codex capabilities and Matt Pocock skills without creating a second runtime.

**Authority:** [kernel](policy.md) > [rebuild plan](../rill-rebuild-plan.md). This map is an evidence-index and task router, not another policy source. Consult [upstream engineering facts](rebuild/foundation-inputs.md) before relying on any version-sensitive interface.

## Interpretation

- **Codex:** official host, workspace, instructions, native tools, execution, review and permissions.
- **Matt skills:** engineering method selected for the task, not a substitute for platform actions or authority.
- **GitHub:** native execution record (Issues, dependencies, commits, PRs and reviews); repository Markdown holds specifications.
- **Capability state:** *documented* means an official source describes it; *available* means a local interface was observed; *verified* means the actual workflow ran and its result was checked. Do not treat these states as equivalent.

## Task-to-capability mapping

| Goal | Official Codex / GitHub entry | Matt skill (when relevant) | Evidence and boundary |
| --- | --- | --- | --- |
| Load the right instructions and files | Codex App primary project folder; root `AGENTS.md`; supported config and skills discovery | `writing-for-agents` for agent-facing instructions | [O2–O4, O8](rebuild/foundation-inputs.md). Project-root selection and loaded instructions still need a real App check. |
| Investigate upstream and current implementation | Codex native research/tools and authorized repository inspection | `research` | Primary-source claim → exact interface, version/surface, limitations, observation status. No other vendor's API is treated as Codex. |
| Resolve real requirement ambiguity | Native Codex chat and owner choice when facts cannot decide | `grilling` or `grill-with-docs` | Agent investigates facts first; owner decides material tradeoffs, not routine technical details. |
| Capture scope and acceptance | Markdown specification and native GitHub Issue reference | `to-spec`, `domain-modeling` | No duplicate JSON/YAML status or a second spec authority. Publishing an Issue needs authorization. |
| Select architecture or an interface | Native workspace source, tests and review | `codebase-design`, `domain-modeling` | Prefer supported upstream/native behavior; reject speculative adapters. |
| Reduce a design unknown | Disposable native local worktree and test | `prototype` | Prototype is disposable evidence, not automatically production code. |
| Define actionable implementation pieces | GitHub parent/sub-issue and dependency links | `to-tickets` when justified | Real native relations, verified after an authorized write. No parallel tracker. |
| Route work by owner priority | Native GitHub Issue labels `priority:P0` to `priority:P3`; one approved label for each active item | `to-tickets` only after the owner sets priority | Agent reads and validates owner-declared priority, never chooses/defaults it; untriaged items cannot enter implementation. [Policy §3.5](policy.md) |
| Enforce policy mechanically | Native Codex permissions, compiler, schema validator, tests, Git/GitHub check surfaces | `tdd` for behavior evidence, not permission policy | Test real positive/negative cases and blocking behavior; documentation alone is not an enforced rule. |
| Capture bounded execution evidence | Native Codex sandbox/terminal, structured tool results, native trace/log paths when available | `diagnosing-bugs` on ambiguous failures | Model receives compact result plus raw-evidence reference; no independent Rill harness or unbounded automatic retry. |
| Implement behavior | Codex edit/terminal/worktree actions; actual project tools | `implement`, `tdd`, `implement-spec` | Verify commands and output in the selected environment. Do not manufacture a Rill execution engine. |
| Diagnose unexpected results | Codex terminal/tests/diff and relevant upstream documentation | `diagnosing-bugs` | Preserve reproduction, competing hypotheses, changed-file evidence and observed outcome. |
| Perform mechanical checking | Direct native formatter/linter/test commands; optional documented Git/Codex hooks | `tdd` as method, not formatter | Hooks and checks have distinct interception, failure and file-mutation semantics; do not claim App-wide enforcement. |
| Review the candidate revision | Codex `/review` or App diff; native GitHub PR/review objects | `code-review` for Standards + Spec axes; `pr` for PR body | Model review, human approval and GitHub review status are distinct. Check actual candidate SHA. |
| Deliver, learn and recover | Native Git worktree/index, Issue/PR links, README and current files | `retro`, `handoff` when needed | Re-read current state; a conversation summary is not a checkpoint engine. |
| Guide exceptional human-only action | Native permission/choice UI with precise impact and rollback | `wizard` only for unavoidable owner-operated steps | Never transfer routine formatting, commands or tool coordination to the owner. |

## Non-goals and selection rules

The map does **not** prescribe installing every skill, configuring hooks automatically, building custom orchestration, duplicating GitHub state, using every available tool, or claiming that a skill invocation enforced a policy.

Pick the smallest applicable native path for a real task. Where a native interface cannot support a demanded guarantee, revise or drop that requirement under the kernel; document the gap and do not implement a compatibility layer.

## Verification status

- **Documented:** Codex project instructions, skills, local tools, hooks and review; GitHub issue hierarchy/dependencies and PR relationships. See [foundation-inputs](rebuild/foundation-inputs.md).
- **Observed locally in earlier read-only research:** Codex CLI and GitHub CLI version/help, the installed App bundle metadata. These observations do not prove execution inside an App thread.
- **Not yet verified:** primary-folder discovery in a real Codex thread, specific skill invocation, configured model/effort, real formatter/hook execution, partial-staging behavior, GitHub write/readback, interrupted-session recovery and end-to-end delivery.

## Native sources

OpenAI: [App/project documentation](https://learn.chatgpt.com/docs/projects?surface=app), [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), [hooks](https://learn.chatgpt.com/docs/hooks), [code review](https://learn.chatgpt.com/docs/code-review?surface=app). GitHub: [Issue hierarchy release](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/), [Issue edit CLI](https://cli.github.com/manual/gh_issue_edit). Matt: [source repository](https://github.com/mattpocock/skills) and the installed matching skill instructions.
