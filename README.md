# Rill

Rill is a **repository-root native Codex Plugin** for evidence-based software delivery. Its owner states outcomes, authorizes protected actions, and accepts completed work; Codex and established tools research, implement, test, review, and recover tasks.

**Blueprint:** 10.0.1 (design only). **Product SemVer:** `0.0.1`, recorded in [VERSION](VERSION). This source is a development candidate, not a certified release.

## One native plugin root

OpenAI's [Plugin packaging contract](https://developers.openai.com/plugins/build/plugins) determines the layout:

- `plugin.json` — **single portable Plugin identity at repository root**, with the OpenAI extension.
- `skills/rill-recover/`, `skills/rill-update/` — the two Rill-specific, progressively disclosed Skills; upstream design/research Skills are not copied.
- `hooks/hooks.json`, `hooks/session-start.mjs` — **one** native `SessionStart` Hook, using `PLUGIN_ROOT`. Codex must explicitly trust the active definition.
- `.agents/plugins/marketplace.json` — repository Marketplace, pointing at `./`, not a second Plugin directory.
- `.codex/config.toml` and `.codex/agents/` — official project-scoped Codex settings and role guidance. A role prompt does not create a security sandbox.

There is **no** `plugin/` sub-package, `bundle/`, consumer `.rill/plugin`, duplicated Marketplace, duplicate consumer Hook, or separate bespoke updater.

### Install and inspect using the native host

```sh
codex plugin marketplace add hughzadora/Rill
codex plugin list --available --json
codex plugin add rill@rill-source
codex plugin list --json
```

For a **local-path Marketplace**, do not install directly from a dirty development checkout: Codex may cache ignored files such as `.git`, `node_modules`, `dist`, and local secrets alongside the Plugin. Use `git archive HEAD` to export the **exact reviewed commit** into a private clean temporary directory, then run `codex plugin marketplace add /absolute/path/to/clean-export` and install `rill@rill-source` from that export. The repository root is still the single Plugin root; the clean export is a temporary installation input, not a second source package. Git-backed Marketplace refreshes should be scoped to `codex plugin marketplace upgrade rill-source`, not the unqualified command that refreshes unrelated Git sources. A local Marketplace is not refreshed by that command: review native Plugin remove/add help and obtain the required authorization before changing the existing installation. Installation never constitutes Hook trust; review the active Hook definition in Codex before enabling it. Confirm the installed version and actual native Hook events independently.

### Optional consumer project preparation

The Rill repo includes the developer-only `rill` helper for creating or reviewing *project-owned* files. It is not a custom Plugin manager, and does not copy a Plugin or install into a user account.

```sh
bun install --frozen-lockfile
bun run build
node dist/cli.js init /path/to/new-product --goal "Observable product outcome" --yes --json
node dist/cli.js adopt /path/to/existing-product --json
node dist/cli.js adopt /path/to/existing-product --yes --json
```

`init` requires a nonexistent directory, creates Git history roots, one consumer `PRD.md` and `AGENTS.md`, and copies the **official root `.codex/` configuration** for that product. `adopt` only prepares an isolated Git worktree and preserves existing product source/configuration; user-owned conflicts are reported. Both identify Plugin installation and trust as separate, not-verified host steps. Consumer code and Git history are never silently overwritten.

Plugin upgrades are performed through supported **Codex Marketplace/Plugin commands**, with explicit authorization and independent checks for changed runtime permissions; `rill update` has been removed because it duplicated the native package manager.

## Governance and verification

- [CONSTITUTION.md](CONSTITUTION.md) is the permanent product purpose, [PRD.md](PRD.md) is the **single living Rill requirements specification**, [AGENTS.md](AGENTS.md) is an index.
- [#51](https://github.com/hughzadora/Rill/issues/51) holds the v10.0.1 rebuild dependencies. [#71](https://github.com/hughzadora/Rill/issues/71) records the four Anthropic research articles and cross-vendor verification; [#72](https://github.com/hughzadora/Rill/issues/72) records the native-package reconciliation.
- Pinned **Bun 1.4.5**: `bun run ci` runs strict typecheck, Biome lint, `bun fmt --check`, build, real Bun tests, and per-file Node V8 coverage of all emitted JS at **>=80%**. Run the full suite against the exact candidate SHA; optional changed tests are not substitute release evidence.

A successful package install or CI pass does not prove native Skill invocation, custom reviewer isolation, trusted Hook execution, independent greenfield/brownfield product acceptance, or a protected release. Record each separately with an exact-SHA receipt.

No purchase, global Codex trust change, production mutation, destructive consumer update, merge, or release is authorized by these files.
