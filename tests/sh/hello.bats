#!/usr/bin/env bats

@test "hello greets a supplied name" {
  run bash src/sh/hello.sh "Rill"
  [ "$status" -eq 0 ]
  [ "$output" = "Hello, Rill!" ]
}
