# Rill TypeScript + Bun starter

This profile provides the toolchain and native checks for a single Bun-runtime TypeScript project. `src/validation-fixture.ts` is a small, replaceable setup check that prints command-line arguments as JSON. Its two process tests in `tests/behavior/validation-fixture.test.ts` check known outputs for ordered arguments and empty input. These results qualify the starter fixture. Product acceptance starts with your own brief and behavior.

## Start in a new workspace

Apply the Rill artifact at the root of an independent project. Use Git and mise on Apple Silicon macOS, the platform covered by the supplied `mise.lock`. Review the configuration before trusting it. Setup uses the package registry and upstream tool downloads. Verification and qualification use the live OSV service.

```sh
git init
mise --version
mise trust
mise lock --check
mise install --locked
mise exec -- bun install --frozen-lockfile
mise run dev "blue sky" "雪"
mise run verify
mise run qualify
```

The dev command prints `["blue sky","雪"]`. Use `mise run scan-history` once you have committed history. Review a lock change separately when updating a tool or supporting a new platform.

## Build your product

Open the workspace in Codex and describe what you want the product to do. Record the intended behavior in `docs/PROJECT.md`. Replace the validation fixture and its tests with the approved increment. Point the `dev` script at the real entry and keep the Knip configuration aligned with entry points and source roots. Add a build task when the product has a real artifact to build.

Keep TypeScript sources in `src/` and behavior cases in `tests/behavior/**/*.test.ts`. Update tooling configuration and contract tests together if you extend the source roots or runtimes. `mise run test` runs behavior and read-only tooling contracts. The runner selects exact files, checks Bun's fresh JUnit report, and fails on an empty, focused, skipped, or misplaced suite. Run `mise exec -- bun run test:behavior` for the behavior suite alone.

`mise run verify` runs Oxfmt check mode, type-aware Oxlint, standalone tsrs, Bun tests, Knip, typos, Gitleaks over current files, and OSV against `bun.lock`. The pinned tsrs build uses the TypeScript 7.1 beta compatibility target. `TSRS_FAST=0` applies to both the checker and Oxlint's explicit tsrs backend. Knip uses the pinned Node runtime for unused-code analysis.

`mise run qualify` validates the starter's gate wiring and runs positive and negative cases in disposable directories with the installed tooling. Keep fixtures synthetic. The advisory case replaces a disposable lockfile and scans it without installing the affected package. Run both entry points after changing a pin, tool configuration, target, or task, and again on the committed candidate before accepting an increment.
