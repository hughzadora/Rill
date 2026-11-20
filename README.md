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
- `bundle/plugin/skills/` — supplied Superpowers brainstorming and one Rill discovery entrypoint.
- `bundle/plugin/hooks/` — source-only SessionStart hook, dependent on native trust before execution.
- `bundle/repo-common/.codex/` — consumer-scoped agent role/config templates; reviewer prompts do not grant a read-only sandbox.
- `bundle/repo-common/PRD.md` — domain-neutral consumer specification.

Run `pnpm install --frozen-lockfile` and `pnpm run ci` to verify the current TypeScript CLI and source contracts. Local plugin installation is supported by `codex plugin marketplace add <absolute-Rill-checkout>` and `codex plugin add rill@rill-source`, after reviewing the selected Codex HOME and permissions. Neither command authorizes untrusted hooks or adds permission to external repositories.

The supplied brainstorming Skill references companion files absent from the upload. Completing the dependency audit and demonstrating actual native invocation is explicitly tracked in [#57](https://github.com/hughzadora/Rill/issues/57). File presence alone is not functional integration.

## Native execution evidence

Native Codex JSONL events, not model prose, determine what ran. A Codex read of an installed Rill Skill was observed in an isolated read-only session. A second session **claimed** an Explorer result, but its trace contained only an empty `wait` call and stated that project configuration was untrusted/disabled. `src/native-evidence.ts` classifies such cases as **NOT_VERIFIED** and tests these false-positive paths. Installing a plugin does **not** automatically trust its Hooks or prove agent-model/sandbox configuration. No hook-trust bypass or user-global configuration edits are authorized.

## Release criteria

A reviewed versioned bundle must install without Rill development context in one independent real greenfield and one brownfield project. A fresh agent implements meaningful work, runs actual applicable positive/negative CI, uses independently observed native roles/Skills/Hooks/justified MCP, obtains separate current-diff review, survives interruption, produces an evidence-bound PR, and demonstrates safe consumer-preserving upgrade and rollback. Owner user-facing acceptance and protected release are separate checkpoints.

**Current status:** product 0.0.1 TS7 CLI and plugin source are locally testable; isolated Codex plugin installation was observed. Hook trust, effective agent/model/sandbox behavior, external pilots, protected release and complete factory implementation remain unverified.
