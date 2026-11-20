# Rill

Rill is a native Codex-first software factory for new and existing software repositories. Its owner defines product outcomes and exceptional protected authorizations; agents and maintained tools perform bounded research, implementation, testing, review, and recovery.

**Blueprint:** 10.0.1 (not a release). **Product SemVer:** `0.0.1` in canonical [VERSION](VERSION). The current tree is a development candidate, **not certified for production or consumer release**.

## Authorities and evidence

- [CONSTITUTION.md](CONSTITUTION.md) — durable product intent.
- [PRD.md](PRD.md) — the one living Rill specification and actual acceptance states.
- [AGENTS.md](AGENTS.md) — compact agent entrypoint, with scope and authorization boundaries.
- [GitHub Issue #51](https://github.com/hughzadora/Rill/issues/51) — current rebuild dependencies and work; [Issue #71](https://github.com/hughzadora/Rill/issues/71) — Anthropic/OpenAI source analysis and counterexamples.
- GitHub PRs and exact-revision CI runs, not a model response, provide delivery evidence.

## Native package layout

- `plugin/plugin.json` — portable [Agent Plugins](https://developers.openai.com/plugins/build/plugins) manifest and canonical package identity. Only `plugin/skills/` and `plugin/hooks/` ship with the plugin.
- `.agents/plugins/marketplace.json` — local development source pointing at `./plugin`.
- `templates/consumer/` — consumer-owned PRD, entry instructions, project-scoped Codex roles, Hook definition, and a Marketplace pointing at its own `./.rill/plugin`.
- `src/` — Rill CLI code, `tests/` — positive/negative CLI and source verification, `tools/` — maintained build scripts.

Upstream Skills are preferred for substantive research, brainstorming, and design critique; they are **not copied into Rill**. The distinct `rill-recover` and `rill-update` Skills stay in the plugin. Installed Skill discovery alone does not prove automatic invocation. The native Hook is subject to explicit host trust; a trusted local SessionStart callback was observed in [#54](https://github.com/hughzadora/Rill/issues/54), but consumer installation, custom roles and independent review require their own runtime receipts.

## Develop and verify

With pinned **Bun 1.4.5**, run `bun install --frozen-lockfile` and `bun run ci`. This runs strict `bun check`, `bun fmt --check`, maintained Biome lint (stable Bun does not yet provide a usable native `bun lint` executable), a nonbundled Bun build, Bun tests, and an independent Node V8 coverage gate requiring at least **80% per emitted JS file**. PR/main CI must run all applicable checks on the *exact candidate commit*; `bun test --changed` is optional local feedback, not a substitute.

Use the native CLI only after building:

```sh
node dist/cli.js init /path/to/new-product --goal "Observable product outcome" --yes --json
node dist/cli.js adopt /path/to/existing-product --json
node dist/cli.js adopt /path/to/existing-product --yes --json
node dist/cli.js update /path/to/enrolled-product --json
```

`init` creates only a nonexisting target. `adopt --yes` and `update --yes` prepare **separate review worktrees**; they do not merge or overwrite the consumer's current working tree. Receipts deliberately say `CREATED_NOT_VERIFIED`, `PLAN_ONLY`, or `PREPARED_NOT_VERIFIED` until genuine checks pass. Consumer-owned configuration conflicts are preserved and reported instead of silently overwritten. `setup` and `doctor` remain unimplemented; their absence is not a release blocker waived by documentation.

For local plugin development, add the repository Marketplace with `codex plugin marketplace add /absolute/path/to/Rill` and install `rill@rill-source` in a separately chosen Codex home. The installed package is versioned independently from the Git checkout. Do not globally auto-trust Hooks, bypass approvals, or represent a reviewer prompt as sandbox isolation.

## Delivery limits

A green factory CI run does not certify a consumer product. Independent greenfield and brownfield pilots, actual supported permissions, exact-SHA non-author review, safe recovery, upgrade/rollback and owner acceptance remain separate tasks in [#51](https://github.com/hughzadora/Rill/issues/51). No paid service, extra credits, production release or protected merge is implied by this source tree.
