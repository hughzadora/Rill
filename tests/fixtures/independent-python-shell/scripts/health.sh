#!/usr/bin/env bash
set -euo pipefail

name="${1-Rill}"
if [[ -z "$name" ]]; then
  printf 'missing name\n' >&2
  exit 2
fi
printf 'healthy %s\n' "$name"
