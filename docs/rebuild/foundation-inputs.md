# Rill upstream engineering facts

Second distillation. Research and local observation date: **2026-10-21**.

Scope: the engineering capabilities needed by the [current rebuild plan](../../rill-rebuild-plan.md) and [Codex capability map](../capability-map.md). The [kernel](../policy.md) is the sole policy authority. This document supplies revisable evidence; it neither defines additional policy nor activates the remaining implementation.

## Reading the evidence

**Published capability** means the named upstream owner documents the interface. **Local observation** means the specific metadata or command below was actually read. **Behavioral verification** requires exercising the relevant path in the selected App mode. These are different levels of evidence.

Rill is centered on official Codex in the official desktop app, with a native capability map and Matt Pocock skills as its foundation. Each capability below names its applicable surface. A Codex CLI option, a local executable, a Claude Code feature, and a hosted Work capability are not interchangeable. Documentation on a moving URL describes the page inspected on the access date; it is not automatically a version-pinned specification of the installed app.

OpenAI is the authority for its App and agent interfaces; GitHub for its platform and CLI; Google for its own published tools and guidance. Other tools are sourced from their actual maintainers. Hosting a project on GitHub does not make it a GitHub product or recommendation. Numerical project thresholds and workflow preferences remain owner requirements in the plan, not universal engineering facts.

## 1. Official Codex and its native capabilities

| Purpose                                   | Published capability and native entry point                                                                                                                                                                                                                                                                                                                                                               | Boundary relevant to Rill                                                                                                                                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identify the primary platform**         | OpenAI describes Codex as the desktop-app surface for local repositories, terminals and development tools. Its current product guidance also distinguishes Chat and Work within the app. [O1][]                                                                                                                                                                                                           | Rill's selected center is Codex. Record the actual Codex project and execution location before applying a configuration claim; another experience in the same app does not inherit every Codex capability.                                                                       |
| **Configure local Codex through the App** | Codex agents in the app share the CLI/IDE configuration system. The App exposes common settings; `config.toml` covers advanced options. Its MCP settings also use that configuration. [O2][]                                                                                                                                                                                                              | This documented sharing does not extend every local configuration to hosted Work. Reading a CLI help page does not show the effective configuration or active model in an App thread.                                                                                            |
| **Load repository instructions**          | Codex discovers `AGENTS.override.md`, then `AGENTS.md`, then configured fallback names along the project-root-to-working-directory path, taking at most one per directory. More local guidance follows broader guidance. `project_doc_max_bytes` defaults to 32 KiB for the combined instruction input. [O3][]                                                                                            | This is an instruction-loading limit, not a limit on all Markdown. The Rill entry file points to the kernel; its presence is not proof that every mode loaded it or that any mechanical check executed.                                                                          |
| **Select the actual project context**     | In a local App project, the primary folder determines new chats' working directory and Codex's automatic discovery of `AGENTS.md`, skills and `config.toml`. Secondary folders remain accessible but do not supply automatically discovered project configuration. Conversation sync and project-file access are separate. [O8][]                                                                         | Rill's project root must be the relevant primary folder for these discovery claims. A resumed conversation is not proof that the same files, tools or Git state are available.                                                                                                   |
| **Use native skills**                     | Standalone skills are documented for the desktop app, CLI and IDE. Plugin-bundled skills also work in Chat and Work across web, desktop and mobile. A skill uses `SKILL.md` with `name` and `description`; the host initially reads metadata and loads full instructions when selected. [O4][]                                                                                                            | A listed skill is discoverable context, not evidence of invocation or successful tool execution. The installed Matt skills fit this native extension model; their use does not require a Rill scheduler or a duplicate lifecycle engine.                                         |
| **Delegate within the host**              | Codex supports project-scoped `.codex/agents/*.toml` roles. Its `agents.max_concurrent_threads_per_session` caps concurrently open spawned threads, excluding the primary. Custom agents inherit parent permissions, provider and MCP connections. Hosted Work uses its own available tools and permission surfaces. [O5][]                                                                               | A role described as read-only does not create a separate sandbox. The documented thread cap does not establish an exact direct-child topology or a prohibition on nesting. Host model labels must not be assumed to be API identifiers.                                          |
| **Understand the hook boundary**          | Supported local Codex and local-only Work workflows can use native lifecycle hooks. Codex's project entries include `.codex/hooks.json` and `[hooks]` in configuration. Work Cloud does not load local configuration, plugin or directory hooks, even when tools execute locally. Its managed remote MCP hooks have enterprise prerequisites; personal accounts do not use those enterprise hooks. [O6][] | New or changed untrusted local hooks can be skipped. Callback errors, timeouts or malformed output can fail a hook without blocking a tool; only supported denial behavior establishes blocking. This is not an App-wide guarantee that every edit or tool call is intercepted.  |
| **Review through the official App**       | The desktop app includes the Code Review plugin for PR descriptions, changes, comments and checks. Codex's built-in `/review` examines a selected local Git diff without changing the working tree. The App review pane distinguishes unstaged, staged, commit and branch views. [O7][]                                                                                                                   | The PR plugin and local `/review` have different inputs. Reviewing in chat does not itself post a comment, approve or merge. Account access and actual revision still matter. Current App documentation does not make `gh` installation a prerequisite for the included PR view. |
| **Run common actions and Git operations** | Codex in the official App provides local-environment actions in the integrated terminal and setup actions for new worktrees. Its Git controls support inspecting changes, staging/reverting hunks or files, committing, pushing and creating PRs; other Git commands use the integrated terminal. [O9][]                                                                                                  | These are native execution and interaction points, not proof that an action runs automatically after every Agent edit. Their availability does not authorize installation, setup execution or remote writes.                                                                     |

**Application to the plan:** published App support determines the implementation path. The plan's requested controls remain unverified until their actual surface is established. A missing native control is grounds to revise or remove the requirement under the kernel; it is not a task to reproduce the App's control plane.

## 2. GitHub: authoritative objects and readback

GitHub Issues, native relations, commits, PRs, reviews and statuses are the execution record. App integrations and CLI commands are access methods, not another database.

| Capability                 | Published upstream behavior                                                                                                                                                              | Rill interpretation                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy and dependencies | GitHub CLI **v2.94.0**, announced **2026-06-10**, added native issue parent/sub-issue, type and dependency options. Current `gh issue edit` documents the supported flags. [G1][] [G2][] | Use actual relations; mention text is not a dependency edge. Feature availability still depends on the repository.                                                        |
| Read issue state           | `gh issue view --json` exposes `parent`, `subIssues`, `blockedBy`, `blocking`, labels, milestones and PR-related fields. [G3][]                                                          | Read back repository identity, edge direction and complete state after an authorized change.                                                                              |
| Issue → PR linkage         | GitHub supports Development links and closing keywords in PR descriptions; closing-keyword behavior depends on the PR base/default branch. [G4][]                                        | A mere URL mention, closing reference, linked PR and closed Issue do not mean the same thing.                                                                             |
| Revision-specific review   | `gh pr view --json` includes head/base OIDs, reviews and check rollups; PR review API has reviewer/state and commit association. [G5][] [G6][]                                           | Verify the reviewed SHA. Independent agent analysis and GitHub approval have different identities and authority.                                                          |
| Protection and checks      | Branch protection can require reviews or checks and dismiss stale approvals; commit statuses identify pending/success/failure/error per commit. [G7][] [G8][]                            | No repository enforcement, CI execution, branch policy or status publication was inspected or activated here. Local exit codes do not become server checks automatically. |

## 3. Mechanical tools: supported behavior, not an installation mandate

Use a tool only when the real source type, consumer and native invocation require it. Historical version pins from unrelated projects are not Rill defaults. Commands below are documented examples, not commands executed in this preparation.

| Concern              | Native upstream fact and interface                                                                                                                                                                       | Boundary for Rill                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shared formatting    | EditorConfig provides properties to supporting consumers. Biome reads only a subset with `formatter.useEditorconfig` enabled (default: false); its own config takes precedence. [T1][] [T2][]            | A convention file does not run a formatter or prove formats converge.                                                    |
| Web-code/JSON-family | Standalone Biome `ci` checks without writing; `format --write` writes. Selecting staged paths does not establish index-blob isolation. [T3][]                                                            | One writer per format; verify exact bytes, target and exits. Do not introduce Node solely for this executable.           |
| Markdown             | markdownlint-cli2 has check/fix behavior and configuration that can enable writing. [T4][]                                                                                                               | Confirm effective options before labeling a command read-only.                                                           |
| YAML                 | Google's `yamlfmt` rewrites by default; `-lint` and `-dry` are distinct; `-conf` selects config. [T5][]                                                                                                  | A printed diff is not necessarily a blocking result. Test check and fix separately.                                      |
| TOML                 | Taplo offers `fmt --check` and normal write mode. [T6][]                                                                                                                                                 | Formatted TOML does not prove Codex recognized or loaded the options.                                                    |
| Python               | Ruff `format` writes, `format --check` checks, and some lint rules can conflict with formatting. [T7][]                                                                                                  | Choose a coherent config and one writer, separate semantic tests.                                                        |
| Locked environments  | `pnpm install --frozen-lockfile` still installs; `uv run` may lock/sync; `--locked`, `--frozen`, `--no-sync` differ. [T8][] [T9][]                                                                       | Separate provisioning from read-only source checks.                                                                      |
| Type and tests       | TS `noEmit` suppresses normal output, but incremental options may write `.tsbuildinfo`. `vitest run` executes once; pytest returns 5 if no tests were collected. [T10][] [T11][] [T12][] [T24][] [T25][] | A type-check success or empty test suite is not evidence of task acceptance.                                             |
| LOC and CCN          | Tokei counts code/comment/blank lines; Lizard measures CCN and has threshold options. [T13][] [T14][]                                                                                                    | **500 code LOC** and **CCN 15** are owner thresholds, not upstream standards. Actual file scope and blocking need proof. |
| Security diagnostics | Semgrep findings can exit 0 unless `--error`; Trivy finding exits are configurable; Gitleaks has different history/directory/stdin modes. [T15][] [T16][] [T17][]                                        | Exit 0 alone is not proof of no findings. Verify selected scanner inputs and failure rules.                              |
| Tasks and hooks      | Just recipe working directories, Lefthook shell dispatch and `stage_fixed` are documented. [T18][] [T19][] [T20][]                                                                                       | These tools are optional; path selection is not a protected Git index snapshot.                                          |
| Git staging          | `git add` copies current bytes; `add -p` selects hunks; `diff --cached` and worktree diff differ. Actual `pre-commit` is a Git event and can be bypassed with `--no-verify`. [T21][] [T22][] [T23][]     | Prove state preservation with a real edit/commit scenario; do not infer enforcement from command names.                  |

## 4. Other upstream engineering guidance (not Codex APIs)

| Publisher                                                          | Relevant documented distinction                                                                                                          | Use for Rill                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic — _Demystifying evals for AI agents_ (2026-01-09) [E1][] | Agent transcript and final environment outcome are separate evaluation objects; code, model and human graders test different properties. | Verify delivered files and GitHub state, not an Agent's assertion that it completed a step. This guidance does not add an evaluation service. |
| Anthropic — _Claude Code hooks_ [E2][]                             | Model judgment, command execution and failure/blocking behavior differ by hook type and configuration.                                   | Useful comparison for distinguishing guarantees; Claude Code hooks are **not** Codex interfaces or Rill configuration inputs.                 |
| Google — _What to look for in a code review_ [E3][]                | Design, functionality, complexity, tests and documentation need semantic review beyond mechanical linting.                               | Review the actual change against its spec; do not import another organization's review ceremony or style tools.                               |
| Google — _How Much Testing is Enough?_ (2021-06-15) [E4][]         | Unit, integration and real-user-path tests provide different evidence; line coverage cannot establish correct behavior.                  | Use a real owner's macOS Codex workflow to establish end-to-end acceptance and focused negative cases for failure paths.                      |

## 5. Local engineering observations from the earlier read-only investigation

These are historical observations from **2026-10-21**, not pinned requirements or a substitute for App-execution verification.

| Observed object      | Observation                                                                                    | Verification limit                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Official desktop App | `/Applications/ChatGPT.app`; bundle `com.openai.codex`, version `26.1013.40934`, build `20770` | App bundle metadata; not proof of an active project, settings or permissions.                         |
| Codex CLI            | `codex-cli 0.163.0`                                                                            | Version/help output; not effective settings in the App thread.                                        |
| GitHub CLI           | `gh 2.102.0 (2026-09-30)`                                                                      | Version/help output; supported JSON fields were advertised, not tested on a live Issue in this round. |
| Git                  | `2.56.0`                                                                                       | Version output; no real commit hook or partial-stage acceptance was run.                              |
| Just and Ruff        | `just 1.59.0`; `ruff 0.17.1`                                                                   | Executable versions were observed; no recipe or formatting test was run.                              |
| Command-search path  | Lefthook, Biome, yamlfmt, EditorConfig Checker were not found                                  | Only PATH lookup, not evidence of absence across the whole Mac.                                       |

## 6. Next verification targets, not claimed achievements

1. In **the actual Codex App project**, confirm the primary folder, loaded `AGENTS.md`, reachable kernel, available skills and each needed native tool.
2. Select one real owner task and freeze observable acceptance. Test edits, actual formatter/checker execution, repeated idempotence, one explicit repair and failure/reporting behavior.
3. If applicable, verify a real Git pre-commit event, partial staging, no unexpected mutation of worktree/index, and 500/501 code-LOC and 15/16 CCN boundaries **only where native tools can support the chosen semantics**.
4. Use authorized GitHub native objects and read back Issue hierarchy, dependencies, candidate revision, PR review and checks; never infer enforcement from text labels.
5. Test interruption/incorrect directory/configuration failure in a disposable scope; preserve uncommitted work. If a claimed guarantee has no native path, simplify or remove it under the kernel rather than writing a compatibility mechanism.

This second distillation captures published engineering capabilities and bounded read-only observations. No model-routing configuration, hook, package installation, PR, deployment, recovery exercise or end-to-end workflow was activated here.

## Sources — first-party publications and exact interfaces

These are the documentation surfaces consulted during this research (2026-10-21). Undated documentation is a **moving page**, not a pinned guarantee for the installed App build.

### OpenAI — Codex/ChatGPT host capabilities

[O1]: https://help.openai.com/en/articles/20001276-moving-to-the-new-chatgpt-desktop-app
[O2]: https://learn.chatgpt.com/docs/developer-settings?surface=app
[O3]: https://learn.chatgpt.com/docs/agent-configuration/agents-md
[O4]: https://learn.chatgpt.com/docs/build-skills
[O5]: https://learn.chatgpt.com/docs/agent-configuration/subagents
[O6]: https://learn.chatgpt.com/docs/hooks
[O7]: https://learn.chatgpt.com/docs/code-review?surface=app
[O8]: https://learn.chatgpt.com/docs/projects?surface=app
[O9]: https://learn.chatgpt.com/docs/environments/local-environment

### GitHub — native issue, PR and enforcement semantics

[G1]: https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/
[G2]: https://cli.github.com/manual/gh_issue_edit
[G3]: https://cli.github.com/manual/gh_issue_view
[G4]: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
[G5]: https://cli.github.com/manual/gh_pr_view
[G6]: https://docs.github.com/en/rest/pulls/reviews
[G7]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
[G8]: https://docs.github.com/en/rest/commits/statuses

### Tool maintainers and Git — command semantics

[T1]: https://editorconfig.org/
[T2]: https://biomejs.dev/reference/configuration/
[T3]: https://biomejs.dev/reference/cli/
[T4]: https://github.com/DavidAnson/markdownlint-cli2
[T5]: https://github.com/google/yamlfmt/blob/main/docs/command-usage.md
[T6]: https://taplo.tamasfe.dev/cli/usage/formatting.html
[T7]: https://docs.astral.sh/ruff/formatter/
[T8]: https://pnpm.io/cli/install
[T9]: https://docs.astral.sh/uv/concepts/projects/sync/
[T10]: https://www.typescriptlang.org/tsconfig/noEmit.html
[T11]: https://vitest.dev/guide/cli.html
[T12]: https://docs.pytest.org/en/stable/reference/exit-codes.html
[T13]: https://github.com/XAMPPRocky/tokei
[T14]: https://github.com/terryyin/lizard
[T15]: https://docs.semgrep.dev/cli-reference
[T16]: https://trivy.dev/docs/latest/configuration/others/
[T17]: https://github.com/gitleaks/gitleaks
[T18]: https://just.systems/man/en/working-directory.html
[T19]: https://lefthook.dev/configuration/run/
[T20]: https://lefthook.dev/configuration/stage_fixed/
[T21]: https://git-scm.com/docs/git-add
[T22]: https://git-scm.com/docs/git-diff
[T23]: https://git-scm.com/docs/githooks
[T24]: https://www.typescriptlang.org/tsconfig/incremental.html
[T25]: https://www.typescriptlang.org/tsconfig/tsBuildInfoFile.html

### Attributed guidance (not host APIs)

[E1]: https://www.anthropic.com/research/demystifying-evals-for-ai-agents
[E2]: https://code.claude.com/docs/en/hooks-guide
[E3]: https://google.github.io/eng-practices/review/reviewer/looking-for.html
[E4]: https://testing.googleblog.com/2021/06/how-much-testing-is-enough.html
