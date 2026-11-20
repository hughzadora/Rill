# Install the Rill CLI

Rill is distributed as a versioned GitHub Release artifact. No Python virtual
environment is required at runtime. Supported targets: Apple Silicon Macs
(arm64, macOS 26 or newer), Linux x64 and Linux arm64. Intel Macs and Windows
are intentionally unsupported.

Use mise's native GitHub backend with the exact version and asset for your
platform. For example, on Linux x64:

```toml
[tools."github:hughzadora/Rill"]
version = "vX.Y.Z"
asset_pattern = "rill-linux-x64.tar.gz"
bin_path = "rill"
```

Replace `vX.Y.Z` with the published tag (which must match the root `VERSION`),
then run `mise install`, `mise which rill`,
`rill version` and `rill doctor`. The asset pattern chooses the published
archive for the selected platform. For Apple Silicon use
`rill-macos-arm64.tar.gz`; for Linux ARM64 use `rill-linux-arm64.tar.gz`.
Pin a release; do not rely on latest. Review
`SHA256SUMS.txt` and release provenance before installing.

For an empty or clean Git repository use `rill init PATH --yes`; the CLI
creates `feat/rill-init` when necessary and records one initialization commit.
For a previously adopted clean repository use `rill upgrade PATH --yes`;
the CLI checks managed hashes and commits only changed managed assets.
`rill status PATH`, `rill doctor PATH`, and `rill ui PATH --no-open` are
safe local observations. `rill ui PATH --serve` temporarily serves the
single-file dashboard on loopback, accepts one owner decision and exits.
Use `rill --json status PATH` for a machine-readable, single-line receipt.

The binary needs no Python virtual environment. The factory toolchain
(`git`, `mise`, `uv`, `pnpm`, `just`) is nevertheless expected on the host;
`rill doctor` reports missing tools as an environment error (exit code 2).
No Intel Mac or Windows release archive is produced. Version Tags alone
trigger the multi-platform release workflow; ordinary PRs never launch
macOS runners.
`--yes` approves the CLI operation but does not grant autonomous permission
to override product-owned files, deploy, purchase services or bypass Codex
sandbox boundaries. An upgrade rejects locally modified Rill-managed files
and requires a clean Git worktree.
