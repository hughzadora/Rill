#!/usr/bin/env bash
set -euo pipefail

output=${1:?Provide an empty mutation report directory}
mkdir "$output"
cargo mutants --list >"$output/scope.txt"
if ! grep -q '^src/lib\.rs:' "$output/scope.txt"; then
  echo 'No critical batching mutants discovered.' >&2
  exit 1
fi
cargo mutants --output "$output" --jobs 2
test -s "$output/mutants.out/caught.txt"
LC_ALL=C sort "$output/scope.txt" >"$output/expected.txt"
LC_ALL=C sort "$output/mutants.out/caught.txt" >"$output/caught.txt"
diff -u "$output/expected.txt" "$output/caught.txt"
for outcome in missed timeout unviable; do
  list="$output/mutants.out/$outcome.txt"
  if [[ ! -f $list || -s $list ]]; then
    echo "Inspect mutation outcome: $list" >&2
    exit 1
  fi
done
