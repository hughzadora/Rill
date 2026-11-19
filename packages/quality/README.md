# Rill Quality Profiles

This package executes maintained upstream quality checks against current
standard **fixtures**, and contains candidates for adoption by real new and
existing repositories. It is not a registrar, plugin runtime or published
industrial standard. Fixture success does not prove another project is tested.

The repository uses one pnpm workspace and a locked Mise toolchain. From
the root use `just workspace-install` and `just workspace-ci`. This
package provides `just lint`, `just typecheck`, `just test`,
`just build`, `just metrics`, `just secret-scan`, `just audit`,
and `just full-spec-ci`.

Native gates include Biome, Oxlint, Markdownlint, Ruff, mypy, pytest,
Taplo, ShellCheck, shfmt, Bats, Vitest, Trivy, Gitleaks, Lizard and Tokei.
The React/Vite, Python and Shell fixtures demonstrate command compatibility,
not user-facing products. The project-metrics recipe audits specified TS/TSX
source inventory with Lizard and Tokei without mutating its target.

Trivy excludes Mise platform-specific installation sidecar locks while
checking the workspace/Python dependency locks; Mise upstream downloads
remain checksum-locked. This does not waive actual vulnerabilities or certify
the whole software supply chain.

Read the [full four-stack quality matrix](../../QUALITY_STANDARD.md).
Actual React/Node/Python/Shell product integration, accessibility, coverage,
new/existing project adoption, independent review and rollback remain open
until observed. Current engineering authority is [#22](https://github.com/hughzadora/Rill/issues/22),
not superseded #18.
