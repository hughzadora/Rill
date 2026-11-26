#!/usr/bin/env bash
set -euo pipefail

profile=$(cd -- "$(dirname -- "$0")/.." && pwd)
runtime=${RILL_DOCKER_HOST:-unix://$HOME/.colima/rill-issue-13/docker.sock}
export DOCKER_HOST=$runtime
export TRIVY_DOCKER_HOST=$runtime
case ${1:-} in
verify | iac | qualify) ;;
*) exit 2 ;;
esac

evidence_root=${RILL_DEPLOYMENT_EVIDENCE_DIR:-"$profile/.rill-deployment"}
mkdir -p -- "$evidence_root"
evidence=$(mktemp -d "$evidence_root/$1.XXXXXX")
printf 'Deployment evidence: %s\n' "$evidence"
if [[ $1 != verify ]]; then
  bash "$profile/tests/iac.sh" "$evidence"
fi
if [[ $1 == iac ]]; then
  exit 0
fi

image=(bash "$profile/scripts/image.sh")
policy=(bash "$profile/scripts/policy.sh")
context="$profile/image"

"${policy[@]}" iac "$context" "$evidence/iac-pass.json"
"${image[@]}" build "$context" "$evidence/accepted"
docker_image=$(cat "$evidence/accepted/image.id")
"${policy[@]}" image "$evidence/accepted" "$evidence/image-pass.json"
"${image[@]}" smoke "$evidence/accepted" "$evidence/initial-smoke"
if [[ $1 == verify ]]; then
  exit 0
fi

fixture="$evidence/Image fixtures"
mkdir -p -- "$fixture/root user" "$fixture/broken behavior"
cp -R "$context/." "$fixture/root user/"
cp -R "$context/." "$fixture/broken behavior/"
sed 's/^USER 65534:65534$/USER 0:0/' "$context/Dockerfile" >"$fixture/root user/Dockerfile"
printf 'An unexpected page from the next build.\n' >"$fixture/broken behavior/site/index.html"

"${image[@]}" build "$fixture/root user" "$evidence/root-image"
status=0
"${policy[@]}" image "$evidence/root-image" "$evidence/image-root-user.json" || status=$?
if [[ $status != 42 ]]; then
  printf 'Expected Trivy findings exit 42 for the root-user image, got %s\n' "$status" >&2
  exit 1
fi
jq -e 'any(.Results[].Misconfigurations[]?; .ID == "DS002" and .Status == "FAIL")' \
  "$evidence/image-root-user.json" >/dev/null

"${image[@]}" build "$fixture/broken behavior" "$evidence/rejected"
if [[ $(cat "$evidence/rejected/image.id") == "$docker_image" ]]; then
  printf 'The replacement must produce a distinct image ID\n' >&2
  exit 1
fi
status=0
"${image[@]}" smoke "$evidence/rejected" "$evidence/rejected-smoke" || status=$?
if [[ $status != 43 ]]; then
  printf 'Expected behavior mismatch exit 43 for the replacement, got %s\n' "$status" >&2
  exit 1
fi
grep -Fx 'ready' "$evidence/rejected-smoke/health.txt"
grep -Fx 'An unexpected page from the next build.' "$evidence/rejected-smoke/response.html"

"${image[@]}" load "$evidence/accepted" >"$evidence/recovered-load.log"
"${image[@]}" smoke "$evidence/accepted" "$evidence/recovered-smoke"
jq -e -s '.[0][0].Image == .[1][0].Image and .[0][0].Id != .[1][0].Id' \
  "$evidence/initial-smoke/container.json" "$evidence/recovered-smoke/container.json" >/dev/null
printf 'Image policy rejected root metadata. Recovery restored the accepted image and HTTP behavior.\n'
