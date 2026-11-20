# Rill Software Factory

**Product SemVer:** `0.0.1` (development baseline, not released; [`VERSION`](VERSION) is authoritative). **Blueprint edition:** `10.0.1` (design revision only, not a product release).

Rill is a distributable native Codex-first software factory for new and existing product repositories. The owner defines the outcome and protected authorization; agents and maintained tools research, design, implement, test, independently review, recover and deliver working software.

This branch retires the previous Rill runtime and configurations. It is **not a functioning production distribution**. Previous code remains in Git history; no compatibility adapters or legacy migrations are planned. No consumer repository or main branch was wiped.

## Authorities

- [Constitution](CONSTITUTION.md) — durable purpose, product boundaries, owner authority, safety and release definition.
- [Living PRD](PRD.md) — current requirements and acceptance status; no chat history appended.
- [v10.0.1 rebuild epic and native child tickets](https://github.com/hughzadora/Rill/issues/51) — tasks, blockers and delivery evidence.
- [Permanent bug ledger](https://github.com/hughzadora/Rill/issues/23) — separately verified defects.

## Native source package (not a verified release)

- `bundle/plugin/plugin.json` — portable Agent Plugins identity; its version must match root `VERSION`.
- `.agents/plugins/marketplace.json` — source-local discovery, never a global installation directive.
- `bundle/plugin/skills/` — owner-supplied Superpowers brainstorming, one Rill discovery gate and dedicated Research/Grill Skill entrypoints.
- `bundle/plugin/hooks/` — source-only SessionStart hook, dependent on native trust before execution.
- `bundle/repo-common/.codex/` — consumer-scoped agent role/config templates; reviewer prompts do not grant a read-only sandbox.
- `bundle/repo-common/PRD.md` — domain-neutral consumer specification.

Run `pnpm install --frozen-lockfile` and `pnpm run ci` to verify the current TypeScript CLI and source contracts. Local plugin installation is supported by `codex plugin marketplace add <absolute-Rill-checkout>` and `codex plugin add rill@rill-source`, after reviewing the selected Codex HOME and permissions. Neither command authorizes untrusted hooks or adds permission to external repositories.

The owner-supplied Superpowers Brainstorming Skill now includes the upstream builder-check prompt, while the unavailable local visual-companion server is **explicitly disabled**, not silently simulated. `rill-research` and `rill-grill` are native Skill entrypoints that route substantive design choices through `rill-discovery` once; no additional PRD or interview is created for settled decisions. Native model-driven Skill selection and exact workflow invocation still require actual Agent evidence under [#57](https://github.com/hughzadora/Rill/issues/57); file presence is not proof of automatic triggering.

## Greenfield initialization (local, not yet factory-certified)

The built CLI supports `rill init PATH --goal "Actual product outcome" --yes --json` for a **new non-existing** target directory. It creates a Git root, a consumer-owned PRD, agent entry instructions, versioned Codex roles, a self-contained `0.0.1` Plugin, and a project-local Plugin Marketplace. Existing directories and symbolic links are rejected, rather than overwritten; staging is discarded on failure. A separate isolated Codex CLI confirmed that a freshly initialized project exposes and installs `rill@rill-consumer` as version `0.0.1`.

The command deliberately returns `CREATED_NOT_VERIFIED`: it does not install globally, trust Hooks, claim effective custom agent permissions, generate fake-green CI for an unknown product stack, or certify a real external product. `rill setup` and `rill doctor` are not implemented yet. Existing repositories have their own pending enrollment task.

## Brownfield preparation (review worktree, not enrollment certification)

`rill adopt PATH --json` inspects a clean existing Git repository without changing it. `rill adopt PATH --yes --json [--goal TEXT]` prepares a **new native Git review worktree and branch** rather than overwriting the existing working tree. Existing product tests, CI, README, PRD, agent instructions, and user-owned Codex configuration remain unchanged. Rill Plugin files are only added under previously unowned locations; conflicting configuration is reported in `pendingIntegration` and must be resolved by a separate reviewed change. The command returns `PREPARED_NOT_VERIFIED`, not a claim that Codex Hooks or product CI have run.

Local independent product tests demonstrated a real positive business result and rejected a deliberate source regression. This is a bounded safety and code-delivery preflight; real owner-controlled brownfield enrollment, native Hook trust, deployment and public release still require separate evidence.

## Rill CLI quality gate (current source only)

`pnpm run ci` runs pinned Biome lint/format checks, strict TypeScript 7 typechecking, a fresh build and Node's real test runner under `c8`. The coverage gate enumerates **all emitted `dist/**/*.js` files** and requires **at least 80% line coverage for each file**, not merely the aggregate. The tests exercise the production CLI, isolated greenfield and brownfield Git repositories, and runtime evidence classification. Negative fixtures demonstrate that a fake-success test script, a genuine business regression, and a fully untested compiled module all fail. A one-line untested module was injected and confirmed rejected: `0%` per-file coverage is not hidden by an otherwise green aggregate.

`.github/workflows/quality.yml` declares an upstream-native, low-privilege PR job using locked pnpm and Node 26 with bounded duration and cancellation of superseded runs. Until a matching exact-SHA GitHub run actually succeeds, the workflow is **configured, not verified as hosted CI**. Secret scanning, supply-chain/OSV status and the applicability of browser/accessibility testing must be independently checked for a real consumer stack; Rill's current CLI source gate must never be represented as universal consumer CI.

## Native Git Plugin update preflight (not a release)

`rill update PRODUCT_ROOT --json` previews the next managed Plugin version using canonical `VERSION`, verified SemVer ordering, native Git tracking and clean-state checks. `--yes` authorizes creation of an **isolated Git review worktree** only, returning `PREPARED_NOT_VERIFIED`; it does **not** merge or alter the live consumer's source. Old managed paths absent from the new source are retained for review, rather than silently deleted. Overwritten and retained paths are reported in `pendingReview`. Dirty repositories, symlinks, untracked managed Plugins, missing manifests and non-increasing versions are rejected.

`bundle/plugin/skills/rill-update/SKILL.md` describes the native reviewed Git merge/revert procedure; there is no bespoke plugin updater or rollback daemon. Deterministic tests show preservation of real business files during merge/revert and fail-closed behavior on committed and uncommitted conflicts. No real product has been upgraded. The current Codex CLI supports marketplace snapshot upgrades but provides no direct `codex plugin update` command; native installed version and Hook trust must be verified separately after authorized changes.

## Native execution evidence

Native Codex JSONL events, not model prose, determine what ran. A Codex read of an installed Rill Skill was observed in an isolated read-only session. A second session **claimed** an Explorer result, but its trace contained only an empty `wait` call and stated that project configuration was untrusted/disabled. `src/native-evidence.ts` classifies such cases as **NOT_VERIFIED** and tests these false-positive paths. Installing a plugin does **not** automatically trust its Hooks or prove agent-model/sandbox configuration. No hook-trust bypass or user-global configuration edits are authorized.

## Release criteria

A reviewed versioned bundle must install without Rill development context in one independent real greenfield and one brownfield project. A fresh agent implements meaningful work, runs actual applicable positive/negative CI, uses independently observed native roles/Skills/Hooks/justified MCP, obtains separate current-diff review, survives interruption, produces an evidence-bound PR, and demonstrates safe consumer-preserving upgrade and rollback. Owner user-facing acceptance and protected release are separate checkpoints.

**Current status:** product 0.0.1 TS7 CLI and plugin source are locally testable; isolated Codex plugin installation was observed. Hook trust, effective agent/model/sandbox behavior, external pilots, protected release and complete factory implementation remain unverified.
