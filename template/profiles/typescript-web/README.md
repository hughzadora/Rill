# TypeScript web profile

This Rill overlay adds a real Bun-built browser surface, a loopback Node preview process, and pinned Playwright Test with axe-core. The browser journey runs on the actual build in Desktop Chrome and Pixel 7 Chromium contexts.

## Setup and checks

From the adopted project root, run `mise install --locked`, then `mise exec -- bun install --frozen-lockfile` and `mise run install-browser`. Browser installation is explicit; tests use the Chromium revision selected by the locked Playwright package and never download it on demand.

Run `mise run verify` for the build, process checks, browser journey, axe, formatting, lint, type, dependency, and secret checks. Run `mise run qualify` separately for the valid browser journey and disposable keyboard, responsive layout, accessibility, and test-inventory fault injections.

Run `mise run dev` to build and serve the surface on loopback using an operating-system-selected free port. Set `RILL_WEB_PORT` to request a specific port and receive an actionable conflict diagnostic when it is occupied.

Reports, screenshots, and failure traces are written beneath `reports/`. See `AGENTS.md` for the profile acceptance contract and extension points.
