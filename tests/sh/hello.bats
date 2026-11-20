#!/usr/bin/env bats

@test "hello prints the supplied name" {
  run bash src/sh/hello.sh "Rill"
  [ "$status" -eq 0 ]
  [ "$output" = "Hello, Rill!" ]
}

@test "hello rejects a missing required argument" {
  run bash src/sh/hello.sh
  [ "$status" -ne 0 ]
}
