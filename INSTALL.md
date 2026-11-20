# Install the Rill CLI

Rill is distributed as a versioned GitHub Release artifact. No Python virtual
environment is required at runtime. Supported targets: macOS arm64/x64 and
Linux arm64/x64.

Use mise's native GitHub backend with the exact version and asset for your
platform. For example, on Linux x64:

```toml
[tools."github:hughzadora/Rill"]
version = "vX.Y.Z"
asset_pattern = "rill-{{ os() }}-{{ arch() }}.tar.gz"
bin_path = "rill"
```

Replace `vX.Y.Z` with the published tag (which must match the root `VERSION`),
then run `mise install`, `mise which rill`,
`rill version` and `rill doctor`. The asset pattern chooses the published
archive for the current platform. Pin a release; do not rely on latest. Review
`SHA256SUMS.txt` and release provenance before installing.

For an empty or clean Git repository use `rill init PATH --yes`. For a
previously adopted clean repository use `rill upgrade PATH --yes`.
`--yes` approves the CLI operation but does not grant autonomous permission
to override product-owned files, deploy, purchase services or bypass Codex
sandbox boundaries. An upgrade rejects locally modified Rill-managed files
and requires a clean Git worktree.
