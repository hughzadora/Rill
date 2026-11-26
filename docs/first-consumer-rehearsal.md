# First TypeScript and Bun consumer rehearsal

The Codex session created a Chinese shopping list. It chose a responsive page with browser-local storage, quantities and bought state, and offline access after the first online visit. The session recorded the scenarios in the consumer's `docs/PROJECT.md` and wrote the initial increment. Its transcript ends before the Codex turn finished. Follow-up verification repaired and checked the generated consumer.

| Input                                       | Observed identity                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rill source that rebuilt the same kit bytes | `51bd4fe8326a15fef5ec23550878c257da899120`                                                                                                                          |
| Locally built `rill-kit-0.1.0.tar.gz`       | SHA-256 `242338b1879b389dce0626b61dbc0872945ab992401ee0dd010ccd143631ae97`                                                                                          |
| Nested `rill-typescript-bun-0.1.0.tar.gz`   | SHA-256 `b0cd3f0503a3bb4d961a49375365ecd259e3eca205fe7da5f32bdb29ecbcc164`                                                                                          |
| Consumer on Darwin arm64                    | `UNCOMMITTED`. Sorted project file SHA-256 inventory digest `27e7a6224d602b236a75e615e9e103cc1f58a65d797f7c999d342d51f4e0ee89` before and after all commands below. |
| `mise.lock`                                 | SHA-256 `7dad14397a4ff1a971b97feeed31eb64b78da94c31735ff2557beaac0886ba1d`                                                                                          |
| `bun.lock`                                  | SHA-256 `3e0dad26b26ea3709ef7f3b25384ba98cd8d7447d8e925d5ed9b058228ea3897`                                                                                          |

Follow-up separated the service worker's TypeScript runtime configuration from the browser and Bun project, connected the real dev, build and Knip entries, and changed the invalid stored-data tests to exercise malformed JSON values outside the valid item type. These changes are specific to the generated consumer.

- `mise lock --check`, `mise install --locked`, and `mise exec -- bun install --frozen-lockfile` exited zero.
- `mise run verify` passed with 16 storage behavior tests and two tooling contracts. `mise run qualify` passed those cases and 22 disposal-based qualification cases. The worker target rejected `document` as an unknown global. Other observed rejections included a floating promise, an absent behavior suite, and a missing child gate. Checkers and fixers preserved the consumer inputs on the converged positive case.
- `mise exec -- bun run build` produced `index.html`, `app.js`, `style.css`, and `offline.js`. The worker included its build-specific cache version and its file digest was `42b6ea0729a0e0e41bdd80e1b8e4d7f7ee37c1a5f23805501fdeb6a3bd62ad30`.
- Chromium `159.0.8154.6` at a 360-pixel viewport exercised adding items, keyboard toggling, rejected blank input, offline reload, and persistence after offline writes. An injected storage quota failure preserved prior data and the unsaved entry. A retry saved the entry once. Axe `4.14.1` reported zero violations in the checked WCAG 2.0 and 2.1 A/AA tags for that page state.

Final acceptance remains pending for a published, fixed-version asset in a clean environment where the Rill source checkout is inaccessible. It requires the completed natural-request and consequential-ambiguity sessions, a committed product candidate with reproducible browser evidence, and independent review. See [the product request journey](../workflow/ACCEPTANCE.md#qualify-the-product-request-journey).
