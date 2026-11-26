# Modern AI-DLC Engineering Master Blueprint
## Greenfield Agent Execution Manual

- **Revision date** 2026-11-27 (Asia/Singapore)
- **Audience** Implementation agents, independent reviewers, and the product owner
- **Scope** A new software project starting from an empty authorized workspace. Later changes use the same qualified checks.
- **Document status** Greenfield revision 3, second-pass audit, Codex-ready. Earlier project-specific requirements and operating methods are superseded. This is an execution standard and a reference for its native tool configuration. Product requirements and installation evidence come from the current task.

> Deliver an observable prototype first. Iterate through working product increments. Enforce mechanical requirements with native tools, verify behavior against independent acceptance criteria, and retain evidence for the exact candidate being accepted.

This manual replaces the earlier conceptual blueprint. Its execution order, tool ownership, default profiles, failure handling, and acceptance rules are decisions to follow, not topics to redesign during each task. Product-specific behavior still comes from the approved task. A generic manual cannot invent the correct business outcome or prove that an agent understands it.


## Reading route

1. Start with **Section 1** and execute the empty-project/resume branches in **Section 2**.
2. Select only the profiles required by the new product in **Section 3**. Establish their real tasks in **Section 4** as real source and tests are created.
3. Implement and demonstrate the first approved behavior in **Section 5**. Read only its activated recipes in **Sections 6–11**.
4. Complete the new-project qualification in **Section 12**; inspect the candidate and perform only requested external actions under **Section 13**.
5. Report the exact result using **Section 14**. Use **Section 15** to locate a control and **Section 16** for upstream documentation.

Keep a repository's `AGENTS.md` short: point to the local copy of this manual, the actual task entry points, and the current product brief. Codex may discover global, ancestor and nested instructions, including overrides; inspect effective instructions for the actual working directory. Do not edit user-global instructions or treat an inherited instruction as permission to reconstruct a deleted project. Resolve conflicting task-owned instructions before execution; report a genuine higher-priority conflict rather than silently bypassing it. Store executable settings in native files. Read activated recipes only; do not load the whole reference manual into every routine editing turn. [S21]

---

## 1. Execution contract

### 1.1 Responsibilities and authority

| Actor | Required work | Completion condition |
| --- | --- | --- |
| Product owner | Supply intended outcome, essential product decisions, and exceptional authorization. | The agent has enough information to produce a reviewable result. Routine tooling and debugging are not delegated back to the owner. |
| Implementation agent | Inspect, configure, implement, run checks, diagnose, demonstrate, and preserve evidence. | The approved outcome and all applicable checks have actual results. |
| Independent reviewer, when Section 9 is triggered | Read the current acceptance source and candidate independently; examine behavior and verification changes. | A real separate review identifies its scope, reviewed candidate, findings, and disposition. No fixed team, role chain, or orchestration system is prescribed. |
| Native tools | Compile, format, analyze, test, validate schemas, compare artifacts, and execute CI. | Their actual output, scope, and exit status support the claimed result. |
| Platform | Enforce available permissions, branch controls, isolation, and publication restrictions. | Enforcement is observed or its absence is explicitly recorded. A written instruction does not count as platform enforcement. |

Use existing authorization. Continue safe independent work when one action is blocked. Purchases, upgrades, new paid providers, publication, production effects, and destructive operations require their applicable authorization. A selected technology does not authorize spending.

The operational defaults below are this manual's engineering policy. They are not presented as upstream defaults or universal industry guarantees.

### 1.2 Results that may be reported

| Result | Exact meaning | May satisfy a required gate? |
| --- | --- | --- |
| PASS | The required command or behavioral check actually ran on the candidate, exercised the intended inputs, and met its acceptance condition. | Yes. |
| FAIL | The check ran and rejected the candidate. | No. |
| BLOCKED | A required tool, environment, access, supported feature, reviewer, or necessary product decision is unavailable. | No. |
| NOT APPLICABLE | The reviewed activation rule is false, with repository evidence. | Only for that inapplicable check. |
| NOT RUN | No valid result exists yet, including interrupted, cancelled, stale, skipped, or empty execution. | No. |

These are reporting terms, not a new workflow engine. Use native test reports and task outputs. Use an issue/PR or hosted checks only when those actually exist.

Keep these claims distinct:

- **Configured:** a rule or workflow exists.
- **Executed:** the tool ran with known inputs.
- **Verified:** the required positive and negative behavior was observed.
- **Enforced:** a platform control prevents acceptance or the protected action without the result.

A configuration file proves only the first claim. A successful process with no relevant inputs proves neither coverage nor correctness.

### 1.3 Required gate semantics

A required gate passes only when all of the following are true:

1. The expected executable and locked version ran.
2. The applicable configuration and target list match the candidate.
3. Required inputs and tests were discovered; none disappeared through a changed glob, ignore file, task name, or package selection.
4. Diagnostics and exit status were preserved.
5. The checker completed without a relevant parser error, timeout, unsupported input, or missing dependency.
6. Required reports were freshly created or retrieved from a valid native cache with matching declared inputs.
7. The acceptance condition is satisfied.
8. Verification infrastructure and acceptance changes have the review required by Section 9.

Do not substitute an empty suite, `echo` command, cached summary, report file copied from another revision, or a narrower test invocation for the required task. Before and after read-only acceptance, compare candidate tracked bytes, staged state and relevant untracked inputs. Reports/build products are confined to declared outputs. Unexpected mutation invalidates the affected result. Native reports and a candidate-controlled inventory are evidence, not a tamper-proof external authority. A pending external dependency remains BLOCKED; continue unrelated work.


### 1.4 Standing engineering decisions

- **TypeScript checking uses `tsrs`.** Qualify its real target configuration; keep it as the sole checking authority.
- Use Oxfmt as the sole formatter for its supported authored text scopes. JS projects use the pinned project package; non-JS projects may use the pinned standalone binary for its native formats. Activate each other language's assigned native formatter only when that language exists.
- Use upstream tools and supported platform capabilities for compilation, formatting, testing, task execution, permissions, and hosting.
- Select language, application runtime, UI/API/CLI shape, persistence, and distribution from the new product's requirements. This manual does not preselect them.
- Keep bootstrap, toolchain qualification, first working behavior, and complete product acceptance as distinct results.
- Existing local files, user data, credentials, and unrelated work remain outside a new-project operation unless expressly included.
- Local hooks provide feedback; actual platform controls are required for an enforcement claim.

The execution agent owns routine installation, configuration, diagnosis and verification. Ask the owner only for a consequential product fact that is not derivable, an unavailable target identity, or an action requiring protected authorization. Do not ask the owner to choose every package, run commands, or design tests.

---


## 2. Start from the actual workspace state

### 2.1 Resolve the target and inspect capabilities

Execute in order:

1. Read the current task, this manual, and any newly supplied product brief. Read repository instructions only if the intended project already has them. An issue, `AGENTS.md`, architecture document, remote, and previous commit are optional at first entry.
2. Resolve one authorized project directory from the user's selected workspace or task. Use its absolute physical path as `PROJECT_ROOT`. If the platform has an authorized new-project output directory, create an unused task directory there. Otherwise ask only for the missing target. Do not write into a guessed device directory or another repository.
3. Inspect available filesystem/terminal capabilities, OS, architecture, network restrictions, and `git`, `rg`, and `mise` availability. Use supported upstream installation for missing prerequisites within existing permissions. Use the environment's file listing if `rg` is absent. Never report a missing tool as installed.
4. Inspect directory contents before mutation, including configuration dot-directories. If it is occupied, classify the files as belonging to this task or preserve them and choose a new directory. Do not empty an occupied directory.
5. Run the read-only classifier below in Bash after Git is available. It requires an existing target directory and rejects an inherited parent repository, a bare repository, and an invalid `.git` marker.

Before running the classifier, resolve any task-injected `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`, or `GIT_INDEX_FILE` override so that normal discovery describes this directory. Do not change global Git settings to force a result. [S23]

```bash
set -euo pipefail
: "${PROJECT_ROOT:?Set to the observed authorized project directory}"
test -d "$PROJECT_ROOT"
PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" && pwd -P)"

if START_REPO_ROOT="$(git -C "$PROJECT_ROOT" rev-parse --show-toplevel 2>/dev/null)"; then
  START_REPO_ROOT="$(cd -- "$START_REPO_ROOT" && pwd -P)"
  if [ "$START_REPO_ROOT" != "$PROJECT_ROOT" ]; then
    printf '%s\n' 'BLOCKED: target is inside a different repository.' >&2
    exit 3
  fi
  if git -C "$PROJECT_ROOT" rev-parse --verify 'HEAD^{commit}' >/dev/null 2>&1; then
    printf '%s\n' 'COMMITTED'
  elif START_HEAD_REF="$(git -C "$PROJECT_ROOT" symbolic-ref -q HEAD)"; then
    if git -C "$PROJECT_ROOT" show-ref --verify --quiet "$START_HEAD_REF"; then
      printf '%s\n' 'BLOCKED: HEAD reference exists but its commit is invalid.' >&2
      exit 4
    else
      START_REF_STATUS="$?"
      if [ "$START_REF_STATUS" -eq 1 ]; then
        printf '%s\n' 'UNBORN'
      else
        printf '%s\n' 'BLOCKED: HEAD reference needs diagnosis.' >&2
        exit 4
      fi
    fi
  else
    printf '%s\n' 'BLOCKED: repository HEAD needs diagnosis.' >&2
    exit 4
  fi
else
  if START_BARE="$(git -C "$PROJECT_ROOT" rev-parse --is-bare-repository 2>/dev/null)" && [ "$START_BARE" = true ]; then
    printf '%s\n' 'BLOCKED: target is a bare repository.' >&2
    exit 4
  fi
  START_PARENT="$PROJECT_ROOT"
  while :; do
    if [ -e "$START_PARENT/.git" ] || [ -L "$START_PARENT/.git" ]; then
      printf '%s\n' 'BLOCKED: a Git marker exists but discovery failed.' >&2
      exit 4
    fi
    [ "$START_PARENT" = / ] && break
    START_PARENT="$(dirname -- "$START_PARENT")"
  done
  printf '%s\n' 'NO_GIT'
fi
```

The classifier is a discovery aid, not a product check. Preserve Git diagnostics for a rejected/corrupt state and diagnose it; do not reinterpret it as an empty project.

| Observed state | Next operation | Required condition |
| --- | --- | --- |
| `NO_GIT` in a new or confirmed task-owned directory | Initialize a new local repository under Section 2.3. | No unrelated content will be replaced. |
| `UNBORN` | Continue initial files and manifest setup in that directory. | No base SHA or linked worktree is required yet. |
| `COMMITTED` | Read actual state and resume under Section 2.4. | Candidate and unrelated changes are identified. |
| Wrong parent, bare, corrupt, inaccessible, or ambiguous target | Resolve only the target/access defect. | Do not reinitialize or delete it as a workaround. |

**Completion:** directory identity, repository state, available execution capabilities, and preserved existing files are known. A missing repository is a valid start state.

For every subsequent project command, set the execution tool's working directory to the observed absolute `PROJECT_ROOT`, or explicitly enter that directory in the current shell. Rebind required variables in each fresh shell. Running `git init` with a path does not change the caller's working directory.

### 2.2 Establish the new product input

Record the smallest sufficient brief in the current task; when source files are created, keep the durable product facts in `docs/PROJECT.md`.

| Fact | Required content |
| --- | --- |
| User and outcome | Who uses the product and the result they need. |
| First behavior | One input/action and its expected observable effect. |
| Surface and target | The necessary CLI, API, browser, library or other interface; actual supported runtime/platform. |
| Constraints | Explicit technology decisions, data/privacy requirements, spending boundary and out-of-scope work. |
| Evidence | The requirement-derived example or observation that accepts the first behavior. |

Derive routine implementation choices from that brief and current platform constraints. Record them as agent-selected engineering decisions. An engineering manual does not supply an absent product purpose.

If no product purpose has been provided, finish safe capability/target inspection and identify the missing input in one concise question. **Do not create an arbitrary application, resurrect a deleted product, select a business workflow, or count a “hello world” as product acceptance.** Product-dependent steps remain BLOCKED. A language-neutral project folder or notes may be prepared within the authorized target; no language/framework installation is needed until its profile is selected. If the current task expressly requests engineering foundation only and supplies its language/runtime, create and qualify that foundation with clearly labeled tool fixtures; do not invent product behavior or relabel qualification fixtures as product acceptance.

### 2.3 Initialize a new local project

**Inputs:** resolved task-owned directory, known first behavior, selected language/runtime, available Git and required runtime manager.

Execute in this order:

1. For `NO_GIT`, initialize local Git. For `UNBORN`, use the existing initialization. A remote repository is not required.
2. Select the smallest applicable profile using Section 3. One application/package is the default layout; add a workspace only when more than one real package is required.
3. Make the profile's runtime and initializer available using the verified installation owner. Initialize its native manifest: the selected framework's supported initializer or a minimal language initializer.
4. Inspect generated files. Remove only newly generated sample code, conflicting check commands, and irrelevant agent instructions. Keep required runtime/framework configuration. A scaffold's defaults do not override the current task or this manual.
5. Create the actual target configuration, the first approved behavior, and its meaningful test. Create only the directories those files use.
6. Install exact applicable tool dependencies; generate the first native lockfiles. Bind real scripts/tasks under Section 4. Frozen installation begins only after a lockfile exists.
7. Run the applicable current-file secret scan, formatter/checker/lint tasks, behavior test, and initial guardrail qualification. Follow Section 12 to complete the toolchain result.
8. Inspect exact staged contents and create a first commit containing the real project files when permitted. Use the environment's existing authorized commit identity; never invent an author or change global identity. An unavailable identity blocks the commit, not safe local implementation.
9. Record the new commit as the first local source snapshot and candidate, not an accepted product baseline. Only now use operations requiring a committed `HEAD`, historical baselines, or linked worktrees. Acceptance follows Section 12 and the triggered review; use an explicitly accepted previous revision for compatibility comparisons.

For a newly authorized directory, step 1 is:

```bash
: "${PROJECT_ROOT:?Set to the classified task-owned directory}"
git init --initial-branch=main "$PROJECT_ROOT"
```

Git initialization creates an unborn branch; it does not create a commit. Do not create an empty commit merely to satisfy an evidence field. Before the first commit, identify evidence with exact file paths and content digests and label the source `UNCOMMITTED`; do not advertise commit-bound or clean-checkout qualification yet. [S23]

**Completion:** actual source/configuration and meaningful tests exist; initial results and any remaining blockers are recorded. Initializing a directory, installing tools, qualifying checks, and implementing the requested behavior are separate facts.

### 2.4 Inspect or resume a committed repository

Only run the following after `COMMITTED` is observed:

```bash
git rev-parse --show-toplevel
git status --short
git worktree list --porcelain
git branch --show-current
git rev-parse HEAD
git remote -v
rg --files --hidden -g '!.git' -g '!node_modules' -g '!target' -g '!.venv'
```

Read the discovered current instructions, manifests, locks, tasks, workflows, and relevant product/design documents. Missing optional documents or a remote are not defects. Do not read unrelated project history to fill a new product's gaps.

Use the platform's existing isolated workspace. A linked worktree is optional and useful only when an existing committed repository must be isolated from other work. Before creating one, verify the base SHA, a free branch name, and an unused path. Never use `git reset --hard`, `git clean -fdx`, or history rewriting as routine preparation.

On resumption, verify that files and the candidate still match the reports. Rerun invalidated results. Preserve unrelated staged, unstaged, and untracked changes.

**Completion:** current source identity, applicable instructions, existing changes, and any remote are observed.

### 2.5 Bind inputs once

Use the current task and the native files. If no issue/PR exists, `docs/PROJECT.md` owns product facts and the task's result plus native reports owns execution evidence; do not introduce a parallel task system.

| Input | Resolution | Absent value |
| --- | --- | --- |
| Product outcome and cases | Section 2.2 and current explicit decisions. | Block dependent product choices; ask one essential question. |
| Source identity | Actual commit and dirty-file identity, or pre-commit file digests. | No fabricated base SHA. |
| Runtime and targets | New product constraints and selected supported platform. | Do not advertise unexecuted targets. |
| Activated checks | Approved capabilities plus actual source and stage, Section 3. | Planned but unimplemented scope is NOT RUN, not inapplicable. |
| Sensitive resources | Actual affected files, data, services and publication target. | Continue isolated work; hold dependent effects. |
| Commands | Native manifests and task files after initialization. | No placeholder success task. |
| Review | Section 9 triggers. | Report a required unavailable review as BLOCKED. |
| Remote/hosting | Current explicit hosting decision and observed access. | Local work continues; hosted CI/publishing remain unconfigured or NOT RUN. |

Resolve command placeholders from observed inputs before running a dependent operation. They are agent-owned bindings, not owner homework.

### 2.6 Turn behavior into observable acceptance

For each promised journey, record the starting state and actor, input/action, expected effect, relevant invalid-input result, state to preserve, actual verification surface, and the test/demonstration that proves it.

Use the approved behavior as the oracle. Expected results must not be computed by calling the production function under test. Keep test-oracle changes visible for Section 9 review.

**Completion:** each promised behavior has a falsifiable observable result and a verification method. Tools can check evidence and reject counterexamples; they cannot determine an unprovided business purpose or prove internal causal understanding.

---

## 3. Activate only the required profiles and tools

### 3.1 Activation table

Profiles are additive and driven by **new approved capability plus authored source**, not by the dependencies of a development tool. Evaluate them during bootstrap and when scope, source languages, interfaces, deployment or supported targets change.

Distinguish an inactive capability from unfinished work: an API outside approved scope is NOT APPLICABLE; an approved API not yet implemented is NOT RUN. It remains part of acceptance. Source absence does not erase promised scope.

Install initial prerequisites for the first real behavior first. Add deeper tools when their row activates, and complete all applicable qualification before claiming the integrated candidate passes. Removing an active check requires the review in Section 9.

| Evidence in repository or approved scope | Activate | Required native mechanisms |
| --- | --- | --- |
| Every initialized software project | Baseline | Git, mise for selected runtime/tool versions, Gitleaks over current files, real task exit-status checks; Section 9 review when triggered. |
| Authored Oxfmt-supported text, including configuration/docs in a non-JS project | Shared text formatting | One pinned Oxfmt distribution; standalone for native-only non-JS scope where supported; Section 6.2. |
| Resolved third-party dependencies | Dependency security | OSV-Scanner for supported JS/Python lockfiles; cargo-deny for Rust; actual supported scanner for other ecosystems. Section 10.1. |
| A demonstrated policy gap after compiler, lint and graph checks | Structural policy | ast-grep or Semgrep as selected by Section 6.4; native rule tests. |
| Maintained English text or documentation links | Documentation hygiene | typos for English text, lychee for actual links; Section 13.1. |
| CLI or local browser service | Process / local security | Actual process, exit/status and listener/host/path tests; Section 10.5. |
| Authored JS/TS application, package, or script | TypeScript/JavaScript | Actual runtime; Bun package management for the new profile unless its upstream framework requires another manager; Node LTS where tools need it; tsrs for TS, Oxfmt, Oxlint, and a compatible native test runner. |
| Multiple authored JS/TS modules with an intended dependency boundary | Architecture | dependency-cruiser and its qualified parser; native boundary fixtures. |
| JS/TS project entry points, exports or dependencies to maintain | Unused-code analysis | Knip with real entry/project scope, before integrated candidate acceptance. |
| Authored Rust source | Rust | Cargo, rustfmt, Clippy, Cargo tests; mutation testing for applicable critical logic. |
| Authored Python source | Python | A pinned stable Python version compatible with the selected target, uv, Ruff, pytest; type analysis when typed Python is part of the supported contract. |
| Shell scripts | Shell | ShellCheck and shfmt for supported shell dialects. |
| GitHub Actions workflow or local action | Workflow | actionlint, zizmor, required-job result aggregation. |
| Public/consumer-facing OpenAPI | API contract | Runtime schema tests, generated OpenAPI, Spectral validation, oasdiff comparison. |
| Browser UI | Web | Playwright, axe-core integration, keyboard and actual journey verification. |
| Database or durable user state | Persistence | Migration/restore and transaction tests using the actual supported engine. |
| Container or IaC deployment | Deployment | Trivy for image/IaC scope; runtime deployment smoke/recovery tests. |
| Published JS/TS package | Package release | Changesets, package artifact inspection, consumer installation tests, SemVer comparison. |
| Stateful or critical algorithms | Behavioral depth | Property/model tests and scoped mutation tests. |
| Multiple real JS/TS packages with dependent/repeated tasks | Monorepo | Turborepo only for those task dependencies/cache; dependency-cruiser remains the architecture tool. |
| Native harness hooks or MCP integration | Harness integration | Version-specific documented schemas, actual harness trigger tests, actual connector contract tests. |
| Meaningful shared UI library | Component documentation | Storybook only if independently exploring shared components is an accepted need. |

A tool dependency does not create product scope. Bun package management does not select Bun as the application's runtime. Add a server, database, authentication, container, browser, hooks or MCP only for the new product's required behavior. Keep each optional profile inactive until its evidence exists; retain promised but unfinished capabilities as NOT RUN.

### 3.2 Tool ownership and installation

| Owner | Owns | Does not also own |
| --- | --- | --- |
| mise | Runtime versions and standalone tool binaries, using verified upstream backends; standalone Oxfmt for a native-only non-JS scope where supported. | A second global copy of project JS dependencies. |
| `package.json` + `bun.lock` | JS tooling packages, including tsrs, Oxlint, Oxfmt, dependency-cruiser, Knip, fast-check, StrykerJS and API/browser tooling. | OS runtimes or unrelated global binaries. |
| Cargo manifests + `Cargo.lock` | Rust libraries and build dependencies. | JS tool versions. |
| `pyproject.toml` + `uv.lock` | Python project dependencies and development tooling when project-managed. | Another installation of the same Python tool through an unrelated manager. |
| Native upstream toolchain configuration | Rust toolchain components/targets when required by the selected mise Rust backend. | A second independently selected Rust compiler version. |

Pin the owner of each executable once. If a mise backend delegates to rustup or another native installer, verify that delegation and keep one authoritative version selection. Do not maintain conflicting `rust-toolchain.toml` and mise pins.

First make `mise` available through its supported upstream installation for the actual environment, then verify `mise --version`. Do not require `mise` to install itself. Existing managed environments may expose an approved binary. Keep permission and network failures explicit. [S23]

Restore approved pins for an existing project. For a **new Bun-runtime TypeScript profile**, after Section 2 resolves the product, target, and directory, perform this initial setup from that directory. It initializes the manifest before adding dependencies:

```bash
mise use --pin node@lts bun@latest
mise exec -- env BUN_AGENT_RULE_DISABLED=1 bun init --minimal --yes
mise exec -- bun add --dev --exact tsrs oxlint oxfmt @types/bun
```

These are **bootstrap mutations**, not verification commands. Inspect generated scripts, TS config, dependencies and agent instruction files. Current Bun initializers can generate a different checker command and agent-specific rules; replace the checker task with the tsrs command in Section 4, and keep only instructions required by this project. The minimal initializer does not implement a product. Verify the installed initializer's documented flags before use. [S23]

The `@types/bun` dependency belongs only to a Bun target. For Node, browser or provider runtimes, use their actual native initializer and target types; Bun may still manage packages without granting Bun globals to application code. Inspect exact resolved versions and compatibility, and reject an unintended prerelease. Preserve the explicit tsrs selection even while its compatibility target is a TypeScript beta; record that qualification boundary.

Remove initializer-added alternate checker dependencies or peer declarations that have no remaining purpose. If `typescript` is retained for a documented parser/editor API, pin and record that narrow role; it does not gain a checking task. Do not retain a second compiler merely because the initializer added it.

Add dependency-cruiser, Knip, property/mutation and other tools only as their Section 3.1 activation conditions become true. Install each as an exact project dependency. Keep one package manager and lockfile for each dependency scope.

When the architecture profile activates, first install exact dependency-cruiser; before enabling it on TS, install its required supported parser/API dependency as a separate bootstrap step. Resolve a concrete stable `typescript` version supported by the pinned dependency-cruiser: current upstream supports API versions 2–6 and 7.1 onward, but not 7.0. Prefer the supported current stable API; if the current stable API is unsupported, use the newest supported stable API and qualify it against every TS syntax form actually used. Record the resolved value in `PARSER_VERSION`, then run:

```bash
: "${PARSER_VERSION:?Set to the verified dependency-cruiser-compatible parser version}"
mise exec -- bun add --dev --exact "typescript@$PARSER_VERSION"
mise exec -- bun run depcruise --info
```

This package is an **analysis dependency only**; `tsrs` remains the sole type-checking authority. An unavailable parser or unsupported source syntax blocks the architecture gate. Do not silently select a deprecated parser or run another type checker. [S05]

Before using an external-tool alias, inspect `mise registry` and the upstream installation instructions. Pin the verified backend and version in `mise.toml`. Do not invent backend IDs or download URLs. If an authorized tool cannot be installed, mark its dependent gate BLOCKED.

For repository tasks, use installed package scripts or local binaries. A verification run must not fetch a missing package on demand through an unpinned `npx`/`bunx` invocation.

### 3.3 Freeze and reproduce installation

After native initialization and first dependency resolution have produced the applicable manifests and lockfiles, create the mise lock for the actual promised platforms by running `mise lock` (bootstrap or explicit toolchain update only). Then verify locked installation using the separate acceptance commands below. `mise lock` is a mutation, never part of an ordinary acceptance check:

```bash
mise lock --check
mise install --locked
mise exec -- bun install --frozen-lockfile
```

Use the locked Bun install only where a Bun project exists. Do not execute `mise lock` in the candidate checkout. Keep any required native lock sidecars. Use an isolated mise data directory for a cold tool installation if downloaded-artifact verification is claimed; a restored installed-tool cache is trusted input, not checksum verification. Do not use a cache writable by an untrusted ref. [S04] Rust uses `cargo fetch --locked` and locked Cargo build/test commands; Python uses `uv sync --locked`. Generate or refresh lockfiles only during an explicit dependency/toolchain change, never to make an ordinary verification pass.

Before the first commit, run setup and initial checks in the task-owned tree or an isolated file copy and label the results provisional. After the first real commit, perform the cold-install qualification from its clean disposable checkout under Section 12.1 step 8. Record tool versions, platform, lockfile revision, and the completed installation. Inspect lifecycle scripts and native build approvals when dependencies require them.

**Pass:** a clean supported environment installs the same declared toolchain without rewriting lockfiles.

**Failure:** network outage, unsupported binary, checksum error, missing lock entry, changed lockfile, or compiler incompatibility. Preserve the diagnostic and fix the actual installation/configuration. Do not replace tsrs with another checker.

### 3.4 Qualification is triggered by change

Run the relevant qualification fixtures when any of these changes:

- Tool version, backend, plugin, parser, or compiler mode.
- Rule configuration, includes/excludes, target runtime, or source language.
- Task definitions, workflow, test discovery, formatter/editor configuration.
- A new supported platform or artifact format.

For each gate, demonstrate one valid case passing and at least one representative violation failing with the **expected diagnostic**. A missing executable or syntax crash is not a successful negative test. Keep reusable policy fixtures under `tests/tooling` or the tool's native rule-test directory.

Do not run expensive toolchain qualification on every ordinary edit. Routine feedback uses the qualified configuration. At integrated-candidate acceptance run both `mise run verify` and `mise run qualify` on the same immutable candidate inputs, including a clean checkout for committed acceptance. `qualify` is a separate required gate (not an implicit child of `verify`); it may call `verify` on disposable negative cases without recursion. If any qualification input changes, the old qualification is invalid. A missing, skipped, stale, or zero-case qualification blocks the affected acceptance. Configure a separate required CI qualification job or explicitly require both task results inside the required verification job. Do not add a green placeholder.

---


### 3.5 Choose structure from the new behavior

The first application/package stays single-package unless the new outcome requires separate deployable or independently consumed packages. A formatter dependency does not justify a monorepo.

Use the supported native initializer for a product/platform already selected by the task. If the task leaves the framework open, the agent selects a maintained, compatible framework that meets the approved surface and deployment constraints, records that choice once in `docs/PROJECT.md`, and continues. Escalate only a choice that materially changes the product, cost, privacy or supported environment.

Create UI, API, domain, adapter, storage and schema areas only when actual responsibilities exist. Section 7 fixes dependency direction between the areas that exist; it does not require empty layers.

Authentication, database, hosting and external provider integrations activate only for their accepted capability. Use an already authorized platform's native feature when it satisfies the need. New subscriptions, accounts, paid services or publishing targets are not implied by selecting a framework.

**Completion:** the chosen runtime/framework and current structure serve the first approved behavior, have a supported installation path, and contain no inherited product mandate.

---

## 4. Establish one native task contract

### 4.1 Canonical entry points

Use `mise run verify` as the repository-wide ordinary verification entry and `mise run qualify` as the separate qualification entry required at integrated-candidate acceptance (Section 3.4). They delegate to native package scripts, Cargo, uv, and external tool CLIs. Turborepo owns JS workspace dependency ordering where applicable. Lefthook and GitHub Actions call these same tasks at their applicable stages.

This is composition of upstream tools. Do not create a second task scheduler, a policy DSL, or a new gate database.

| Task | Purpose | Allowed mutation |
| --- | --- | --- |
| `mise run dev` | Start the actual prototype/development surface. | Disposable runtime state only. |
| `mise run format` | Apply the single assigned formatter per file. | Formatting changes. |
| `mise run lint-fix` | Explicit safe source fixes before review. | Reviewable source changes. |
| `mise run check-fast` | Applicable inexpensive formatting, lint, type and structural feedback. | None. |
| `mise run test` | Full selected behavior suite for the applicable profile. | Isolated test state/reports only. |
| `mise run verify` | All applicable ordinary integration checks; acceptance additionally requires `qualify`. | Reports/cache/disposable state only. |
| `mise run qualify` | Toolchain/configuration positive and negative fixtures. | Disposable qualification copies only. |
| `mise run build` | Actual runnable/package artifact. | Declared build outputs. |

Create only tasks backed by actual work. `qualify` is an alias for concrete qualification tests, not a command that prints a checklist and succeeds. Publication is a separate authorized action, never an implicit dependency of `verify`.

### 4.2 Bind tasks to real inputs

Create the selected native manifest under Section 2.3 before binding scripts. For an existing project, merge only the required changes. At initial integration:

1. Enumerate source roots, test roots, actual project configs, package entry points, generated outputs, and supported targets.
2. Put the concrete paths in native configuration and tasks.
3. Fail on a referenced path that does not exist.
4. Compare discovered files with the intended source/test inventory.
5. Verify every active package has its required task. A successful workspace runner that ignored a package with no script is not complete verification.
6. Add the relevant qualification fixture.
7. Run the task in the current task-owned tree during bootstrap; after the first real commit, rerun it from the clean disposable checkout required by Section 12.1 step 8.

For a **single Bun TypeScript package** with actual `src`, behavior tests, tooling-contract assertions and qualification fixtures, these are the base package scripts. All referenced roots must already contain the intended files. During bootstrap, add each task only once its actual inputs exist; the full fragment is the initial qualified state. Add it to the initialized manifest without overwriting dependencies or package metadata.

```json
{
  "scripts": {
    "format": "oxfmt --write --disable-nested-config .",
    "format:check": "oxfmt --check --disable-nested-config .",
    "lint": "oxlint --type-aware --deny-warnings src tests",
    "lint:fix": "oxlint --type-aware --fix src tests",
    "typecheck": "tsrs --noEmit -p tsconfig.json",
    "test": "bun test tests/behavior tests/tooling/contracts",
    "test:behavior": "bun test tests/behavior",
    "test:qualification": "bun test tests/tooling/qualification"
  }
}
```

Create the real behavior test, non-mutating tooling-contract assertions and qualification fixtures before using the full fragment. Bun positional filters are substring matches, not anchored directory selection or globs. Qualify their exact discovered file set and forbid a bare recursive `bun test` when qualification files exist. If filters cannot provide exact disjoint sets, use the installed version's explicit `./path/file.test.ts` or `--files-from` support with the enumerated exact file inventory. The tooling assertions must compare discovered/actual report files to the intended set, not just trust the filter string. `test:behavior` excludes tooling-contract and qualification tests; mutation runners use that behavior-only entry. [S09] Until fixtures exist, omit the qualification script/task and report qualification as NOT RUN; do not install a task with missing inputs. Qualification remains required before the initial toolchain is accepted. Web, Node and Rust projects use their actual runtime/test commands.

For JS-only projects, omit the standalone TS task unless a TypeScript/checkJs contract exists; qualify the actual lint mode and do not load TS-only rules as an unverified substitute for JS checks. If a TS config/build/test file is authored, the tsrs profile activates. As profiles activate, add their concrete tasks: architecture uses `depcruise --config .dependency-cruiser.cjs --output-type err-long src`; unused-code analysis uses `knip`; property and integration scripts select the actual existing test roots. Add the corresponding mise tasks and required dependencies to `verify`. The absence of a profile from this minimal fragment is not an exception for an activated profile.

Set authoritative compiler mode at the native task boundary:

```toml
[env]
TSRS_FAST = "0"

[tasks."format"]
run = "bun run format"

[tasks."lint-fix"]
run = "bun run lint:fix"

[tasks."format-check"]
run = "bun run format:check"

[tasks."lint"]
run = "bun run lint"

[tasks."typecheck"]
run = "bun run typecheck"

[tasks."test"]
run = "bun run test"

[tasks."qualify"]
run = "bun run test:qualification"

[tasks."check-fast"]
depends = ["format-check", "lint", "typecheck"]

[tasks."verify"]
depends = ["check-fast", "test"]
```

This is the **initial TS core task fragment**, not the full acceptance task for every active architecture, security, API, persistence, browser or package profile. Extend its dependencies with every active row in Sections 6–12. The profile inventory check must reject an activated ordinary gate missing from `verify` or an applicable qualification missing from `qualify`. Do not make `verify` depend on `qualify`; at the integrated acceptance boundary both must run. For mutating build/generation/qualification operations, use separate disposable copies or explicitly ordered tasks. A shared temporary directory is not isolation.

For a monorepo, each package owns its real leaf `typecheck`/`test`/`build` script; the root task calls `turbo run` for those scripts. Do not assume a reference-only root `tsconfig.json` checks its referenced programs. Define real output paths and relevant environment/configuration inputs for caches. Disable or bypass caching for external-state, current vulnerability, authorization, and release acceptance checks. [S04]

### 4.3 Shell and failure propagation

Use a supported shell. Shell scripts use `set -euo pipefail` where valid; preserve the status of the actual checker when output is piped to a logger. Avoid `|| true`, `continue-on-error`, and generic catches on required gates.

Do not mark a check successful because a report formatter, output compressor, or artifact uploader succeeded. RTK may compress routine display; raw diagnostics and the original exit status remain available.

**Pass:** injecting a real failing check causes the composed task to fail. Removing a required task or all its inputs also fails the profile/inventory qualification.

### 4.4 Native tooling-contract tests

Add small tests to the repository's selected native test runner for the facts upstream tools cannot know about this repository. This is test glue, not a new verification framework.

Use disjoint discovery: ordinary product tests live in `tests/behavior`; non-mutating repository assertions live in `tests/tooling/contracts`; qualification orchestrators live in `tests/tooling/qualification` and run only through `qualify`. Native Rust equivalents likewise use explicitly selected integration-test targets. Existing repositories may retain their layout but must establish the same disjoint target selection.

Implement this ordered assertion set using those test targets:

1. Read native manifests/configuration and the reviewed profile selection. Assert every active source package and target has its required actual task.
2. Assert each task's explicit source/test/rule inputs exists and is non-empty; compare tool discovery with that inventory.
3. Assert source, tests, configuration and ignored/generated scopes match their declared owners. Keep intentionally invalid fixtures as data or generate them in a disposable checkout, not in the normal compilation input.
4. In a disposable copy without production credentials, introduce one targeted violation for each newly configured gate; invoke the exact native task; assert failure and its expected diagnostic. Never execute malicious dependency/install hooks, publish, or modify a real external service as a qualification fixture.
5. Restore the fixture and assert the valid counterpart passes.
6. Remove a required task/input/rule set and assert the tooling-contract suite rejects it.
7. Run the composed task with a failing child and assert its exit status stays nonzero.

Bind `qualify` to these real tests and tool-native rule tests. The mapping of approved product scope to profiles receives independent review; programmatic file discovery cannot decide business applicability. `verify` must include the non-mutating task/input/configuration assertions. Changes to the tooling tests themselves are acceptance-policy changes under Section 9.

Steps 1–3 are the ordinary read-only contract checks. Steps 4–7 are qualification-only orchestration. Treat the profile inventory, expected task set and qualification test code as reviewed acceptance inputs. A change to these inputs cannot certify itself: compare with the approved product contract and base before accepting a new mapping. A separate required qualification command must fail if its own expected suites are absent; run the ordinary test discovery assertion before qualification and verify actual qualification report identities afterward. A qualification child task invokes the normal explicit test roots and never rediscovers its parent qualification suite. Generation comparisons, mutation testing and injected-fault qualification use separate disposable workspaces; parallel `verify` dependencies must all observe stable candidate source bytes.

## 5. Deliver a working increment before expanding infrastructure

### 5.1 First prototype execution

**Inputs:** accepted new-product journey, task-owned workspace, actual runtime, minimum applicable safety/type/architecture configuration.

Execute:

1. Implement one complete approved journey across the necessary layers.
2. Put temporary storage or integrations behind the actual external boundary; mark the prototype's simulated behavior.
3. Add the real `dev` or CLI invocation to the native task configuration.
4. Run it with disposable data through the intended surface.
5. Exercise the primary success case and the most consequential applicable failure case.
6. Check relevant type, dependency, secret, and input/authorization boundaries.
7. Present the usable result, launch instructions, observed behavior, and limitations.

The first prototype does not wait for optional mutation tooling, every platform, a full observability stack, or unrelated deployment infrastructure. A missing required security or correctness check remains a blocker for the affected behavior; label incomplete capabilities honestly.

**Prototype exit:** another agent can reproduce the scoped journey from the recorded command and environment. A source diff, generated screenshot, static dashboard, or plan is insufficient.

### 5.2 Iteration loop

For each next accepted slice:

1. Read its acceptance cases and affected boundary.
2. Update the owning contract before writing dependent implementation.
3. Implement through the actual user surface and required domain/adapters.
4. Run focused checks while editing.
5. Run the complete applicable task before integration.
6. Demonstrate the change and previously established behavior affected by it.
7. Inspect the candidate under Section 13 and obtain the review triggered by Section 9.
8. Preserve a working candidate and proceed to the next accepted slice.

Ordinary low-impact edits do not require invented unit tests that mirror their implementation. Add tests when they constrain an actual regression, business invariant, boundary, or supported failure mode. Existing regression coverage remains required.

### 5.3 Bug-fix recipe: make the causal claim testable

**Trigger:** a failing behavior, regression, repeated tool failure, or performance degradation.

| Step | Required action | Pass condition |
| --- | --- | --- |
| Reproduce | Capture the actual command/input, environment, observed state and expected state. | The defect is reproduced, or its intermittency and evidence gap are explicit. |
| Isolate | Trace the affected input → transformation → boundary → effect; inspect full diagnostics. | The failing boundary and plausible cause are identified. |
| Discriminate | State one falsifiable hypothesis and the observation that would distinguish it from the closest alternative. | Run that observation; update the hypothesis if contradicted. |
| Regression | Add an unchanged oracle derived from the accepted requirement. | It fails against the faulty implementation for the intended defect. |
| Repair | Change the smallest coherent responsibility that restores the contract. | The repair addresses the demonstrated mechanism, including cross-file work when needed. |
| Recheck | Run the same regression against the repair, plus related invalid and unaffected cases. | The regression passes; nearby faulty variants are rejected where important. |
| Review | Inspect source, test, snapshot, and policy changes separately. | The reviewer accepts the evidence and no hidden acceptance reduction remains. |

For a regression test newly added in the fix, run the test against both implementations in isolated worktrees or through the stable public interface. Record the test identity and both revisions. Missing dependencies, missing symbols, and broken setup do not count as reproducing the defect. If the old public interface cannot support the new test, retain an external reproducer against both versions and document the unavoidable distinction.

After the **second materially identical failed repair attempt**, stop applying the same patch strategy. Retrieve full diagnostics and use an independent diagnosis, boundary isolation, `git bisect` for a reproducible historical regression, or a targeted trace. The retry bound limits repetition; it does not justify abandoning the approved scope.

Do not demand a private chain-of-thought transcript. The deliverable is a compact hypothesis, discriminating experiment, root-cause evidence, and observed regression result.

---

## 6. Type checking, formatting, lint, and custom rules

### 6.1 TypeScript: tsrs is the authoritative checker

**Trigger:** retained TypeScript source, TS tests, or TS build/configuration files.

Use the installed `tsrs` against each real target configuration:

```bash
mise exec -- bun run tsrs --version
mise exec -- bun run tsrs --noEmit -p tsconfig.json
```

The task environment sets `TSRS_FAST=0`. Keep the same mode for Oxlint's tsrs backend. The current upstream documentation says fast mode can change diagnostics, Oxlint's backend enables it by default, and `tsrs --init` is unsupported. Therefore create a real configuration and do not treat a speed preset as an invisible implementation detail. [S01]

Use this shared strictness fragment, then add target-specific settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

Resolve the target using this table; do not copy browser globals into server/domain code.

| Actual target | Module/type configuration | Runtime verification |
| --- | --- | --- |
| Bun-executed package | `module: Preserve`, `moduleResolution: Bundler`, an explicit supported ES target/library, `types: ["bun"]` with pinned Bun types. | Run its real Bun test/CLI path. |
| Vite browser application | `module: ESNext`, `moduleResolution: Bundler`, explicit ES + DOM libraries, `jsx: react-jsx` for React. | Vite build plus Playwright on the built surface. |
| Node LTS ESM application | `module: NodeNext`, `moduleResolution: NodeNext`, explicit Node types and supported ES target. | Execute built output on the pinned Node LTS. |
| Pure domain library | Explicit ES library; `types: []`; no DOM/Node/Bun ambient types in the domain config. | Domain tests without infrastructure access; adapters tested separately. |
| Cloudflare Worker or other provider runtime | Provider's official generated/supported types and actual module target. | Provider-supported local runtime plus approved deployment qualification when required. |

For a new Bun-only fixture, the explicit ES baseline is `ES2022`; a lower promised runtime target wins. Browser support is separately defined by the product and bundler. Compiler `target` is not a substitute for runtime compatibility.

List explicit `include` patterns for source, required tests, and configuration. Split real target configs when browser/server/test globals differ. For a solution-style root, run each leaf config or a qualified supported build mode; a root with no files is not evidence that its references were checked.

Required qualification cases:

1. Valid source passes.
2. An assignability error in application source fails.
3. An error in a required test/config file fails.
4. A file intentionally outside lint scope but inside type scope still fails standalone tsrs.
5. Browser-only or server-only globals in the wrong target fail.
6. All intended leaf projects appear in the invoked task inventory.
7. Unsupported options/binary failures block checking rather than becoming warnings.

Oxlint with `--type-aware` uses tsrs when supported and installed; current upstream identifies Oxlint 1.92.0 as the minimum for automatic discovery. Do not install `oxlint-tsgolint` as an alternate backend. Verify the actual backend selection in the installed version using upstream-supported diagnostics (for example `OXC_LOG=debug`) and dependency inventory; a negative lint case alone does not identify the backend. Its optional `--type-check` is useful feedback but does not replace the complete tsrs task. Bun execution/build/test success likewise does not replace the selected checker. [S01]

If another analysis tool needs the `typescript` package as a parser/API dependency, record that narrow role. It may not install a second authoritative checking task. Dependency-cruiser's parser compatibility must be qualified separately; do not assume tsrs provides that parser API. [S05]

### 6.2 Formatting: one owner, no hidden rewrite cycle

**Default changed from the earlier blueprint:** Oxfmt owns supported JS/TS and text asset formatting. Remove redundant Biome/Prettier formatting invocations from those scopes when adopting this profile. Oxfmt's own upstream implementation may delegate certain formats internally; that is still one configured owner, and must be available in the installed distribution. [S02]

| File scope | Formatting owner | Read-only acceptance |
| --- | --- | --- |
| Oxfmt-supported JS/TS, JSON-family, CSS-family, Markdown, YAML, TOML, HTML/framework files | Pinned project Oxfmt npm package for JS projects; pinned standalone Oxfmt for native-only non-JS scope where supported; any required upstream parser dependency. | `oxfmt --check --disable-nested-config .` |
| Rust `.rs` | rustfmt through Cargo. | `cargo fmt --all -- --check` |
| Python `.py` | Ruff. | `uv run --locked ruff format --check .` |
| Supported shell scripts | shfmt with the declared dialect. | `shfmt -d` over the actual script paths. |
| Generated files, lockfiles, vendored assets | Owning generator/package manager. | Regenerate and compare, or frozen installation. |
| Unsupported/custom formats | Existing qualified native owner, if any. | Explicit parser/check path; otherwise report formatting support unavailable for that format. |

The standalone Oxfmt distribution skips formats delegated to bundled Prettier. Use it only after verifying the actual file-format inventory against native support; use the npm distribution when such delegated formats are required. Do not install a JS runtime solely for native-only Rust/Python project text formatting. Do not activate another formatter for the same embedded Markdown code block. The document owner owns the whole document. Keep unsupported snippets literal when necessary.

Use one repository-level `.editorconfig` and `.gitattributes` policy for encoding, LF, and text/binary treatment. Preserve whitespace-sensitive files. A base Oxfmt configuration is:

```json
{
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf",
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/target/**",
    "**/coverage/**",
    "**/reports/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/.stryker-tmp/**",
    "**/mutants.out/**",
    "**/bun.lock",
    "**/Cargo.lock",
    "**/uv.lock",
    "**/mise.lock"
  ]
}
```

Add only actual generator outputs/vendor directories. Review all ignore sources, including inherited `.gitignore`/`.prettierignore` and editor configuration. Explicitly disable nested formatter configurations for this standard. Do not exclude ordinary authored files to hide formatting failures.

**Qualification procedure, in a disposable copy:**

1. Enumerate representative authored files for every active language, including filenames with spaces, dotfiles, and embedded examples.
2. Assert that each has exactly one formatter owner.
3. Run approved safe lint fixes, then the complete formatting sequence.
4. Snapshot content of all relevant tracked and untracked files.
5. Rerun each fixer/formatter **individually**; compare the snapshot after each invocation.
6. Require zero changes after every individual invocation.
7. Repeat using the actual editor save configuration, if supplied by the repository.
8. Introduce a known formatting violation and verify the check-mode command rejects it without modifying the file.

Composite idempotence alone is insufficient: one tool can undo another inside every pass while the final output stays unchanged. Checking each individual tool at the converged state closes that hole.

CI acceptance uses check mode only. A whole-repository formatting migration is a separate identifiable change, with behavioral changes kept reviewable.

### 6.3 Oxlint: explicit safety rules, verified against the actual runner

Use `.oxlintrc.json` and the pinned upstream schema. Start with correctness rules and explicitly activate safety requirements. A TS baseline is:

```json
{
  "plugins": ["typescript", "import", "unicorn", "jest"],
  "categories": {
    "correctness": "error"
  },
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/no-floating-promises": ["error", { "ignoreVoid": false }],
    "typescript/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": true,
        "ts-ignore": true,
        "ts-nocheck": true,
        "ts-check": false
      }
    ],
    "no-global-assign": "error",
    "no-implicit-globals": "error",
    "no-empty": "error",
    "jest/no-focused-tests": "error",
    "jest/no-disabled-tests": "error"
  }
}
```

Use the Vitest plugin's corresponding test rules when Vitest is the selected runner. Bun imports and aliases must be exercised in negative fixtures; a Jest-named rule is not proof of Bun coverage. If a documented native rule misses an important form, fill that precise gap with an ast-grep rule and its tests.

The explicit comment options forbid suppression in production source. Intentional negative type tests use only a reviewed narrow test-path override, or generated invalid files in qualification copies; a descriptive comment alone is not approval to suppress a production error.

Qualify the installed version with examples for:

- Explicit `any` and unsafe casts/assignments.
- Unhandled asynchronous work, including `void promise`; separately inject failures into swallowed rejection handlers.
- Type-check suppression and broad lint suppression.
- Focused, disabled, conditionally skipped, or aliased tests.
- Empty failure handling.
- Implicit globals and writes to global state.
- Infrastructure reads outside the permitted adapter.

`no-implicit-globals` does not detect every module-level singleton or `globalThis` assignment. `no-magic-numbers` does not prove that a named constant is valid configuration. Treat environment reads, global mutation, and domain constants as separate boundary rules plus behavioral tests.

Use `no-magic-numbers` selectively for business calculations where the configured rule is useful. A documented protocol constant, array index, or test fixture number is not automatically a defect. Require externally variable settings to enter through the validated configuration boundary; test that changing an allowed setting changes the actual behavior.

Safe automatic fixes run before verification and are reviewed as source changes. Suggestion/dangerous fix modes are not acceptance operations. Current CLI/configuration support is defined by the pinned Oxlint version. [S03]

### 6.4 ast-grep and Semgrep: fill concrete gaps

**Selection order:** native compiler/linter rule → dependency graph rule → ast-grep structural rule → Semgrep when its pattern/data-flow capability fills a demonstrated gap.

Do not implement the same acceptance condition independently in several tools.

| Mechanism | Use | Required validation |
| --- | --- | --- |
| ast-grep | Known forbidden syntax: direct environment access, dynamic import expressions in restricted code, policy-specific bypass calls. | Native valid/invalid rule fixtures; rule discovery count; expected finding and failure exit. |
| Semgrep Community Edition | Scoped security or custom code policies not already covered. | Native `ruleid`/`ok` tests, rule/config validation, actual scan coverage and errors. |
| Independent review | Semantics not recognizable from syntax: whether a constant encodes a justified rule or a sample-specific workaround. | Evidence against the acceptance contract. |

Bind ast-grep to `sgconfig.yml`, with versioned rule and test directories. Use the `ast-grep` executable explicitly when available to avoid confusion with an unrelated operating-system `sg` command.

Canonical command patterns:

```bash
ast-grep test
ast-grep scan
semgrep --test .semgrep
semgrep scan --config .semgrep --error --strict --metrics=off .
```

Run only the selected tools with real rule directories. `ast-grep` mandatory rules use severity `error`. Semgrep's `--error` is needed for findings to fail a local scan; `--strict` does not replace inspection of skipped files, parse failures, and timeouts. Treat unscanned required inputs as BLOCKED. [S06, S07]

**Negative fixtures:** literal and aliased prohibited call; TypeScript and TSX where applicable; a legitimate similar expression; a file inside every required source scope. Test rule discovery itself: zero loaded rules must not produce a reported PASS.

Keep deliberately invalid rule fixtures in the tool-owned rule-test location or as data generated into disposable copies. Exclude only those owned fixture locations from the normal production-source scan and normal type/lint input; still execute them through the native rule-test command and explicit negative qualification. Do not broaden that exclusion to authored application/tests. Record and review the exclusion so seeded violations cannot make normal scans permanently red or disappear from qualification.

Do not use Semgrep's deferred `todoruleid`/`todook` annotations to claim a mandatory rule is tested. Pin local reviewed rules rather than fetching an evolving remote ruleset during acceptance. A CE scan does not establish paid-engine or whole-program analysis coverage.

---

## 7. Architecture, configuration, and contract checks

### 7.1 Fixed dependency direction

Use modules inside the first package. Add workspaces only when the approved product needs independently deployed or consumed packages. Create only real responsibilities. The following dependency rules apply to whichever boundaries exist; they do not require `apps/*`, multiple packages or empty domain/adapter/UI folders.

| Importing responsibility | Allowed dependencies | Rejected dependencies |
| --- | --- | --- |
| Domain | Domain-owned types/functions and explicitly justified pure libraries. | Apps, UI, adapters, ORM, authentication/network/storage SDKs, process environment, filesystem, agent runtime. |
| Application/use cases | Domain and declared ports; boundary contracts only where they genuinely belong. | Concrete adapters embedded in business decisions. |
| Adapters | Domain ports and relevant external libraries/contracts. | UI or another app's private modules. |
| Composition root | Application/domain, selected adapters, configuration. | Bypassing published package exports. |
| Browser UI | UI components, public API client/contracts, browser-safe domain exports only if explicitly designed. | Database, server credentials, filesystem/server internals. |
| Shared transport schemas | Schema library and transport-local definitions. | Persistence/private application implementations. |

Dependency inversion is checked by graph rules. The usefulness and placement of an interface is checked by reviewing its actual consumers, responsibility, and change boundary. The existence of an interface alone is not an architectural success.

### 7.2 dependency-cruiser configuration

For the single-package layout `src/domain`, `src/application`, `src/adapters`, and `src/ui`, use this native configuration as the base:

```javascript
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "no-unresolved",
      severity: "error",
      from: {},
      to: { couldNotResolve: true }
    },
    {
      name: "no-undeclared-dependencies",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] }
    },
    {
      name: "domain-stays-pure",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { pathNot: "^src/domain/" }
    },
    {
      name: "application-stays-independent",
      severity: "error",
      from: { path: "^src/application/" },
      to: { pathNot: "^src/(application|domain|schemas)/" }
    },
    {
      name: "ui-does-not-import-infrastructure",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: "^src/(adapters|application)/" }
    },
    {
      name: "browser-ui-has-no-runtime-builtins",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { dependencyTypes: ["core"] }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    builtInModules: { add: ["bun", "bun:test", "bun:sqlite"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" }
  }
};
```

This is saved as `.dependency-cruiser.cjs`. The strict domain rule initially allows no external import. The application rule permits only application/domain/schema modules; schema access must be part of the approved boundary. Add a narrowly named pure-library exception only when its concrete need is documented and reviewed; keep infrastructure exclusions intact.

The Bun builtin entries are for the Bun profile. Add other actually used Bun builtins only from the pinned runtime's documentation, and omit this addition for other runtimes. Qualify a valid builtin import in an adapter and a rejected import in domain/browser UI.

For each concrete infrastructure SDK owned by an adapter, add a forbidden edge from browser UI to that SDK's resolved package path. Derive the package list from actual adapter manifests; distinguish a separately documented browser client from server-only SDK entry points. Qualify direct UI→SDK and application→SDK imports. Directory rules alone do not detect every direct provider import.

For a workspace layout, mechanically replace each responsibility's path with its actual package path. Add per-package rules that forbid imports from outside a package into its private source, allowing only its declared public entry points. Generate the allowlist from the actual `package.json` exports/entry files and verify relative-path and alias bypasses. The generic snippet above does not by itself enforce all workspace-export rules.

Commands:

```bash
mise exec -- bun run depcruise --info
mise exec -- bun run architecture
```

**Qualification:** detect a cycle, domain→adapter import, type-only forbidden import, undeclared package dependency, unresolved import, alias/deep-import bypass, and a legitimate dependency that must pass. Keep `tsPreCompilationDeps: true` so type-only imports are visible. Use `doNotFollow` for external packages rather than excluding their edges. [S05]

Computed dynamic imports cannot be fully resolved statically. Restrict them to the approved integration boundary using a reviewed dispatch map, with a structural rule and runtime contract tests. If parser support or a required alias is unresolved, architecture coverage is BLOCKED.

For Rust, use Cargo crate boundaries, visibility, `cargo metadata --no-deps --format-version 1`, and native tests asserting the permitted crate dependency graph. Do not apply a JS dependency scanner to Rust and claim coverage.

### 7.3 Pure domain and external adapters

Run domain tests without access to network, database, filesystem, or ambient application configuration. Use native sandbox permissions when available. Inject clocks, randomness, identifiers, and external operations through actual ports when those affect behavior.

**Pass:** deterministic inputs produce the expected domain effects, infrastructure imports fail the architecture gate, and domain tests run independently. A sandbox prevents only what it actually denies; absence of network calls in one test is not a complete purity proof.

Each adapter runs the same behavioral contract suite for its port, plus provider-specific failure cases. A fake adapter is useful for domain tests but cannot establish real database/session/storage semantics.

### 7.4 Schema ownership and runtime validation

| Contract | Authoritative definition | Derived outputs/checks |
| --- | --- | --- |
| Domain behavior | Domain invariants and ports. | Behavioral/property/adapter contract tests. |
| HTTP/external configuration | Runtime boundary schema for the selected language/framework; Zod is a TS option, and provider-owned schemas remain authoritative. | DTOs, runtime parsing, OpenAPI/client types. |
| Database | The selected database's native schema/migration mechanism in its adapter; Drizzle only when selected for a TS project. | Storage types/validators and database-specific integrity tests. |
| Rust configuration/API | Native Rust types plus the selected serialization/schema library. | Parsing tests and supported generated schema. |
| Upstream-owned API | Pinned upstream specification/package. | Generated bindings and integration tests. |

Use `@t3-oss/env-core` with Zod for applicable TS environment configuration, or the existing native equivalent. All configuration reads occur in the owning boundary and are passed to consumers. Validate absent/malformed values, permitted defaults, secret redaction, and client/server separation.

Do not expose a database record as a public response by default. Test that internal IDs, authorization fields, tokens, and private storage fields do not leak. Test malformed/missing fields, unexpected fields according to the actual contract, boundary lengths/ranges, and authorization separately.

Type schemas validate shape and declared constraints; they do not prove the business decision is correct.

### 7.5 Generated outputs and API compatibility

For every generated artifact, record the source and generator in the owning package task. Use the existing manifest/configuration as authority rather than a second registry.

Execute:

1. Start from a clean candidate checkout.
2. Run the committed generation task using locked tooling in a separate disposable checkout, or finish generation before parallel read-only acceptance begins.
3. Compare **tracked changes and newly generated untracked files**, including deletions.
4. Fail on drift.
5. Validate the generated output and run its consumer/runtime contract tests.

For an OpenAPI product, add pinned `@stoplight/spectral-cli` and a native `.spectral.yaml` extending `spectral:oas`. Use commands bound to the actual generated file:

```bash
spectral lint --fail-severity error openapi.json
oasdiff breaking --fail-on ERR baseline-openapi.json openapi.json
```

The baseline file must be generated from the identified accepted base revision in an isolated checkout; the candidate file comes from the candidate. A hand-edited stale baseline is invalid. Definite breaking changes fail; warnings require a concrete compatibility disposition. An intentional contract break requires its approved migration/version change, not an ignored tool result. [S08]

For new projects with no previous contract, record the initial baseline and test clients against it. OpenAPI diffing does not verify actual HTTP behavior; request/response tests must run against the real handler.

Use one client-generation path per API: the selected framework's supported typed client when it meets the contract, or a supported OpenAPI generator for independent consumers. Follow the new product's approved API contract; do not add competing paths for the same responsibility.

## 8. Behavior tests that resist sample fitting

### 8.1 Select the runner by the actual project

| Project | Default | Required command family |
| --- | --- | --- |
| Bun-supported JS/TS application | Bun Test. | `bun test` through the installed package script. |
| Existing Vitest application or Vite-specific integration | Existing Vitest. | `vitest run`, including its actual configuration. |
| Rust source / CLI | Cargo tests; `assert_cmd` for CLI integration and `tempfile` for isolation. | `cargo test --workspace --all-targets --locked` and applicable doctests. |
| Python | pytest, with Hypothesis when properties are needed. | `uv run --locked pytest`. |
| Browser journey | Playwright Test, independently of the unit runner. | Installed `playwright test`. |

Do not add a duplicate unit runner merely to increase tool count. Test-runner compatibility is qualified with the actual suite, including async failures, process exit codes, module mocks, test discovery, and teardown. Rust feature combinations are tested according to supported configurations; `--all-features` is not assumed valid for mutually exclusive features. [S09, S18]

### 8.2 Required behavioral assertions

For each critical operation, tests must check:

1. The requested effect actually occurs.
2. Its returned status/output agrees with persistent state.
3. Invalid or unauthorized actions fail with the documented effect on state.
4. Unrelated data remains unchanged.
5. Failure, cancellation, retry, and concurrency obey the supported contract.
6. A representative incorrect implementation is rejected.

An ordinary example test remains useful as an independently known answer. Property tests add variation; they do not replace a correct oracle.

### 8.3 Property and model testing

Use **fast-check** for JS/TS, **proptest** for Rust, and **Hypothesis** for Python. Use the stable APIs documented for the installed version; current fast-check main-site documentation includes preview material. Bun needs no separate fast-check connector. [S10, S18, S19]

For JS/TS, use `fc.assert(fc.property(...))` for synchronous properties and `await fc.assert(fc.asyncProperty(...))` for asynchronous properties. Put generators, properties, and reference models in the test suite. Keep the production implementation out of expected-value computation.

For an initialization/configuration operation, implement this complete property set:

| Property | Required oracle | Incorrect implementation it must reject |
| --- | --- | --- |
| Effect | Required owned files exist and pass their real schema/tool checks after the operation. | A no-op that returns success. |
| Correct content | Generated native configuration enables the specified rules and actual source scope. | Empty or weakened configuration. |
| Idempotence | The second application produces no content/permission changes after the first valid result. | Duplicate entries, repeated rewrites. |
| Preservation | Unrelated user files retain content and relevant metadata; secrets remain private. | Wholesale overwrite or directory replacement. |
| Isolation | Applying in repository A does not alter repository B or ambient global configuration. | Process/global singleton state. |
| Denial | A denied/invalid operation leaves the declared safe state. | Writing before validating permission/input. |
| Recovery | Injected interruption followed by recovery yields a documented valid state with no silent data loss. | A success marker hiding a partial operation. |
| Concurrency | Concurrent applications serialize safely or produce an explicit conflict. | Lost updates or corrupt ownership data. |

A no-op can satisfy idempotence. A constant return can satisfy input-order invariance. Two mutually wrong functions can satisfy round-trip consistency. Each relational property therefore needs an independent effect/known-answer/preservation condition.

Define input domains deliberately: empty/minimum/maximum, missing fields, Unicode, paths with spaces, separators, duplicates, conflicting state, and supported operation sequences. Use integer minor units or the product's established numeric representation for monetary logic; do not assume exact arithmetic laws hold for floating-point values.

For stateful behavior, define the reference state and commands from the contract, including command preconditions and postconditions. Exercise multiple operation orders. Do not reimplement the same production algorithm inside the reference model.

Retain failing seed, shrink path, minimized counterexample, and model replay information. Replay failures deterministically, then retain important minimized cases as regressions. Fresh-seed exploration supplements reproducible regression runs; a new seed does not erase a known failure.

**Pass:** properties reject both known faulty cases and generated counterexamples, while valid examples pass. No discarded-input/vacuous property is counted as meaningful coverage.

### 8.4 Mutation testing of critical logic

**Activate when:** modifying authorization, ownership/path validation, configuration application, version/migration decisions, transaction behavior, core financial/business calculations, or a repeatedly defective state transition. Run the bounded affected scope before acceptance; run the complete declared critical scope during hardening/release. It is not a mandatory full-repository pre-commit task.

Use StrykerJS for JS/TS, cargo-mutants for Rust, and mutmut for Python on a supported fork-capable environment. Install mutation tooling only for the applicable implementation language. For other languages, qualify a maintained native mutation engine if required; if none is available, record the engine limitation and run targeted injected-fault tests without claiming mutation-engine coverage.

For a Bun project, add pinned `@stryker-mutator/core`. With a real `src/domain` and its supporting tests, the native `stryker.config.json` baseline is:

```json
{
  "testRunner": "command",
  "commandRunner": {
    "command": "bun run test:behavior"
  },
  "coverageAnalysis": "off",
  "incremental": false,
  "mutate": [
    "src/domain/**/*.ts",
    "!src/domain/**/*.test.ts",
    "!src/domain/**/*.spec.ts"
  ],
  "thresholds": {
    "high": 100,
    "low": 100,
    "break": 100
  },
  "reporters": ["clear-text", "json", "html"]
}
```

Bind `"test:mutation": "stryker run"` in the package manifest. Use the official Vitest runner when Vitest is already the project's runner. Do not enable a separate TypeScript checker plugin as an unnoticed replacement for tsrs.

The Bun command runner sees process results, not per-test coverage. The conservative configuration disables coverage-guided analysis and incremental reuse. A tool reporting “all passed” with the default unset failure threshold is not a mutation gate. Even a 100% score does not imply every mutant was meaningfully killed: inspect individual outcomes and independently exercise concrete faults. [S11]

The mutation subprocess invokes only explicit behavior test roots, never tooling-contract tests, `qualify`, or the whole `verify` task. An inventory assertion failing because a sandbox lacks a tooling file is not a killed business mutant. Keep unrelated coverage-threshold failures, retries, focused-test flags and auxiliary checker failures out of mutant kill decisions. Inspect the failing assertion for representative mutants; a setup/coverage failure is not proof that a business invariant was tested.

The 100 threshold expresses “no unresolved surviving scored mutation in this deliberately bounded critical scope”; it is not a general code-quality score. Apply these additional acceptance rules:

- Mutation targets and the generated mutant set are non-empty and match the reviewed scope.
- The unmodified baseline tests pass.
- Relevant non-equivalent mutants are killed by a meaningful assertion.
- Survivors and uncovered mutants are resolved, not hidden by narrowing scope.
- Equivalent mutants receive an independent, specific explanation and a narrow native exclusion where supported.
- Timeouts, runtime failures, and invalid mutations are inspected; they are not automatically evidence that the intended invariant was tested.
- Keep the original report, scope, exclusions, and any accepted equivalence rationale.

For Rust, configure `.cargo/mutants.toml` against the actual critical crates and run `cargo mutants`. Use its native outcome report and exit codes; inspect timeout/unviable results and confirm which crates/tests ran. [S18]

For Python, pin mutmut and pytest in the uv project; use `uv run --locked mutmut run` in a fresh disposable checkout, with its native `pyproject.toml` `[tool.mutmut]` configuration: explicit `source_paths` for critical code, `pytest_add_cli_args_test_selection` for behavior-only tests. Qualify the pinned version and inspect `uv run --locked mutmut results` or its documented native report. Require non-empty targets and no unresolved meaningful survivors, untested cases or ambiguous timeouts. Do not accept a reused results directory; mutmut needs fork support (WSL on Windows). If the promised target or selected syntax is unsupported, report BLOCKED and keep targeted fault injection as partial evidence. [S19]

**Qualification:** use a disposable copy to weaken an important assertion or substitute a plausible wrong implementation. The mutation/behavior gate must reject it. If all generated mutants are equivalent or invalid, report the limitation and use a concrete injected fault test; do not claim mutation coverage from an empty effective result.

### 8.5 Test discovery and evidence completeness

Check the native discovery/report output against the approved suite inventory. Enforce:

- At least one executed test for every required suite.
- No focused tests and no unreviewed disabled/skipped acceptance cases.
- No `passWithNoTests` or equivalent success option on required suites.
- No blanket snapshot regeneration during acceptance.
- No increased retries that conceal a reproducible failure.
- Async assertions and cleanup are awaited.
- Mocks are confined to the declared boundary; real-provider claims use real provider/runtime tests.
- Coverage measures execution, not correctness; retain it only where it identifies a concrete gap.

A test-count change is a review signal, not proof that a defect exists. The reviewer examines which cases disappeared and why. Failures in test infrastructure are BLOCKED/FAIL, not behavioral PASS.

---

## 9. Protect acceptance and CI from silent weakening

### 9.1 Changes that require independent review

Trigger independent review for:

- Core behavior, authorization, durable data, public contracts, architecture, or supported platform changes.
- Test expectations, deleted tests, snapshots, skips, mocks, generators, or property-model changes affecting acceptance.
- Tool/rule versions, ignore patterns, compiler flags, environment overrides, mutation scope/thresholds, coverage scope, or security exceptions.
- Task definitions, workflow jobs, caching inputs, result aggregation, publication configuration, or acceptance criteria.
- The final production candidate.

An agent separate from the implementer can perform this review within existing allowances. A narrated “second perspective” in the same response does not count.

The reviewer starts from the acceptance source and candidate diff, not only the implementer's explanation. Run relevant native checks and counterexamples where necessary. Hidden tests are optional additional evidence; sharing the same writable repository does not provide an immutable test boundary.

### 9.2 Concrete semantic review checklist

Each answer must cite a file/change, observed test, or acceptance statement:

| Question | PASS evidence | FAIL/BLOCKED response |
| --- | --- | --- |
| Does the result satisfy the intended journey? | Actual interaction and corresponding asserted outcome. | Fix the behavior or identify the missing product decision. |
| Does the change repair the demonstrated cause? | Reproducer, discriminating observation, unchanged regression oracle. | Investigate the competing mechanism. |
| Was acceptance weakened? | Justified requirement correction, or unchanged coverage/oracles. | Restore the intended condition and repair implementation. |
| Does a new abstraction have a real consumer or external boundary? | Existing call sites and identified responsibility. | Remove speculative layering. |
| Is a new dependency necessary? | An upstream capability comparison and concrete unmet need. | Reuse an existing capability or remove it. |
| Is temporary behavior visible and bounded? | Prototype limitation plus isolated replaceable boundary. | Correct the claim or replace the shortcut. |
| Did cleanup preserve user work and supported behavior? | Ownership diff and regression/consumer tests. | Restore unrelated assets and resolve the regression. |

This checklist makes review auditable; it does not turn aesthetic judgment, product demand, or complete causal understanding into a mechanical theorem.

### 9.3 GitHub capabilities: record the real enforcement boundary

Apply Sections 9.3–9.5 only to an actually configured or requested GitHub-hosted project. Without hosting scope, these controls are NOT APPLICABLE. With approved but unfinished hosting scope, they are NOT RUN. Local development can continue in either case.

Inspect the actual repository plan, visibility, and enabled controls before claiming enforcement. GitHub's current documentation places private-repository branch protection, Rulesets, and CODEOWNERS support on eligible paid plans. Do not claim those protections for a Free private repository or silently purchase an upgrade. [S12]

Where supported, configure required checks/review and the expected check source using native repository controls. Where unsupported:

1. Keep actual CI and independent review.
2. Verify the exact candidate before a separately authorized merge.
3. Use native agent permission limits for merge/push where available.
4. Explicitly record that authorized writers can bypass this cooperative process.
5. Do not build a custom GitHub enforcement service merely to hide that limitation.

A CODEOWNERS file by itself is not evidence of enforced review.

### 9.4 Always aggregate actual required results

GitHub can treat skipped or neutral checks as satisfying required-status-check rules. Therefore required verification needs an always-running aggregate that inspects actual job results. [S12]

For a workflow whose required jobs are `verify`, `qualification`, and `security`, use this **job fragment** under its existing `jobs` map. `qualification` runs the actual `mise run qualify` task. If the verification job instead runs both tasks, remove the separate job from both declarations after review; never omit actual qualification.

```yaml
acceptance:
  name: acceptance
  if: ${{ always() }}
  needs: [verify, qualification, security]
  runs-on: ubuntu-latest
  permissions: {}
  steps:
    - name: Require every verification job to succeed
      env:
        REQUIRED_RESULTS: ${{ toJSON(needs) }}
      run: |
        python3 - <<'PY'
        import json
        import os
        import sys

        results = json.loads(os.environ["REQUIRED_RESULTS"])
        expected = {"verify", "qualification", "security"}

        if set(results) != expected:
            sys.exit("Required job set does not match the reviewed workflow")

        failed = [
            name for name, result in results.items()
            if result.get("result") != "success"
        ]
        if failed:
            sys.exit("Required jobs did not succeed: " + ", ".join(sorted(failed)))
        PY
```

Add every separately required artifact/platform/contract job to both `needs` and the expected set. The expected set is a reviewed declaration, not a list that can be derived from `needs` at run time. The aggregate cannot prevent a writer from altering both it and the checks; Section 9.1 and native protected controls cover that risk where available. Keep the aggregate free of changed-path exclusions. Required suites inside a job still need non-empty discovery checks; a job-level success does not prove its contents.

The workflow containing this required aggregate must also run for every applicable acceptance event: do not put workflow-level `paths`/`paths-ignore` filters around it. If merge queues are enabled, cover their native event as well. Verify trigger coverage with a change outside ordinary source paths. An omitted workflow is NOT RUN, never acceptance.

Use a reviewed native workflow based on the repository's trusted configuration. For matrices, require every supported target; do not treat a cancelled or omitted matrix entry as qualification. Artifact/report uploading may run on failure, but must not replace the failed job's result.

Compare the actual executed matrix/platform identities from native job listings/reports with the reviewed supported-target inventory. The aggregate's `needs` map alone cannot detect a supported target removed from the matrix definition.

Qualify the aggregate with a failing, skipped, cancelled, and absent required job in an isolated workflow test. Each must reject acceptance.

### 9.5 Workflow lint and CI security

Run `actionlint` when workflow YAML exists. Run `zizmor` when workflows or local actions exist; an action-only repository does not gain workflow validation merely by invoking actionlint.

```bash
actionlint
zizmor --offline .
```

Install ShellCheck if its embedded-shell coverage is claimed. Inspect actionlint diagnostics for absent optional analyzers. zizmor offline mode omits checks needing online information; report that scope accurately. [S13]

Use ordinary or JSON zizmor output for the authoritative exit code. Its SARIF output mode deliberately returns success despite findings; SARIF can be an additional report, not the only gate. Do not use `--no-exit-codes` in acceptance.

Use read-only CI permissions by default, minimum job-scoped escalation for actual needs, full immutable commit pins for third-party actions, and locked runtime setup. Never execute an untrusted PR head with privileged `pull_request_target` secrets. Do not inject issue/PR text directly into shell code; pass untrusted values as data.

Pin action SHAs by resolving their official release at integration time and preserve that association in configuration. Do not invent a SHA in this manual. Changes to those pins are dependency changes and requalify the affected workflow.

### 9.6 Bind evidence to the source actually tested

Record:

- Checked-out commit from `git rev-parse HEAD` after the first commit; before that, exact relevant file paths/content digests and `UNCOMMITTED`.
- PR head and base commits, if relevant.
- Whether the checkout is a PR merge/test commit or a branch head.
- Tool versions, configuration/lockfile identity, target environment.
- Native check run/job links and reports.
- Artifact digest when an artifact exists.

For final acceptance, use a clean committed candidate. During development, label dirty-tree results provisional and retain the exact diff plus untracked input identity. HEAD alone does not identify uncommitted tested bytes.

Any source, test, policy, configuration, lockfile, rebase, or merge change invalidates affected prior evidence. Rerun the dependency-propagated tasks. After a squash/merge, identify and verify the actual resulting commit before release; a PR's earlier SHA is not the released source.

## 10. Security, operational reliability, and recovery

### 10.1 Secrets and dependency vulnerabilities

**Current-file baseline, including before the first commit:**

```bash
gitleaks dir --redact .
```

After a real commit/history exists, also run:

```bash
gitleaks git --redact .
```

The Git scan covers only the available history; require the intended fetch depth/range for historical claims. Before any commit, history scanning is not yet applicable and the current-file scan remains required. The directory scan includes new files. Use a reviewed configuration to avoid dependency/build-output noise while preserving authored and deployable input. Confirm a non-sensitive synthetic fixture triggers detection. Redact reports. [S14]

A confirmed exposed credential requires the authorized revoke/rotate/recovery path; deleting its source line is not remediation.

For JS/Python and other assigned OSV-supported lockfiles, use pinned OSV-Scanner v2:

```bash
osv-scanner scan source --recursive .
```

Scan actual resolved lockfiles, including `bun.lock` and `uv.lock` where present. Confirm package discovery and database availability. Current OSV exit code 128 means no packages were found, not a clean dependency result. Network/database errors remain BLOCKED. [S15]

For Rust dependency policy, use `cargo deny check` with reviewed `deny.toml` for advisories, sources, and required license/banned-dependency policy. Where OSV also scans Rust, assign a distinct reason or avoid duplicating responsibility. Duplicate scans do not establish complete security. [S18]

For actual containers/IaC, use Trivy's relevant scan:

```bash
trivy config --exit-code 1 .
```

Bind image scans to the actual built image digest, not an unrelated moving tag. Set an explicit nonzero failure policy for relevant findings. Trivy does not replace business authorization or data-isolation tests. [S20]

Security exception records identify the finding, affected version/scope, applicability analysis, reviewer, and expiry/reevaluation trigger. Use native ignore mechanisms narrowly after review. Do not globally lower severity thresholds to clear a failing candidate.

### 10.2 Input, authorization, privacy, and logging

Implement and test the following when the relevant boundary exists:

| Boundary | Required negative test | Expected outcome |
| --- | --- | --- |
| Untrusted input | Missing, malformed, oversized, wrong-type and invalid-range values. | Rejected before consequential mutation; structured error follows contract. |
| Authentication | Missing, invalid, expired or wrong-context credentials. | Access denied; no protected effect. |
| Authorization | Valid actor attempts another actor's resource or unauthorized action. | Access denied independently of UI visibility. |
| Secret handling | Controlled secret-like test value crosses logs/errors/frontend response. | Value absent/redacted at all tested surfaces. |
| Filesystem | Parent traversal, symlink escape, wrong repository identity, unexpected overwrite. | Operation rejected or constrained to the approved ownership/target contract. |
| Environment configuration | Required value absent/malformed; value changed legitimately. | Startup/configuration fails clearly, or the supported new value affects behavior. |
| External service | Timeout, malformed response, denied permission, rate limit. | Documented error/retry; no fake success or secret leakage. |

Use upstream authentication/security primitives. Do not write a generic auth framework that obscures the provider's trust semantics. Run tests through the actual server/process boundary, not only the client.

A secret scanner or schema checker cannot prove authorization correctness. An authorization test does not establish absence of embedded credentials.

### 10.3 Failure injection for supported state changes

For each supported persistent/write operation:

1. Seed known initial state and independent sentinel files/data.
2. Execute normally and inspect actual state.
3. Inject a failure before mutation, during mutation, and after the durable change but before acknowledgement, using test-owned adapters or the actual process boundary.
4. Reopen/restart using the supported recovery path.
5. Inspect state, ownership, locks, temporary artifacts, and retry result.
6. Verify sentinels and unrelated user data remain unchanged.
7. Run concurrent operations and assert safe serialization or a clear conflict.

Use disposable repositories/databases. Production fault injection requires separate authorization.

**Pass:** each exercised point produces a complete valid state or a documented recoverable state; repeated invocation does not duplicate irreversible effects. An error message alone is insufficient.

Use platform/database transaction, lock, atomic-write, and recovery primitives. Implement only product-specific ownership and state rules those primitives do not supply.

### 10.4 Database migration and restoration

**Trigger:** schema, stored format, transaction behavior, backup, or supported upgrade changes.

For a new database with no supported predecessor, apply the initial schema to the actual empty engine and test its constraints, transactions, backup/restore and application behavior as applicable. Record that initial version as the baseline. Do not invent an old schema or migration history. Use the upgrade sequence below only when a supported predecessor actually exists.

Execute against each supported engine:

1. Create the previous supported schema and representative non-sensitive data.
2. Back it up with the engine/provider's native mechanism.
3. Apply the candidate migration using the actual migration command.
4. Check meaningful row counts, constraints, business invariants, schema version, and application read/write behavior.
5. Test rollback if supported; otherwise test the documented restore/forward-repair path.
6. Restore into a fresh database and verify the same invariants.
7. Exercise interruption/conflict behavior required by the deployment.
8. Record migration identity, fixture, engine version, and observed result.

SQLite/D1/PostgreSQL are separate qualification targets. A fake repository does not prove their transactional semantics. Git source rollback is not data restoration.

### 10.5 Local browser service and CLI operations

Activate local-service tests only when a local service exists:

- Bind explicitly to loopback and inspect the actual listener.
- Occupy the requested port and check documented conflict/recovery behavior.
- Reject unauthorized origins/hosts/sessions for state-changing requests as required by the design.
- Test startup, readiness, shutdown, restart, and process cleanup.
- Test path/command boundaries; do not expose an unrestricted file/process API to a browser.
- Verify credentials never enter client payloads.
- Use an available port through the supported API, not a global hardcoded port workaround.

For CLIs, verify `--help`, command discovery, machine-readable output when promised, exit status, stdout/stderr separation, non-interactive behavior, cancellation and actionable errors. Test the actual process, not only the internal function.

### 10.6 Diagnostics and performance

Use the product's structured logger and native status surfaces. Inject a failure and verify it can be located from sanitized diagnostics, state, and exit status. Add OpenTelemetry only when an actual distributed trace requirement exists.

For a performance issue:

1. Capture the representative input, target hardware/runtime, cold/warm state, and expected bound.
2. Measure before and after with the same workload.
3. Profile the observed bottleneck.
4. Repair that cause.
5. Rerun functional and performance verification.

Use native profilers or a maintained benchmark tool such as hyperfine. Report distributions/raw observations, not invented improvements. A performance target becomes a gate only when the new product contract defines the workload, environment and acceptable result.

Measure performance and exposed usage only when needed to resolve a concrete product or budget question. RTK output reduction is not a measurement of total provider cost or subscription allowance.

---

## 11. User experience and artifact qualification

### 11.1 Browser acceptance

For every accepted browser journey, run Playwright against the actual application:

1. Launch the committed dev/build-preview entry.
2. Use role/label-based interaction where possible.
3. Complete the journey with observable result assertions.
4. Exercise relevant loading, empty, validation, authorization, failure and recovery states.
5. Run supported responsive viewports and browser projects.
6. Verify keyboard focus/navigation and form/error labeling.
7. Run `@axe-core/playwright` on the relevant states.
8. Preserve traces/screenshots for failures and critical acceptance evidence.

Use a pinned Playwright browser installation. An engine never executed is not a supported-target PASS. Set `forbidOnly` for CI and reject empty suites. Trace and screenshot evidence comes from rendered behavior, not generated mockups. [S16]

Automated accessibility checks cover only supported conditions. A separate reviewer performs the stated keyboard and usability cases. An axe pass or screenshot match does not establish complete accessibility or product demand.

Use the actual design system's tokens/components. Visual snapshots protect accepted layout but require review when updated; automatic snapshot replacement is not acceptance.

### 11.2 Native language profiles

**Rust:**

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --all-targets --locked
cargo test --workspace --doc --locked
cargo build --workspace --release --locked
```

Execute supported feature/target configurations separately. Omit the doctest task only when the crate inventory proves none apply. Add `assert_cmd`/`tempfile` CLI integration tests and proptest/cargo-mutants for triggered critical logic. Clippy suppressions require the same policy review as TS suppressions. [S18]

**Python:**

```bash
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pytest
```

For typed Python contracts, use the repository's qualified existing analyzer; a new typed profile uses pinned Pyright with explicit Python version/import paths. Add a known type violation during qualification. Ruff is not a type checker. Do not add competing analyzers without a demonstrated need. [S19]

**Shell:** use ShellCheck with the actual shebang/dialect and shfmt over enumerated authored scripts. Test failures and quoting-sensitive filenames. POSIX, Bash, and PowerShell are separate targets; a Unix shell check does not cover PowerShell.

### 11.3 Build, installation, update, and removal

| Artifact | Build authority | Required consumer check |
| --- | --- | --- |
| Rust CLI | Cargo release build for the promised target. | Execute the produced binary from a clean consumer environment. |
| Bun CLI | Committed Bun build/compile task. | Execute the actual package/binary with assets and native dependencies. |
| Node/npm package | Committed build and packaging operation. | Install the produced tarball in a clean fixture and import/run public entry points. |
| Vite web application | Vite production build. | Serve the build and run accepted browser journeys. |
| Container | Actual build configuration and image digest. | Start that image; exercise health, behavior and recovery; scan that image. |

For Bun-managed JS packaging, use `bun pm pack` and inspect the tarball before installing it into a disposable consumer. Do not publish while testing. Use an existing qualified pack operation when the distribution requires another native path. [S09]

Check assets, executable permission, secrets in the package, unintended fixture/private-source inclusion, startup/shutdown, public exports, version output, and dependencies. Test each advertised architecture/OS. Cross-compilation alone does not prove execution.

If installation, upgrade, rollback, or removal is promised, test those operations in disposable consumer environments. Removal deletes only product-owned assets; user-modified conflicts follow the documented recovery rule.

Derive version output from one owning manifest/release source. For Rust, use Cargo package metadata; for JS, use package/release metadata. Do not maintain independent hardcoded version strings across implementations.

### 11.4 Release bookkeeping

Use Changesets for versioned JS packages where applicable; use the native release process for Rust/other artifacts. Verify public contract changes, version metadata, release notes and generated outputs agree. A Conventional Commit cannot prove SemVer correctness.

Use Commitlint when conventional commits drive the release policy. For squash workflows, validate the actual squash title/message, not just development commits. Keep one hook manager; this profile selects Lefthook. Remove an overlapping Husky chain during adoption after checking its actual duties.

No release task executes implicitly as part of build, verify, or package inspection.


## 12. Qualify the new-project foundation

### 12.1 Complete the initial path in order

Use this path once the new product input is sufficient. If a dependency fails, complete independent safe work and report that exact blocker.

| Order | Action | Completion evidence |
| --- | --- | --- |
| 1 | Inspect the actual target and capabilities under Section 2.1. | Exact path and `NO_GIT`, `UNBORN` or `COMMITTED`; existing files preserved. |
| 2 | Record the new product's first behavior and chosen runtime. | Current task or `docs/PROJECT.md`; no inherited product requirements. |
| 3 | Initialize the local repository/manifest and minimum tools. | Actual native files and executable versions; exact dependencies and first locks. |
| 4 | Implement the first real source behavior and its test. | Correct effect plus relevant failure/preservation assertions through the intended surface. |
| 5 | Bind the applicable native tasks and configuration. | Commands refer to non-empty real inputs; scopes match the target. |
| 6 | Qualify each initial gate using valid and representative invalid cases. | Valid case passes; the intended violation fails with its expected diagnostic. |
| 7 | Inspect source/staged contents and create the first real commit when permitted. | No generated secrets/irrelevant files; real commit identity or an explicit commit blocker. |
| 8 | Reinstall and run both `verify` and `qualify` from a clean disposable checkout of the committed candidate. | Locked installation, ordinary checks, qualification and accepted behavior reproduced; no lockfile drift or unexpected source mutation. |
| 9 | Report scope-specific completion under Section 14. | Initialization, tooling and product results stated separately. |

For step 8, use a new unused task-owned directory and a local clone of the exact committed candidate (no remote network is needed). `git clone --no-local --no-checkout "$PROJECT_ROOT" "$VERIFY_ROOT"` followed by `git -C "$VERIFY_ROOT" checkout --detach "$CANDIDATE_SHA"` is the native path when those variables have been bound to the observed source, unused destination and committed SHA. Check the resulting SHA and clean state before installation; never copy working-tree secrets or untracked source into the clone. If required inputs are absent, the candidate is incomplete. Check for unexpected tracked and untracked changes after locked installation and verification; retain reports only in declared output scopes. A first local commit does not require a remote. A local working result does not prove hosted CI, a released package, another OS, or enforced branch protection.

### 12.2 Keep the initial file set small

| File or output | When to create it | What it owns |
| --- | --- | --- |
| Native manifest and lockfile | The selected language/runtime is known. | Dependencies, scripts and reproducible resolution. |
| `mise.toml` and applicable mise lock | Runtime/standalone tools are selected. | Exact versions and the native task composition. |
| Actual source and tests | The first approved behavior is known. | Product behavior and requirement-derived assertions. |
| Native checker/formatter/linter configuration | Relevant source exists. | Actual targets, ownership and diagnostics. |
| `docs/PROJECT.md` | New product facts need durable context. | User outcome, scope, selected target and consequential decisions. |
| `AGENTS.md` | The project is ready for repeated agent work. | Short pointers to the product brief, local manual and actual commands. |
| Native test reports / current task result | A check actually runs. | Candidate-bound evidence and explicit limitations. |
| Architecture/API/release/CI configuration | Its Section 3 activation condition becomes true. | That specific capability only. |

Do not create empty architecture layers, fake test files, a task database, a permanent planning archive, a coordination service, or a remote repository solely to satisfy a document template.

### 12.3 Reject false bootstrap success

Use native tests and qualification fixtures for these cases. A scope review maps activated rows to the actual tests; tool output alone cannot decide product intent.

| Condition | Required treatment |
| --- | --- |
| Empty folder has no type errors | Type checking is NOT RUN until real intended TS inputs exist. |
| Empty or missing test suite exits successfully | Required behavior gate fails discovery; it is not PASS. |
| Initializer emits an alternate TS checker | Replace the generated task with tsrs before qualification. |
| Generated agent instructions conflict with current scope | Remove/rewrite only newly generated instructions; current task governs. |
| Approved capability has no implementation | Keep it NOT RUN/BLOCKED; do not relabel it NOT APPLICABLE. |
| Qualifier fails because executable/configuration is broken | Qualification fails; it did not demonstrate the intended negative case. |
| A formatter or fixer rewrites converged content | Section 6.2 rejects the tool ownership/configuration. |
| A task excludes all new source/tests | Inventory assertions reject the narrowed inputs. |
| Compiler/test passes only against a trivial example | It qualifies only that example; the approved behavior remains unverified. |
| Local checks pass and no hosted CI exists | Report local results; no hosted/enforced claim. |
| No first commit or clean clone can be produced | Keep commit-bound/cold-checkout qualification incomplete; preserve current work. |
| New accepted behavior remains unspecified | Block that product step and ask the essential outcome question. |

### 12.4 Optional external integrations

Apply this only when the new product actually promises a provider, plugin, hook, MCP or other integration.

1. Identify the actual product, supported surface/version, native schema and permitted operation.
2. Validate native configuration against current upstream documentation.
3. Exercise the real trigger/request and inspect its non-sensitive response/effect.
4. Test relevant invalid input, unavailable service, authorization denial, timeout/disconnection and recovery in disposable scope.
5. Record the actual platform boundary and any unsupported promise.

Installed/configured is not verified. Do not assume parity across client surfaces or invent events/adapters to replace unavailable native features. Integration behavior comes from the new product contract, not from older product roles.

### 12.5 Use upstream capabilities directly

Before adding owned infrastructure, identify the new approved behavior, the upstream capability evaluated, its demonstrated unmet requirement, the smallest implementation needed and its test/maintenance obligation.

If no unmet product requirement exists, use the upstream capability directly. Native task composition and small repository assertions are sufficient; there is no requirement for a new scheduler, memory service, approval system, universal policy language or coordination framework.

---


## 13. Validate the candidate and perform only requested external actions

### 13.1 Inspect the actual change

Before reporting a verified candidate:

1. Inspect the exact changed files and their affected dependencies.
2. Resolve obsolete code and unused dependencies within the change, using Knip/native findings where applicable. Confirm public/dynamic consumers before deletion.
3. Regenerate affected outputs and run drift checks, including new untracked outputs.
4. Update the owning product/usage/configuration instructions only where behavior changed.
5. Inspect changes to ignore files, suppressions, test selection, snapshots and exception rules.
6. Apply the assigned formatter once; inspect the diff; use check mode thereafter.
7. Run all applicable native checks and the accepted behavior against the candidate. At integrated acceptance run both `mise run verify` and `mise run qualify`, with fresh candidate-bound results as specified in Section 3.4.
8. Record unresolved findings and source identity.

Knip reports candidates for analysis, not blanket deletion permission. Qualify its entry/framework discovery. Exact Git diffs remain authoritative; a visual diff aid does not change source identity. Do not upgrade unrelated dependencies or clean unrelated files. [S17]

For maintained English source/documentation, run pinned `typos` with reviewed technical vocabulary when that scope is activated. Use `lychee` on actual documentation paths when checking links. Distinguish local checks from an actual online run; network/authentication failure neither proves a broken URL nor supplies a successful online check. [S22]

### 13.2 Review and optional hosting

Obtain the independent review required by Section 9, resolve consequential findings, and rerun invalidated evidence. Bind the review to the current candidate. The manual does not require a fixed agent team, model routing, delivery channel, branch naming system or coordination sequence.

For local-only work, retain source and native reports in the authorized workspace and report the result. An issue/PR is not a prerequisite.

If the current task includes hosting:

1. Resolve the account, repository name, visibility and authorization from the current task and platform state.
2. Use the native provider operation to create/connect the intended remote only within that authorization.
3. Add the activated workflow checks; inspect actual CI execution for the candidate.
4. Open/update a PR only when that is the authorized workflow.
5. Merge only when authorized and its actual required checks/review are satisfied. Follow the current repository's merge policy.

Do not reconstruct an old repository or inherit its identity/visibility. Do not invent a remote, issue, PR or enforcement result. Local `act` output is not hosted CI acceptance.

### 13.3 Optional publication

Apply only if the approved outcome includes publication/deployment.

1. Verify the accepted source, version, built artifact digest, actual target and required reports.
2. Execute the artifact's supported installation/runtime checks and applicable migration/recovery checks.
3. Finish the reviewable candidate before requesting any missing protected authorization.
4. Publish through the authorized native workflow.
5. Observe the installed/deployed identity and accepted behavior.
6. If it fails, use the tested recovery action within authorization and report the observed state.

Without publication authorization, finish the candidate/package and state the pending action. A successful build/upload is not a release claim.

### 13.4 Continue interrupted work from observed state

Keep only enough current context to resume: the task outcome, actual directory/candidate, decisions already made, valid and invalidated results, and the first incomplete action.

Use the execution environment's native task/session features. On resumption, inspect source state again and continue from the incomplete dependency. Do not revive deleted project scope or introduce a new collaboration/memory method. An interruption or usage limit does not convert unfinished work into completion.

---

## 14. Acceptance report and stage exits

### 14.1 Required evidence record

Use the current task result and native reports; use the existing issue/PR only when one exists. Include the following fields and link to original reports instead of copying success summaries.

| Field | Required content |
| --- | --- |
| Outcome | What a user can actually do; prototype/iteration/release state. |
| Scope | Owning task and acceptance cases exercised. |
| Candidate | Tested commit/tree and clean/dirty state; before the first commit, exact file digests and UNCOMMITTED. Include a base/PR identity only when one exists. |
| Environment | OS/architecture, runtime, tool/lockfile identity, external services used. |
| Checks | Task/command, input/suite scope, observed result, original report/log link. |
| Negative evidence | Which representative fault each important gate rejected. |
| Artifact | Produced filename/digest and actual installation/runtime result. |
| Review | Triggered review: separate reviewer, scope/candidate, findings and resolution; otherwise state why it was not triggered. |
| Exceptions | Narrow documented applicability/exception plus reevaluation trigger. |
| Limitations | Missing platforms, unavailable protection, blocked or untested capability. |
| Next action | Agent-owned next step or one specific non-derivable/protected blocker. |

Do not store raw secrets in evidence. A recorded PASS with no linked execution is a reporting defect.

### 14.2 Stage gate matrix

| Stage | Required before exiting | Not a substitute |
| --- | --- | --- |
| Target preparation | Correct task-owned path, observed capabilities, new product input or explicit missing fact. | Invented product behavior or recovered old requirements. |
| Repository initialization | Native repository/manifest and real files; unborn/committed state stated truthfully. | An empty commit or installed tools relabeled as a product. |
| Toolchain qualification | Applicable locked tools, non-empty real tasks, positive/negative gate results and cold-checkout result when committed. | An empty source tree or missing inputs treated as PASS. |
| Prototype | Actual scoped journey, minimal applicable integrity checks, explicit simulations/limits. | Plans or static imagery. |
| Iteration | Changed journey plus affected existing behavior; applicable checks; clean working candidate. | One edited test passing. |
| Verified candidate | Full applicable `verify` and `qualify`, scoped change inspection, triggered independent review. | Bypassable local hooks or an unrun CI configuration. |
| Hardening | Complete approved scope; applicable failure, property, mutation, migration, platform and artifact qualification. | A prototype relabeled production. |
| CI acceptance | Exact candidate, real required results, no skipped/empty acceptance, preserved reports. | A green aggregate built from missing jobs. |
| Release | Authorized action, qualified artifact and operational/recovery evidence. | Successful compilation alone. |
| Post-release | Observed installed/deployed identity and accepted behavior. | A successful upload. |

### 14.3 Failure routing table

| Failure | Next action | Work that may continue |
| --- | --- | --- |
| Formatter/fixer changes converged output | Inspect ownership/config/version and per-tool rewrite. | Unrelated isolated work; no acceptance of affected source. |
| tsrs unsupported option/diagnostic mismatch | Reproduce with pinned mode/version/config; fix configuration or report upstream with reproduction. | Independent scopes; no compiler substitution. |
| Missing parser/rule/input/test | Repair discovery/installation; rerun negative qualification. | Unrelated verified scopes. |
| Regression/property failure | Use Section 5.3; preserve counterexample. | Independent tasks only. |
| Surviving relevant mutant | Strengthen the requirement-derived assertion or repair implementation. | Other accepted scopes; no silent threshold reduction. |
| CI skip/cancellation/missing result | Repair dependency/applicability/run; rerun actual required job. | Local investigation. |
| Protected action lacks authorization | Complete its concrete reviewable candidate and request only that permission. | All safe prerequisites. |
| Native capability unavailable | Record BLOCKED and evaluate a supported upstream alternative within constraints. | Independent work; no invented emulation/paid fallback. |
| Product fact cannot be derived | Present the concrete unresolved consequence and a concise native choice. | Safe work not dependent on that fact. |
| Budget exhausted | Preserve checkpoint and incomplete status. | Resume later from the recorded action. |

### 14.4 Final definition of done

A production increment is accepted only when:

- The complete approved outcome is demonstrated.
- Each active gate has valid PASS evidence or a reviewed, factually inapplicable status.
- Important behavior and failure paths are verified against independent oracles.
- Guardrail/config changes have their positive and negative qualification; integrated acceptance requires fresh `verify` and `qualify` results for the exact candidate.
- Source, generated artifacts, documentation, version and packaging agree.
- Required independent review is complete for the accepted candidate.
- The actual artifact and promised runtime/platform lifecycle are qualified.
- No unresolved required FAIL, BLOCKED or NOT RUN is hidden.
- Publication is authorized when publication is part of the requested outcome.
- Remaining eligible limitations and follow-up are explicit.

A prototype has its own narrower exit in Section 5.1. It never closes the complete product contract.

---

## 15. Concept-to-check traceability

**M** = mechanical analysis; **B** = behavior/experiment; **R** = separate evidence-based review. R is used where a tool cannot honestly decide the meaning. All three require concrete evidence; only actual platform controls establish enforcement.

| Original concept / failure mode | Type | Tool or concrete check | Required rejection/evidence | Recipe |
| --- | --- | --- | --- | --- |
| Working software first | B | Actual CLI/API/browser invocation. | A non-running/static-only result cannot satisfy journey acceptance. | 5.1, 11 |
| Progressive lifecycle | M+R | Stage evidence and native required-task results. | Prototype evidence cannot close release scope. | 14 |
| Preserve full product scope | R | Acceptance-case comparison against the current product brief. | Missing promised behavior is incomplete. | 2.6, 14 |
| Prototype mocks are honest | B+R | Test/demo identifies real versus simulated effects. | Fake provider behavior cannot satisfy a production claim. | 5.1 |
| Deterministic local execution | M | Locked native tasks and original exit status. | Wrapper/report success cannot mask checker failure. | 3–4 |
| Upstream/native first | R | Actual upstream capability and unmet-need comparison. | Unnecessary duplicate platform functionality is rejected. | 12.5 |
| Reproducible environment | M+B | mise lock, frozen Bun/Cargo/uv install, cold checkout. | Missing lock, changed resolution or unsupported platform blocks. | 3.3 |
| One version/install owner | M+R | Manifests/tool inventory and generated version output. | Conflicting pins or independently hardcoded versions fail. | 3.2, 11.3 |
| tsrs-only authority | M | Real tsrs tasks, mode and negative type fixtures. | Alternate checker/empty root is not accepted. | 6.1 |
| Correct runtime target | M+B | Target-specific config and real runtime execution. | Wrong ambient globals or unexecuted target fails. | 6.1, 11 |
| Formatting stability | M+B | One owner, per-tool converged-content comparison. | Hidden rewrite cycles and overlapping owners fail. | 6.2 |
| No type escape | M+B | Oxlint explicit rules and counterexamples. | Any/casts/suppressions cannot quietly erase the contract. | 6.3 |
| No swallowed failure | M+B | Promise/error rules plus injected failure tests. | Ignored rejection or success after failure is rejected. | 6.3, 10 |
| No global hardcoded workaround | M+B+R | Boundary rules; alternate configuration and isolation tests. | Named constant alone does not justify wrong behavior. | 6.3, 8.3 |
| Policy as code | M+B | Native rule tests and actual negative scans. | Empty rules/targets, parse errors or ignored files cannot pass. | 3.4, 6.4 |
| Modular boundaries | M | dependency-cruiser or native crate graph tests. | Cycles, forbidden direction, type-only/deep/alias bypass fail. | 7.1–7.2 |
| Domain purity | M+B | Graph restrictions and isolated domain tests. | Infrastructure/global access fails. | 7.3 |
| Useful abstraction | R | Real consumers, responsibility, change boundary. | Speculative layer without an unmet need is removed. | 9.2 |
| Adapter portability | B | Shared contracts plus actual provider tests. | Fake implementation cannot qualify real provider semantics. | 7.3 |
| Schema-first contracts | M+B | Native schema validation and malformed-input cases. | Invalid input/contract drift rejected. | 7.4 |
| Domain/API/storage separation | M+B | Dependency rules and response-field tests. | Storage-secret leakage or wrong ownership fails. | 7.4 |
| Single source of truth | M+R | Generator ownership and fresh drift comparison. | Stale, deleted or new untracked derived files fail. | 7.5 |
| API compatibility | M+B | Spectral, oasdiff and real handler/client tests. | Declared or runtime incompatibility is explicit. | 7.5 |
| Meaningful regression | B | Same oracle fails on faulty implementation, passes on repair. | Setup failure is not reproduction. | 5.3 |
| General behavior, not sample fitting | B | fast-check/proptest/Hypothesis plus independent oracle. | No-op/constant/overfit implementations rejected. | 8.3 |
| Effective tests | B | Scoped StrykerJS/cargo-mutants/mutmut and fault injection. | Relevant surviving faults cannot hide behind coverage. | 8.4 |
| Root-cause repair | B+R | Discriminating experiment, regression, related cases. | Symptom-only patch lacks required evidence. | 5.3 |
| Protected acceptance criteria | M+R | Diff of tests/policy; independent review. | Assertion/skip/exclusion changes cannot silently redefine success. | 9.1 |
| No false-green CI | M+B | Required-result aggregate and discovery checks. | Skipped/neutral/cancelled/empty/stale result rejected. | 9.4 |
| Workflow security | M+R | actionlint, zizmor, permissions/action-pin review. | Privileged untrusted execution or status masking fails. | 9.5 |
| Actual merge enforcement | M+R | Native repository capability/settings inspection. | Free-private cooperative CI is not labeled enforced protection. | 9.3 |
| Candidate-bound evidence | M | Git identity, clean tree, native run and artifact digest. | Dirty/stale/different SHA cannot stand in for candidate. | 9.6 |
| Independent review | R | Separate reviewer result bound to revision. | Self-narrated multiple roles do not qualify. | 9.1–9.2 |
| Continuous simplification | M+R | Knip/native findings and responsibility review. | Dead code removed only after consumer validation. | 13.1 |
| Documentation hygiene | M+R | typos, lychee, actual usage/configuration comparison. | Broken local references, stale instructions and unsupported online claims are resolved. | 13.1 |
| User experience | B+R | Playwright/CLI cases and actual interaction review. | Static appearance cannot prove the journey. | 11.1 |
| Accessibility | M+B+R | axe, keyboard/focus/error interaction cases. | Automated pass is not full accessibility proof. | 11.1 |
| Secret/privacy protection | M+B | Gitleaks, redaction and response/log tests. | Sensitive value exposure fails. | 10.1–10.2 |
| Authorization/data integrity | B | Cross-actor, transaction and invariant tests. | UI-only checks or partial unsafe writes fail. | 10.2–10.4 |
| Safe local server | M+B | Listener, origin/session, port and path tests. | Unexpected exposure/unsafe mutation fails. | 10.5 |
| Interruption/retry/concurrency | B | Native failure injection and real state inspection. | Corrupt, duplicate or silently partial state fails. | 10.3 |
| Migration/backup/restore | B | Actual engine migration and restoration rehearsal. | Source rollback cannot substitute for data restoration. | 10.4 |
| Artifact/distribution truth | M+B | Packaged artifact inspection and clean consumer execution. | Source-only success cannot qualify installation. | 11.3 |
| Release/SemVer hygiene | M+R | Native metadata/Changesets, contract diff, artifact version. | Version/output/contract mismatch fails. | 11.4, 13.3 |
| Resume from actual state | M+R | Source identity and native reports compared with current files. | Stale evidence or imported deleted-project requirements rejected. | 2, 13.4 |
| Budget and performance | M+B | Actual timings, profiles and exposed usage measurements. | Unsupported savings/quality scores are not facts. | 10.6 |
| Empty-project correctness | M+B+R | Git state classifier, native initialization, real input/task qualification. | Missing HEAD, parent-repository confusion, empty checks and inherited product scope rejected. | 2, 12 |
| Hooks/MCP work in reality | M+B | Native schema plus actual trigger/tool calls. | Installed/configured-only integration is incomplete. | 12.4 |
| Honest completion | M+R | Evidence record and stage conditions. | Unrun/blocked checks or unpublished artifacts cannot be described as complete/released. | 14 |

### 15.1 Tools intentionally not made universal requirements

- **Biome/Prettier as a second formatter:** removed from the new Oxfmt profile's overlapping scopes.
- **SonarQube, CodeQL, or hosted analysis dashboards:** not added merely for another quality score. They may be evaluated for a demonstrated analysis gap and available licensing; no new paid service is assumed.
- **OPA/Conftest:** use only when an actual infrastructure/configuration policy spans inputs native validators cannot cover. Do not introduce a generic policy platform for ordinary source rules.
- **Full mutation analysis on every commit:** replace with the triggered bounded scope in Section 8.4.
- **Storybook, OpenTelemetry, containers and `act`:** activate only for their specified product need.
- **Custom orchestration and memory services:** use supported native platform capabilities only when the current task needs them.
- **Universal arbitrary line-count/complexity scores:** use observed maintenance/performance problems and concrete review/test evidence.

The goal is a smaller set of non-overlapping checks that can reject the relevant failure, not the largest installed tool list.

## 16. Primary sources and qualification limits

The source index records the upstream references retained from the preceding revision. This second-pass audit rechecked the changed tsrs, Oxfmt, mise lock, Bun discovery, Stryker, uv, mutmut and Codex instruction claims on **2026-11-27**. These references support documented capabilities and syntax, not proof that the integrations run in the new project. During bootstrap and upgrades, read the documentation matching the installed version and run the specified qualification fixtures.

### S01 — tsrs and type-aware checking

- [Oxc type checker](https://oxc.rs/docs/guide/usage/typechecker)
- [tsrs compatibility](https://github.com/oxc-project/tsrs/blob/main/docs/COMPATIBILITY.md)
- [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware)

The explicit tsrs choice is preserved. Beta compatibility, fast-mode behavior, whole-program coverage and unsupported initialization remain qualification concerns.

### S02 — Formatting scope and commands

- [Oxfmt language support](https://oxc.rs/docs/guide/usage/formatter/language-support)
- [Oxfmt CLI](https://oxc.rs/docs/guide/usage/formatter/cli)
- [Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config-file-reference)
- [Biome language support](https://biomejs.dev/introduction/language-support/)

The earlier split was simplified because supported scopes overlap. Per-tool stability is a control designed in this manual, not a claim that any formatter guarantees compatibility with every other fixer.

### S03 — Explicit lint policy

- [Oxlint rules](https://oxc.rs/docs/guide/usage/linter/rules)
- [Promise-rule options](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-floating-promises)
- [Type-comment options](https://oxc.rs/docs/guide/usage/linter/rules/typescript/ban-ts-comment)
- [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config)

Verify actual rules and test-runner forms with negative fixtures; rule names alone do not establish coverage.

### S04 — Versions, tasks and caches

- [mise version requests](https://mise.jdx.dev/dev-tools/versions)
- [mise lockfile](https://mise.jdx.dev/dev-tools/mise-lock.html)
- [mise TOML tasks](https://mise.jdx.dev/tasks/toml-tasks.html)
- [Turborepo task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)

### S05 — Architecture analysis

- [dependency-cruiser CLI](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md)
- [dependency-cruiser rules](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
- [dependency-cruiser options](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md)
- [Parser and dynamic-import limitations](https://github.com/sverweij/dependency-cruiser/blob/main/doc/faq.md)

### S06 — Structural rules

- [ast-grep native rule tests](https://ast-grep.github.io/guide/test-rule)
- [ast-grep CLI](https://ast-grep.github.io/reference/cli)
- [ast-grep severity and failure](https://ast-grep.github.io/guide/project/severity)

### S07 — Semgrep

- [Semgrep rule tests](https://docs.semgrep.dev/writing-rules/testing-rules)
- [Semgrep CLI and exit behavior](https://docs.semgrep.dev/cli-reference)

### S08 — OpenAPI validation and compatibility

- [Spectral CLI](https://github.com/stoplightio/spectral/blob/develop/docs/guides/2-cli.md)
- [oasdiff breaking-change checks](https://github.com/oasdiff/oasdiff/blob/main/docs/BREAKING-CHANGES.md)

### S09 — Bun execution and packaging

- [Bun TypeScript](https://bun.com/docs/runtime/typescript)
- [Bun test runner](https://bun.com/docs/test)
- [Bun test discovery and exact paths](https://bun.com/docs/test/discovery)
- [Bun package utilities](https://bun.com/docs/pm/cli/pm)

Bun's available check features do not alter this manual's explicit tsrs authority.

### S10 — Property testing

- [fast-check with Bun](https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-bun-test-runner/)
- [fast-check model-based testing](https://fast-check.dev/docs/advanced/model-based-testing/)
- [Stable fast-check documentation](https://v4.fast-check.dev/)

The main documentation currently includes preview APIs. Use version-matched stable package documentation when integrating; the linked stable host was not fully retrievable in this review.

### S11 — Mutation testing

- [StrykerJS configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)
- [StrykerJS incremental limitations](https://stryker-mutator.io/docs/stryker-js/incremental/)
- [Official Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)

### S12 — GitHub enforcement and plan boundaries

- [Protected branches and accepted check states](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
- [CODEOWNERS availability](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

Availability must be observed for the actual repository; these documents do not prove its settings are enabled.

### S13 — Workflow validation

- [actionlint usage](https://github.com/rhysd/actionlint/blob/main/docs/usage.md)
- [zizmor usage, output and exit codes](https://docs.zizmor.sh/usage/)

### S14 — Secret detection

- [Gitleaks commands and configuration](https://github.com/gitleaks/gitleaks)

### S15 — Resolved dependency scanning

- [OSV-Scanner usage](https://google.github.io/osv-scanner/usage/)
- [OSV supported lockfiles](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)
- [OSV output and return codes](https://google.github.io/osv-scanner/output/)

### S16 — Browser verification

- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [Playwright trace viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright best practices](https://playwright.dev/docs/best-practices)

### S17 — Unused-code analysis

- [Knip entry/project scope](https://knip.dev/guides/configuring-project-files)
- [Knip configuration](https://knip.dev/reference/configuration)
- [Knip finding resolution](https://knip.dev/guides/handling-issues)

### S18 — Rust CLI, property tests and mutation tests

- [Cargo command reference](https://doc.rust-lang.org/cargo/commands/index.html)
- [Clippy](https://doc.rust-lang.org/clippy/)
- [assert_cmd](https://github.com/assert-rs/assert_cmd)
- [proptest](https://github.com/proptest-rs/proptest)
- [cargo-mutants configuration](https://mutants.rs/config-file.html)
- [cargo-mutants exit codes](https://mutants.rs/exit-codes.html)
- [cargo-deny](https://github.com/EmbarkStudios/cargo-deny)

### S19 — Python verification

- [uv locked synchronization](https://docs.astral.sh/uv/concepts/projects/sync/)
- [Ruff](https://docs.astral.sh/ruff/)
- [Pyright configuration](https://github.com/microsoft/pyright/blob/main/docs/configuration.md)
- [Hypothesis stateful testing](https://hypothesis.readthedocs.io/en/latest/stateful.html)
- [mutmut configuration and requirements](https://mutmut.readthedocs.io/en/latest/)

### S20 — Deployment scanning

- [Trivy scan and exit configuration](https://trivy.dev/docs/latest/configuration/others/)


### S21 — Codex task capability and context

- [Codex prompting guide — AGENTS.md discovery](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)
- [Iterating development workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)

Use native instructions, workspace isolation and approval controls actually exposed by the selected Codex client. A handoff file does not start a session. Environment access, independent review capability and available actions must be observed, not inferred from the client name.

### S22 — Documentation and release hygiene

- [typos](https://github.com/crate-ci/typos)
- [lychee usage](https://lychee.cli.rs/guides/getting-started/)
- [Lefthook configuration](https://lefthook.dev/configuration/index.html)
- [Commitlint local integration](https://commitlint.js.org/guides/local-setup.html)
- [Changesets](https://github.com/changesets/changesets)


### S23 — New-project initialization

- [Git initialization](https://git-scm.com/docs/git-init)
- [Git repository and revision discovery](https://git-scm.com/docs/git-rev-parse)
- [Bun initialization and generated files](https://bun.com/docs/runtime/templating/init)
- [mise installation and initial setup](https://mise.jdx.dev/getting-started.html)
- [Cargo initialization](https://doc.rust-lang.org/cargo/commands/cargo-init.html)
- [uv project creation](https://docs.astral.sh/uv/concepts/projects/init/)

Native initialization, first dependency resolution and frozen reinstallation are different operations. Inspect generated checking tasks, target types and agent instructions before accepting a scaffold.

---

---

## Document validation record

**Second-pass audit — 2026-11-27.** The preceding greenfield English blueprint and handoff were reopened and reviewed; this revision preserves their 16 chapters and 49 traceability controls, corrects the execution gaps below, and adds a Codex-specific handoff. The Chinese edition preserves all executable examples and the operational structure, with redundant explanatory prose consolidated. This is a self-audit, not a newly obtained independent reviewer result.

| Finding | Resolution |
| --- | --- |
| Qualification could be configured without fresh acceptance execution. | Separate mandatory `verify` and `qualify` at integrated acceptance, explicit invalidation, CI qualification result and nonrecursive discovery. |
| Bun path filters are substring matches; mutation could count tooling assertions. | Qualify actual suite identity; use exact native paths when needed; mutation subprocess uses behavior-only tests. |
| Lock creation and frozen verification were easy to conflate. | Separate `mise lock` bootstrap mutation, retain sidecars, cold checkout, distinguish installed-cache trust from download verification. |
| Formatting ownership in non-JS projects and activation gaps were ambiguous. | Native-only standalone Oxfmt option; explicit text, resolved dependency, structural, documentation and local-process activation. |
| Python critical logic lacked a mutation-engine recipe. | Conditional mutmut with explicit behavior scope, fresh disposable results, fork support limitation. |
| A clean initial commit could be confused with accepted baseline. | Exact committed candidate clone, no untracked secrets/source copied, clean-state checks, accepted baseline distinct from local snapshot. |
| Effective Codex instructions, backend selection and candidate-controlled evidence required stronger boundaries. | Observe instructions/permissions, confirm tsrs backend, compare source state, independently review changes to the gate's own inputs. |

Actual document checks performed in a disposable environment:

- Parsed all 25 fenced examples: 17 Bash (`bash -n`), five JSON, one TOML, one JavaScript (`node --check`) and one YAML. Every example is byte-identical between English and Chinese.
- Ran the actual Git state classifier against 11 cases: empty directory with spaces, unborn, committed, nested parent repository, linked worktree, bare, malformed marker, corrupt reference, symlinked path, missing path and occupied non-repository. All classifications/rejections matched expectations; the occupied directory's sentinel was preserved. Executed the new exact local clone/detached-checkout path and confirmed candidate identity, a clean tree, and exclusion of an untracked synthetic input.
- Executed the exact CI aggregation script with 11 inputs: success accepted; failure, skipped, cancelled, neutral, timed out, missing qualification, extra job, missing result, malformed job, and all-skipped rejected.
- Parsed both manuals and both handoffs. Verified 16 numbered chapters, 66 matching subsection IDs, 23 source groups, 49 traceability rows, matching upstream URL sets, matching code blocks and resolving paired local document links; both handoffs contain six execution steps and the same checker/acceptance entry points.
- Rechecked the upstream sources identified in Section 16 for the changed tool and Codex claims. The remaining source index is retained reference material, not a claim that all URLs were revisited.

**Not executed:** actual user project initialization, package/runtime installation, tsrs/Oxlint/dependency-cruiser execution, product test suites, mutation engines, workflow hosting, repository enforcement, packaging or deployment. This environment did not contain Bun/mise or a separate reviewer for a full integration test. Syntax checking and the isolated experiments above do not prove native CLI compatibility or completeness of any future product. No Codex session was started and no repository or account was changed. Use Sections 3.4, 12 and 14 for real project qualification and evidence.
