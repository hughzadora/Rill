# Rill

See [QUALITY_STANDARD.md](QUALITY_STANDARD.md) for the provisional design,
measured gaps, and acceptance blockers.

## Quality commands

Install the project tool versions resolved in the committed Mise lock:

```sh
just install
```

Run the profile checks:

```sh
just lint
just secret-scan
just quality
just full-spec-ci
```

See [Rill #18 pilot evidence](docs/quality/rill-18-pilot.md) for
a real existing-project trial. The candidate is not an approved
production release and a bound marker alone does not install target CI.

Tool requests use stable `latest` in `mise.toml`. Create the initial lock with
`mise lock`; update it deliberately with `mise lock --bump` and review the
result before installation. Python files use Ruff; authored TOML files use
Taplo. Generated Mise sidecars are outside the TOML format gate. Project
dependency locks remain managed by their native package managers.
