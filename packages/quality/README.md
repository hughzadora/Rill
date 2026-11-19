# Quality gates package

This package holds reusable upstream quality checks for Rill's projects. It is
not a second standard registrar, distribution runtime, or MCP server. The native
Rill plugin at the Workspace root owns project enrollment, version selection,
release integrity and rollout state.

The repository uses a single pnpm Workspace and shared root pnpm lock.
The root plugin, this package, and the React web fixture are distinct package
members because each has actual dependencies and checks. Do not publish
this package as a trusted standard release until distribution and
independent review have passed #18 acceptance.

From the repository root use just workspace-install and just workspace-ci.
From this package use just lint, just typecheck, just test, just build,
just metrics, just secret-scan, just audit, or just full-spec-ci.
The project-metrics recipe measures the exact target's
TS/TSX source files against the candidate JSON profile using upstream Lizard
and Tokei; it does not modify the target or waive existing violations.

The package owns upstream Biome/Oxlint, Markdown, Ruff/mypy/pytest, Taplo,
ShellCheck/shfmt, Vitest, Trivy, Gitleaks, Lizard and Tokei integrations.
The real React, Python and shell fixtures exercise compatible commands; they
are test sources, not applications shipped to end users. Code checks use the
exact source inventory. New unlisted TS paths must fail instead of being
mistaken for a clean project.

Trivy's product dependency and license audit scans the root pnpm lock and
Python fixture uv lock but excludes Mise's generated .mise/locks sidecar
directories. Those lockfiles describe external tool installation variants,
not dependencies executed by this project. A known pygments@2.19.2 advisory
in Lizard's sidecar applies to Python below 3.9 only; the pinned runtime is
Python 3.15.2 and that same lock selects pygments@2.21.0 on this platform.
External tool downloads remain governed separately by mise.lock checksums
and mise install --locked. This is an audited scope boundary, not a blanket
vulnerability waiver or proof that the entire supply chain is vulnerability
free.

The package's unit checks and local CI are not proof that project-native CI,
new-project enrollment, managed upgrades or rollback have been delivered.
Issue #18 remains the delivery and acceptance authority.
