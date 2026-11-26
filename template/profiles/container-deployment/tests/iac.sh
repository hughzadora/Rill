#!/usr/bin/env bash
set -euo pipefail

profile=$(cd -- "$(dirname -- "$0")/.." && pwd)
evidence=$1
fixture="$evidence/IaC fixtures"
mkdir -p -- "$fixture/root user" "$fixture/empty"

bash "$profile/scripts/policy.sh" iac "$profile/image" "$evidence/iac-pass.json"
sed 's/^USER 65534:65534$/USER 0:0/' "$profile/image/Dockerfile" >"$fixture/root user/Dockerfile"

status=0
bash "$profile/scripts/policy.sh" iac "$fixture/root user" "$evidence/iac-root-user.json" || status=$?
if [[ $status != 42 ]]; then
  printf 'Expected Trivy findings exit 42 for the root-user fixture, got %s\n' "$status" >&2
  exit 1
fi
jq -e 'any(.Results[].Misconfigurations[]?; .ID == "DS-0002" and .Status == "FAIL")' \
  "$evidence/iac-root-user.json" >/dev/null

status=0
bash "$profile/scripts/policy.sh" iac "$fixture/empty" "$evidence/iac-empty.json" \
  2>"$evidence/iac-empty.stderr" || status=$?
if [[ $status != 1 ]]; then
  printf 'Expected missing Dockerfile coverage exit 1, got %s\n' "$status" >&2
  exit 1
fi
grep -Fx 'Trivy did not report evaluated Dockerfile checks' "$evidence/iac-empty.stderr"
printf 'IaC accepted the Dockerfile and rejected root-user and empty-scope fixtures.\n'
