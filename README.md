# Rill — standalone software-factory CLI

`rill` is a versioned Typer/Rich CLI with Copier-generated Codex roles,
Skills, lifecycle Hooks, deterministic local guards and independent product
quality gates. Its distributable template has one source of truth at
`standards/template/`, embedded at `rill_cli/template/` during packaging.

## CLI lifecycle

`rill version`, `rill init PATH --yes`, `rill upgrade PATH --yes`,
`rill status PATH`, `rill doctor PATH`, `rill hook EVENT`.

See [INSTALL.md](INSTALL.md) for pinned mise global distribution and
supported architectures. `just build-cli` creates a standalone onedir
executable at `dist/rill/rill`. `just check-fast`, `just ci`, and
`just ci-full` retain their independent native quality checks.

Initial adoption requires a clean Git root or empty directory. Upgrades
require a clean product worktree and matching hashes of Rill-managed files.
Rill never silently replaces changes made to managed files. Git Issues,
Pull Requests and native Codex approvals remain authoritative.

## React and browser checks

The root `index.html` renders `src/ts/main.tsx` through Vite and Tailwind
CSS v4. Shared shadcn/ui-style controls live in `src/ts/components/ui/`.
This fixture uses a typed, variant-driven Button and the `cn()` class
merging utility. The build writes to `dist/`.

The TypeScript worker runs Biome and Oxlint, strict TypeScript, Knip and
Vitest V8 coverage (at least 80% in all dimensions), then builds the
production app and tests it in Chromium using Playwright. Playwright
previews the production build on port 4173, checks browser errors and
verifies a real click-driven UI state change.

`just setup` installs Chromium. In GitHub Actions it additionally installs
the system packages required by Playwright. The first browser installation
downloads a browser binary; no paid services are required.

Biome 2.6 uses the experimental `useTailwindSortedClasses` rule and the
`tailwind` configuration instead of the older `useSortedClasses` options.
Class ordering is enforced by the quality gate and can be fixed using Biome.

Bats and Taplo archives have independently verified SHA-256 entries in
`mise.lock`; refresh and reverify these when bumping their tool releases.
Never disable locked-download verification to bypass a checksum failure.

## Mutation-test effectiveness

Run `just verify-tests` to test whether unit assertions actually detect
introduced defects. Stryker 10 uses its native Vitest runner with a mutation
break threshold of 60% (high 80%, low 60%). Its TypeScript 7 native checker
still depends on the removed TypeScript JavaScript configuration API; for
that reason Stryker's sandbox excludes the tsconfig. Strict TypeScript 7
checking remains mandatory in `just ci-full`, and Stryker still
mutates and executes the real Vitest suite.

Mutmut 3.8 requires a named importable Python package. Python code lives
in `src/rill_quality/`, not under a package literally called `py`,
which conflicts with existing Python tooling. The Python mutation stage
requires at least one tested mutant and rejects all outcomes other than
`killed`, so an empty, untested or surviving result cannot pass.
Mutation tests execute the two language runners concurrently.

## Reusable software factory (PR #33)

The #39 local four-language quality foundation above is the **only**
repository-level CI baseline. The reusable factory layers on the upstream
native Codex `.codex` roles, Copier distribution in `standards/template`,
four maintained `.agents/skills/`, reviewed lifecycle Hook handlers,
a read-only optional documentation MCP declaration, a Git-native installer,
and an independent delivery console in `apps/console`.

Preview an adoption without changing the target:
`python3 tools/adopt_rill.py <target> --source <reviewed-source> --ref <tag>`.
Install only after native trust and target authorization:
`python3 tools/adopt_rill.py <target> --source <reviewed-source> --ref <tag> --apply`.
Existing product-owned agent files remain protected.

`just factory-ci` validates the reusable release in isolation;
`just ci-full` runs the full #39 foundation and then its factory checks.
Passing these is not proof of real consumer Codex Hook/MCP calls,
continuous agent recovery or owner-approved product release.
