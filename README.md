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

## Local multi-language quality gates

The source-of-truth local workflow is pinned by `mise.lock`, `pnpm-lock.yaml`,
and `uv.lock`. Python 3.14 is the current compatible stable runtime for the
locked Semgrep dependency chain; tools otherwise follow stable upstream releases.

```sh
just setup
just ci
just ci-full
```

`just ci` runs mandatory security and repository guardrails every time and
selects TypeScript, Python, and shell checks by the changes relative to
`origin/main` (or the previous commit). Shared configuration or lockfile
changes trigger all language checks. Each selected worker runs in parallel;
all errors are gathered and produce a nonzero result. `just ci-full` forces
all workers regardless of changes.

Husky enforces staged secrets and lint at pre-commit, Conventional Commits
at commit-message creation, and incremental CI before push. The new
`src/{ts,py,sh}` and `tests/{ts,py,sh}` modules are exercised in the native
Vitest, pytest and Bats runners. Existing quality-profile TypeScript remains
checked by `tsconfig.legacy.json` while newly introduced TypeScript uses the
strict `tsconfig.json`, including exact optional properties and unchecked-index
checks. Legacy exports are separately inventoried by Knip with narrow
candidate-profile exceptions rather than globally ignored.

The versioned `quality-standards/0.1.1` candidate reflects the updated
implementation without overwriting the earlier `0.1.0` manifest.
