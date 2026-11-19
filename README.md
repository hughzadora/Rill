# Rill

## Quality commands

Install the project tool versions resolved in the committed Mise lock:

```sh
just install
```

Run the upstream profile checks:

```sh
just lint
just secret-scan
just quality
```

Tool requests use stable `latest` in `mise.toml`. Create the initial lock with
`mise lock`; update it deliberately with `mise lock --bump` and review the
result before installation. Python files use Ruff; authored TOML files use
Taplo. Generated Mise sidecars are outside the TOML format gate. Project
dependency locks remain managed by their native package managers.
