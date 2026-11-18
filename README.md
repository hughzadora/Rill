# Rill

Rill provides shared personal preferences, explicit project enrollment, task recovery, and Codex-native integration under validation. Matt Pocock skills provide engineering methods.

## Project documents

- [PRD](PRD.md): users, scope, exclusions, and observable acceptance.
- [Architecture](ARCHITECTURE.md): modules, interfaces, state ownership, and native boundaries.
- [Design](DESIGN.md): confirmed behavior and rationale; [DESIGN.html](DESIGN.html) is the approved visual review.
- [Glossary](GLOSSARY.md): Rill domain terms.
- [Project policy](POLICY.md): authority, native control, and delivery boundaries.

GitHub is authoritative for decisions and execution: [approved design #17](https://github.com/hughzadora/Rill/issues/17), [current delivery #18](https://github.com/hughzadora/Rill/issues/18), and [process #16](https://github.com/hughzadora/Rill/issues/16).

From a target Git checkout, run `node /path/to/Rill/tools/project-enrollment.ts enroll owner/repository`, then bind its task with the task-sync tool. Enrollment resolves the current GitHub publisher, preserves existing tools and edits only Rill's native plugin enable key and enrollment files. Existing publisher or repository conflicts require reconciliation. Install/review the plugin through Codex's native controls; enrollment does not grant trust.

Run `node /path/to/Rill/tools/project-enrollment.ts leave` to disable the project entry after pending facts are published and read back. Recovery data and publisher configuration remain available; native plugin configuration takes effect on reload. Codex can resolve linked-worktree project configuration from the primary checkout: the enrollment marker independently makes unenrolled hook calls return without task processing. Native hook invocation, task processing and merge protection are separate guarantees.

`node tools/install-personal-policy.ts` installs the short shared entry into the native user `AGENTS.md`, preserving its symlink and all content outside the managed Rill block. Originals are backed up under `~/.local/state/rill/install-backups/`; it leaves native hook trust unchanged.

## Setup and native startup

Use the Node and pnpm versions pinned in [package.json](package.json), Git, Just, an authenticated `gh` account with access to the target issue, and Codex with plugin/hook support. Install the checkout dependencies with `pnpm install --frozen-lockfile`; its prepare script installs Husky hooks. There is no separate application server or build step. The native host launches the stdio MCP server declared in [.mcp.json](.mcp.json); hooks are declared in [hooks/hooks.json](hooks/hooks.json).

For a self-contained local plugin source, run `just stage-plugin /absolute/new/staging-directory`. The directory must not exist; offline production installation needs the pinned packages in the pnpm store. Staging produces source, not an installed or trusted plugin. Native installation uses a configured marketplace: `codex plugin add rill@rill-local` applies to the already configured owner environment. Inspect `codex plugin marketplace --help` and `codex plugin add --help` for another environment; this repository contains a plugin manifest, not a marketplace registration. A portable marketplace bootstrap has not been delivered here.

Review the actual installed definition through Codex's native hooks review, reload the relevant session/configuration, then verify the installed version, available Rill tools and actual event results. Source version, staged version, installed version, trust and observed execution are separate states. The current candidate is not certified by prior-version probes; [#18](https://github.com/hughzadora/Rill/issues/18) tracks the remaining combined-package trial.

## Commands

Run from this checkout unless noted. [Justfile](justfile) and [package.json](package.json) define the commands; `just --list` lists all recipes.

| Need                            | Entry                                                              | Boundary                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fast static feedback            | `just lint`                                                        | Biome checks supported source/configuration and Markdown formatting; factual accuracy, link validity and semantic correctness require separate inspection. Husky pre-commit and pre-push both call this only. |
| Type check                      | `just typecheck`                                                   | TypeScript, when selected by risk or the batch gate.                                                                                                                                                          |
| Targeted behavior check         | `pnpm exec vitest run tests/<file>.test.ts`                        | Select an actual existing test for the affected behavior; not automatic for prose edits.                                                                                                                      |
| Batch full-spec entry           | `just full-spec-ci`                                                | Runs lint, typecheck and test in parallel, retains a candidate/environment receipt. Approved acceptance, native integration and human checks still need their own evidence.                                   |
| Verify saved full-spec evidence | `just ci-full-spec-verify /path/to/receipt.json`                   | Checks current candidate/environment and command identity; does not rerun tests or certify uncovered acceptance.                                                                                              |
| Bind/refresh current task       | `just task-sync https://github.com/owner/repository/issues/NUMBER` | Requires this checkout's enrolled repository and GitHub access.                                                                                                                                               |
| Recover native task history     | `just recover-task THREAD_ID`                                      | Reads native history and reports reconciliation gaps; reading pages is not semantic acceptance.                                                                                                               |
| Publish pending task facts      | `just task-publish`                                                | Writes to GitHub; retains outbox until readback succeeds. Inspect content and actual project authorization first.                                                                                             |

Use [project policy](POLICY.md) for evidence and delivery operations and [personal policy](skills/rill-preferences/references/personal-policy.md) for when checks run. This checkout has no `.github/workflows` hosted CI; local hooks are bypassable and do not establish merge protection.

## Collaboration and security

[Contributing](.github/CONTRIBUTING.md) covers this project's GitHub flow. [Security](.github/SECURITY.md) describes trust, credentials, local task data, publication and the current reporting route. Implementation status and unverified acceptance remain in #18, rather than a second status checklist here.
