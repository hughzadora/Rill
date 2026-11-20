# Rill local quality foundation

This repository provides a reproducible four-way local CI foundation for
TypeScript/React, Python and shell code. It uses upstream tooling and avoids
custom quality-runner wrappers.

## Bootstrap and verify

```sh
just lock
just setup
just ci-full
```

Use `just ci` to run incremental checks. Every run includes security and
repository guardrails. The other three workstreams are selected by changed
files; shared configuration changes run all workstreams. Selected tasks are
started concurrently and every failed task makes the aggregate command fail.

Runtime tool versions are locked by Mise. The current runtime families are
Node LTS, pnpm 12 and Python 3.14. pnpm and uv separately lock project
dependencies. The Justfile is the sole CI orchestrator.

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
