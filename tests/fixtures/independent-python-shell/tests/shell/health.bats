#!/usr/bin/env bats

@test "healthy CLI behavior" {
  run bash "$BATS_TEST_DIRNAME/../../scripts/health.sh" Independent
  [ "$status" -eq 0 ]
  [ "$output" = "healthy Independent" ]
}

@test "invalid input fails safely" {
  run bash "$BATS_TEST_DIRNAME/../../scripts/health.sh" ""
  [ "$status" -eq 2 ]
  [ "$output" = "missing name" ]
}
