# Rust CLI profile

This profile supplies `batch-plan`, a runnable starting point for a standalone Rust package and CLI. It calculates the fewest batches needed to handle an item count at a given per-batch capacity. It has a library API for the calculation and a CLI with no runtime dependencies.

## Run the CLI

Install mise and a native Rust linker for the host. In the adopted project directory, review and trust the mise configuration, then run:

```bash
mise install --locked
mise lock --check
mise exec -- cargo fetch --locked
mise run build
./target/release/batch-plan 13 5
```

The command prints `3` with a trailing newline. Both operands are ASCII unsigned 64-bit decimal integers. The capacity must be positive and an empty workload prints `0`. Use `--help` to see the usage and `--version` for the Cargo manifest version.

Successful output goes to stdout. Invalid usage exits `2` with an actionable stderr message and an empty stdout. A closed stdout exits `1` with an error if stderr is open. The command does not prompt, read stdin or persist state, so rerunning it after an interruption is safe.

## Verify and qualify

| Command                 | Evidence                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run verify`       | Read-only rustfmt, Oxfmt and shfmt checks, locked Cargo checks, Clippy with warnings denied, ShellCheck, the named Cargo process and property suites, one doctest, cargo-deny, redacted Gitleaks, spelling and local links. |
| `mise run qualify`      | An isolated execution of the actual release binary, bounded cargo-mutants results and disposable misformatting, compiler, lint, dependency, secret, discovery and behavior faults with native diagnostics checked.          |
| `mise run scan-history` | Redacted Gitleaks scan of project history when a Git history exists.                                                                                                                                                        |

Cargo owns the dependency graph in `Cargo.lock`. Mise selects Rust, its rustup-provided components, and the other tools. It installs the pinned cargo-mutants crate with the crate's upstream lock. The cargo-deny command checks project dependencies, including dev dependencies, for RustSec advisories, allowed licenses, bans and approved sources. This check needs access to the advisory database.

The CLI tests exercise the real process. The [property suite](tests/batching.rs) checks that every item fits and that one fewer batch cannot fit the workload using `u128` arithmetic, with known answers for exact loads and `u64` limits. Proptest reports the seed and shrunk counterexample on failure. The [mutation configuration](.cargo/mutants.toml) targets the calculation and selects only product tests. A timeout, invalid result, surviving mutant or empty effective run requires investigation.

Qualification keeps logs, the mutation inventory and individual outcomes under `reports/qualification/`. Keep reports with the candidate commit, Rill kit checksum, toolchain identity and binary checksum. Run both gates again from a clean clone whenever the activated tooling or checks change. The included mise lock covers macOS arm64. Qualify locked installation and release-binary execution on any additional target before offering support.
