# Contributing

Begin with [the current engineering parent #22](https://github.com/hughzadora/Rill/issues/22), select a native child issue and inspect the actual branch. Work in an isolated task branch and preserve unrelated changes. Use [AGENTS.md](../AGENTS.md) for the concise native workflow and [README](../README.md) for runnable checks.

Use GitHub parent/sub-issues for work and reproducible bugs; edit each child issue's scope or outcome directly rather than appending routine progress comments. Historical issues are sources, not active task queues. Changes to product scope, permissions, spending, production or user experience require the real harness-native choice or approval path.

For substantive features, deliver a clickable prototype, HTML review of the whole design, integrated implementation, cleanup with focused tests, final evidence and a reviewable PR. The owner checks the prototype and final behavior, and decides consequential design alternatives. Do not auto-merge, weaken gates or substitute passing fixtures for product verification.

Run `just lint` while editing and `just workspace-ci` on the final candidate. Keep regressions, security findings and unresolved host/native capability limits visible. Prefer upstream skills and language-native checks to custom agent orchestration code.
