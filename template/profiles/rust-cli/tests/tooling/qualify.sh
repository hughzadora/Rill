#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C
export CARGO_TERM_COLOR=never
mkdir -p reports/qualification
reports=$(mktemp -d "$PWD/reports/qualification/run.XXXXXX")
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/batch plan qualify.XXXXXX")
trap 'rm -rf "$sandbox"' EXIT
archive="$sandbox/source.tar"
tar --exclude './.git' --exclude './target' --exclude './reports' --exclude './mutants.out*' \
  -cf "$archive" .
unset CARGO_TARGET_DIR CARGO_BUILD_TARGET_DIR CARGO_BUILD_BUILD_DIR

prepare() {
  if [[ -n ${fixture:-} ]]; then
    rm -rf "$fixture"
  fi
  fixture="$sandbox/$1"
  mkdir "$fixture"
  tar -xf "$archive" -C "$fixture"
}

reject() {
  local name=$1 expected_status=$2 diagnostic=$3
  shift 3
  local log="$reports/$name.log" status=0
  (cd "$fixture" && "$@") >"$log" 2>&1 || status=$?
  if [[ $status -ne $expected_status ]] || ! grep -Fq -- "$diagnostic" "$log"; then
    cat "$log" >&2
    echo "FAIL $name (exit $status, expected $expected_status and $diagnostic)" >&2
    exit 1
  fi
  echo "PASS $name (exit $status, $diagnostic)"
}

baseline() {
  local name=$1
  shift
  local log="$reports/$name.log"
  if ! "$@" >"$log" 2>&1; then
    cat "$log" >&2
    exit 1
  fi
  echo "PASS $name (exit 0)"
}

check_mutation() (
  cd "$fixture" && bash tests/tooling/check-mutation.sh "$reports/mutation"
)

echo "Qualification reports: $reports"
baseline release-artifact bash tests/tooling/check-artifact.sh target/release/batch-plan
prepare mutation
baseline mutation check_mutation

prepare rustfmt
printf '\nfn   misformatted(  ) -> () { }\n' >>"$fixture/src/lib.rs"
reject rustfmt 1 'Diff in ' cargo fmt --all -- --check

prepare compiler
printf '\npub const FLAGS: u64 = "invalid";\n' >>"$fixture/src/lib.rs"
reject compiler 101 'error[E0308]: mismatched types' cargo check --workspace --all-targets --locked

prepare clippy
printf '\npub fn redundant() -> bool {\n    true == true\n}\n' >>"$fixture/src/lib.rs"
reject clippy 101 'clippy::eq_op' cargo clippy --workspace --all-targets --locked -- -D warnings

prepare shell-format
printf '\nif true; then\n      echo valid\nfi\n' >>"$fixture/tests/tooling/check-artifact.sh"
reject shell-format 1 'check-artifact.sh' shfmt -i 2 -d tests/tooling

prepare shell-lint
printf '\nvalue="two words"\necho %s\n' "\$value" >>"$fixture/tests/tooling/check-artifact.sh"
reject shell-lint 1 'SC2086' shellcheck -s bash tests/tooling/check-artifact.sh

prepare text-format
printf '\n{   "enabled":true  }\n' >"$fixture/qualification.json"
reject text-format 1 'qualification.json' oxfmt --check .

prepare spelling
misspelling="accom$(printf '%s' 'odation')"
printf '\nThe %s is ready.\n' "$misspelling" >>"$fixture/README.md"
reject spelling 2 "$misspelling" typos README.md

prepare links
printf '\n[Missing file](./no-such-local-document.md)\n' >>"$fixture/README.md"
reject links 2 'File not found' lychee --offline --no-progress README.md

prepare dependency-policy
sed '/^wildcards/a\
deny = [{ crate = "tempfile" }]
' "$fixture/deny.toml" >"$fixture/deny.changed"
mv "$fixture/deny.changed" "$fixture/deny.toml"
reject dependency-policy 2 'error[banned]: crate' cargo deny --locked check --show-stats

prepare secret
synthetic="ghp_$(printf '%s%s' 'A1b2C3d4E5f6G7h8I9' 'j0K1l2M3n4O5p6Q7r8')"
printf 'token = "%s"\n' "$synthetic" >"$fixture/qualification.toml"
reject secret 1 'github-pat' gitleaks dir --config .gitleaks.toml --redact=100 --verbose .
if grep -Fq "$synthetic" "$reports/secret.log"; then
  echo 'Secret report includes the raw qualification token.' >&2
  exit 1
fi

prepare discovery
sed 's/^fn rounds_up_to_fit_every_item()/fn renamed_case()/' \
  "$fixture/tests/cli.rs" >"$fixture/tests/cli.changed"
mv "$fixture/tests/cli.changed" "$fixture/tests/cli.rs"
reject discovery 1 '-rounds_up_to_fit_every_item' bash tests/tooling/check-tests.sh

prepare ignored-case
sed '/^fn rounds_up_to_fit_every_item()/i\
#[ignore]
' "$fixture/tests/cli.rs" >"$fixture/tests/cli.changed"
mv "$fixture/tests/cli.changed" "$fixture/tests/cli.rs"
reject ignored-case 1 'rounds_up_to_fit_every_item ... ignored' bash tests/tooling/check-tests.sh

prepare wrong-rounding
sed 's@items / capacity + u64::from(!items.is_multiple_of(capacity))@items / capacity@' \
  "$fixture/src/lib.rs" >"$fixture/src/lib.changed"
mv "$fixture/src/lib.changed" "$fixture/src/lib.rs"
reject wrong-rounding 101 'computed batches cannot fit all items' \
  cargo test --workspace --locked --test batching the_answer_fits_all_items_and_one_fewer_cannot -- --exact
reject wrong-rounding-process 101 'Unexpected stdout' cargo test --workspace --locked --test cli \
  rounds_up_to_fit_every_item -- --exact

prepare suppressed-output-failure
sed 's/return ExitCode::FAILURE/return ExitCode::SUCCESS/' \
  "$fixture/src/main.rs" >"$fixture/src/main.changed"
mv "$fixture/src/main.changed" "$fixture/src/main.rs"
reject suppressed-output-failure 101 'right: Some(1)' \
  cargo test --workspace --locked --test cli closed_output_is_reported_and_retry_works -- --exact

prepare empty-mutation
sed 's@src/lib\.rs@src/no-such-file.rs@' "$fixture/.cargo/mutants.toml" >"$fixture/.cargo/mutants.changed"
mv "$fixture/.cargo/mutants.changed" "$fixture/.cargo/mutants.toml"
reject empty-mutation 1 'No critical batching mutants discovered.' \
  bash tests/tooling/check-mutation.sh "$reports/empty-mutation"
