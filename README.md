# Rill — Reusable Software Factory

Rill is a **versioned industrial software-delivery standard for new and existing projects**, not one business application, an issue viewer, or a replacement agent runtime. Its output is working software with reproducible testing, independent review, security and delivery evidence. The owner decides product outcomes and protected choices; native agents and maintained tools execute the engineering work.

Default stacks: **React + Tailwind CSS, Node.js + TypeScript, Python, and Shell**. Every real project must run its complete applicable quality gates. Rill's fixture tests do not certify other products.

## Engineering sources

| Area                                            | Versioned source                            |
| ----------------------------------------------- | ------------------------------------------- |
| Product outcome, constraints, acceptance        | [PRD](PRD.md)                               |
| Architecture, system and authority boundaries   | [ARCHITECTURE](ARCHITECTURE.md)             |
| Interactive console product design              | [DESIGN](DESIGN.md)                         |
| Engineering and human checkpoint policy         | [POLICY](POLICY.md)                         |
| Native Issue relationships, planning and status | [PROJECT_MANAGEMENT](PROJECT_MANAGEMENT.md) |
| Fresh-agent recovery and delivery receipts      | [HANDOFF](HANDOFF.md)                       |
| Native Codex agents and independence            | [MULTI_AGENT](MULTI_AGENT.md)               |
| Four-stack testing and security gate matrix     | [QUALITY_STANDARD](QUALITY_STANDARD.md)     |
| Adoption and delivery roadmap                   | [ROADMAP](ROADMAP.md)                       |
| Shared terms                                    | [GLOSSARY](GLOSSARY.md)                     |

Current task authority: [Issue #22](https://github.com/hughzadora/Rill/issues/22) and native sub-issues, plus permanent [bug parent #23](https://github.com/hughzadora/Rill/issues/23). Closed #10/#18 remain historical evidence. Source and decisions live in issue **bodies**, Git/PR and these docs — not an agent transcript database or Issue comments log.

The agent entry is [AGENTS.md](AGENTS.md); native role config is in [.codex/](.codex/config.toml). Configuration does not prove real agent delegation.

## Software-delivery console

The [React + Tailwind console](apps/console/) replaces the rejected static Issue-title prototype. It includes engineering overview, searchable native child tasks, task acceptance and dependencies, eight-stage workflow, declared-versus-executed quality, versioned engineering documents, and explicit handoff gaps.

The preview uses a **loopback-only read-only adapter** and the already-authenticated GitHub CLI / local Git. It does not export credentials into a browser, write task state, create a second issue database, schedule agents, or simulate owner approval. Unknown or stale external facts must stay visible. Consequential decisions need real harness-native controls.

## Commands

- `just workspace-install` — locked upstream tool and package installation, without downloading Chromium.
- `just lint` — fast lint / language native checks.
- `just workspace-ci` — configured source lint, type, React unit/component, Node HTTP integration, Shell, quality fixtures, security, production build and installed-Google-Chrome E2E. This **does not** certify separate target-project adoption.
- `just preview` — build and serve locally at http://127.0.0.1:8765/ on the authorized Arch host.
- `pnpm exec playwright-cli open http://127.0.0.1:8765/ --browser=chrome` — inspect through system Chrome.

The [hosted quality workflow](.github/workflows/quality.yml) runs the same locked checks on PRs. Owner prototype/design/final experience, independent review, native delegation, real new/existing project installation, version upgrade/rollback and trusted release remain distinct acceptance gates.

**Current status:** Rill is a candidate software factory, not a published industrial standard. Passing local fixtures or one console does not prove project enrollment, production safety or release readiness. No unattended merge, payment, production deployment or privilege escalation is authorized.
