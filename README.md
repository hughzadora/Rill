# Rill

Rill is a **Codex-native development workspace**, not another agent orchestration product. The owner defines the outcome and essential decisions; Codex and established tools implement, inspect and verify it.

[Engineering work and scope](https://github.com/hughzadora/Rill/issues/22) · [Permanent bug ledger](https://github.com/hughzadora/Rill/issues/23) · [Current HTML prototype](prototype/rill-journey.html)

## Working with Rill

Open the checkout with Codex. Native project instructions are in [AGENTS.md](AGENTS.md), and native agent settings are in [.codex/config.toml](.codex/config.toml). Start from the relevant GitHub child issue and actual worktree, not a generated conversation summary. Codex handles session compaction and approvals; no custom Rill Hook, MCP server, recovery database or issue-comment stream is involved.

For substantial features, the owner reviews a clickable prototype, the consequential overall design and the final real behavior. Agents complete implementation, integration, cleanup and tests between those checkpoints. A readable HTML progress/evidence view supplements — but **never substitutes for** — native harness choices and approvals.

The included [prototype](prototype/rill-journey.html) is a dated, **read-only** snapshot of GitHub #22–#29. Open it through a local HTTP server, for example `just preview`. It does not issue instructions to Codex, make GitHub changes or store approval. Work on live task-to-UI synchronization remains in [#25](https://github.com/hughzadora/Rill/issues/25).

## Upstream tools

- The native Codex config retains a bounded worker and independent reviewer; the upstream Impeccable skill is installed at the native user level, with no custom hooks.
- GoogleChrome [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) is the installed global frontend reference. Impeccable handles design and visual QA. The two remain upstream-owned; Rill does not reproduce their internal rules.
- [Playwright CLI](https://playwright.dev/agent-cli/configuration) selects the **system Google Chrome** through native configuration. No browser installation or Chromium download is part of the project setup.
- The [quality package](packages/quality/README.md) owns the actual frontend/backend linters, tests, source metrics, dependency/license audits and security checks. The root and package share one pnpm lock and the existing Mise lock.

## Commands

Run `just workspace-install` once after checkout (locked upstream tools and dependencies), `just lint` for quick checks, and `just workspace-ci` before reviewing the PR. `just preview` serves the interactive HTML at `http://127.0.0.1:8765/rill-journey.html` for local viewing. `pnpm exec playwright-cli open http://127.0.0.1:8765/rill-journey.html --browser=chrome` opens Chrome; use its native snapshot/click/screenshot commands for verification.

The GitHub Actions [quality workflow](.github/workflows/quality.yml) runs the same locked commands on PRs. This verifies engineering gates, not user acceptance, native harness selection, or branch protection. Current work and unresolved capabilities are in #22 and its children. No unattended merge or release is enabled.
