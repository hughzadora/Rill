#!/usr/bin/env bash
set -euo pipefail

git rev-parse HEAD
uname -sm
mise --version
mise install --locked
mise lock --check
mise exec -- bun install --frozen-lockfile
git diff --exit-code
