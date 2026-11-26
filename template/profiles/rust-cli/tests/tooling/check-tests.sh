#!/usr/bin/env bash
set -euo pipefail

results=$(mktemp -d)
trap 'rm -rf "$results"' EXIT
export LC_ALL=C
export CARGO_TERM_COLOR=never

cargo test --workspace --all-targets --locked -- --list --format terse | tee "$results/list"
sed -n 's/: test$//p' "$results/list" | sort >"$results/discovered"
diff -u tests/tooling/expected-tests.txt "$results/discovered"

cargo test --workspace --all-targets --locked -- --format pretty | tee "$results/all-targets"
sed -n 's/^test \(.*\) \.\.\. ok$/\1/p' "$results/all-targets" | sort >"$results/executed"
diff -u tests/tooling/expected-tests.txt "$results/executed"

cargo test --workspace --doc --locked -- --format pretty | tee "$results/doctests"
if ! grep -Eq '^test src/lib\.rs - minimum_batches \(line [0-9]+\) \.\.\. ok$' "$results/doctests"; then
  echo 'Expected the minimum_batches doctest to execute successfully.' >&2
  exit 1
fi
