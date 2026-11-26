# TypeScript web profile

This overlay adds a browser application and Playwright acceptance to the TypeScript + Bun template. The base TypeScript tasks remain active. The browser build, process checks, and real browser journey are included in `mise run verify`; `mise run qualify` runs disposable positive and negative browser fixtures.

Install tools and locked packages with `mise install --locked` and `mise exec -- bun install --frozen-lockfile`. Install the exact Chromium revision selected by the locked Playwright package with `mise run install-browser`; browser installation is an explicit setup step, not an implicit test download. Run `mise run verify` and `mise run qualify` against the same candidate.

`mise run build` builds the actual browser surface. `mise run dev` builds it and starts the Node preview service on loopback. `RILL_WEB_PORT=PORT mise run dev` requests a specific port; omit it to let the operating system choose one.

Playwright pins Desktop Chrome and Pixel 7 Chromium contexts. Add each accepted journey and viewport to `tests/browser/reminders.spec.ts` and `tests/tooling/browser-inventory.ts`. Preserve JSON results, traces and screenshots under `reports/`. Browser checks use the real built surface and do not automatically install browsers.
