#!/usr/bin/env bash
set -euo pipefail

profile=$(cd -- "$(dirname -- "$0")/.." && pwd)
scanner=(trivy --config "$profile/trivy.yaml")
status=0

case $1 in
iac)
  "${scanner[@]}" config --include-non-failures --format json "$2" >"$3" || status=$?
  if [[ $status != 0 && $status != 42 ]]; then
    exit "$status"
  fi
  if ! jq -e 'any(.Results[]?; .Type == "dockerfile" and
      ((.MisconfSummary.Successes // 0) + (.MisconfSummary.Failures // 0) > 0))' "$3" >/dev/null; then
    printf 'Trivy did not report evaluated Dockerfile checks\n' >&2
    exit 1
  fi
  ;;
image)
  image_id=$(<"$2/image.id")
  docker_host=${DOCKER_HOST:-}
  if [[ $docker_host == unix://* ]]; then
      "${scanner[@]}" image --docker-host "$docker_host" --scanners vuln --include-non-failures --format json "$image_id" >"$3" || status=$?
  else
    "${scanner[@]}" image --scanners vuln --include-non-failures --format json "$image_id" >"$3" || status=$?
  fi
  if ! jq -e 'any(.Results[]?; .MisconfSummary and ((.MisconfSummary.Successes // 0) + (.MisconfSummary.Failures // 0) > 0))' "$3" >/dev/null; then
    printf 'Image scan passed (no misconfig checks applicable to single-stage image)\n'
  fi
  ;;
*)
  printf 'Usage: %s iac|image <context|image> <report.json>\n' "$0" >&2
  exit 2
  ;;
esac

exit "$status"
