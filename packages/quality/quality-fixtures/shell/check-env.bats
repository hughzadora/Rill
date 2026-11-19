#!/usr/bin/env bats

setup() {
  fixture="${BATS_TEST_DIRNAME}/check-env.sh"
}

@test "the shell command succeeds with an explicit argument" {
  run bash "$fixture" Rill
  [ "$status" -eq 0 ]
  [ "$output" = "quality Rill" ]
}

@test "the command has a documented default" {
  run bash "$fixture"
  [ "$status" -eq 0 ]
  [ "$output" = "quality quality" ]
}

@test "shell metacharacters remain literal data, not executable input" {
  run bash "$fixture" '$(printf unsafe >&2);*'
  [ "$status" -eq 0 ]
  [ "$output" = 'quality $(printf unsafe >&2);*' ]
}

@test "arguments with whitespace remain a single value" {
  run bash "$fixture" "quality inspection"
  [ "$status" -eq 0 ]
  [ "$output" = "quality quality inspection" ]
}
