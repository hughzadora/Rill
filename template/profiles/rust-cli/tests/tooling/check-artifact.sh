#!/usr/bin/env bash
set -euo pipefail

binary=${1:?Provide the built release executable}
package_id=$(cargo pkgid --locked)
version=${package_id##*[@#]}
workspace=$(mktemp -d "${TMPDIR:-/tmp}/batch plan artifact.XXXXXX")
trap 'rm -rf "$workspace"' EXIT
test -x "$binary"
cp "$binary" "$workspace/batch-plan"
cd "$workspace"

./batch-plan --version >stdout 2>stderr
grep -Fx "batch-plan $version" stdout
test ! -s stderr
./batch-plan --help >stdout 2>stderr
grep -Fx 'Usage: batch-plan ITEMS CAPACITY' stdout
test ! -s stderr
printf '3\n' >expected
./batch-plan 13 5 </dev/null >stdout 2>stderr
cmp stdout expected
test ! -s stderr

status=0
./batch-plan 1 0 </dev/null >stdout 2>stderr || status=$?
test "$status" -eq 2
test ! -s stdout
grep -Fx 'batch-plan: CAPACITY must be a positive unsigned 64-bit decimal; see --help' stderr
echo 'Release executable passed in a separate working directory.'
