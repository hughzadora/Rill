#!/usr/bin/env bash
set -euo pipefail

hello() {
  printf 'Hello, %s!\n' "$1"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  hello "$@"
fi
