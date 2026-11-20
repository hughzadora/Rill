#!/usr/bin/env bash
# Print one greeting, with no hidden global state.
set -euo pipefail

printf 'Hello, %s!\n' "$1"
