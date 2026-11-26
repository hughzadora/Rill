#!/usr/bin/env bash
set -euo pipefail

runtime=${RILL_DOCKER_HOST:-unix://$HOME/.colima/rill-issue-13/docker.sock}
export DOCKER_HOST=$runtime
export TRIVY_DOCKER_HOST=$runtime
tag="rill-deployment-fixture:local"

case ${1:-} in
build)
  context=$2
  output=$3
  mkdir -p -- "$output"
  docker build --pull --tag "$tag" --iidfile "$output/image.id" "$context"
  docker image inspect "$tag" --format '{{.Id}}' >"$output/image.inspect"
  ;;
load)
  output=$2
  docker load --input "$output/image.tar"
  ;;
smoke)
  output=$2
  result=$3
  mkdir -p -- "$result"
  port=$(node -e 'const net=require("node:net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close();});')
  container=$(docker create --publish "127.0.0.1:$port:8080" "$tag")
  trap 'docker rm --force "$container" >/dev/null 2>&1 || true' EXIT
  docker start "$container" >/dev/null
  ready=0
  for _ in {1..30}; do
    if curl --silent --fail --connect-timeout 1 --max-time 2 \
      "http://127.0.0.1:$port/health" >"$result/health.txt"; then
      ready=1
      break
    fi
    sleep 0.2
  done
  printf '%s\n' "$port" >"$result/port.txt"
  docker inspect "$container" >"$result/container.json"
  if [[ $ready != 1 ]]; then
    docker logs "$container" >"$result/container.log" 2>&1 || true
    printf 'Container did not become ready\n' >&2
    exit 42
  fi
  curl --silent --fail --connect-timeout 1 --max-time 2 \
    "http://127.0.0.1:$port/" >"$result/response.html"
  expected=${RILL_EXPECTED_MARKER:-"Rill deployment fixture is serving."}
  if ! grep -Fq -- "$expected" "$result/response.html"; then
    printf 'The served page did not contain the accepted behavior.\n' >&2
    exit 43
  fi
  ;;
save)
  output=$2
  docker save --output "$output/image.tar" "$tag"
  ;;
*)
  printf 'Usage: %s build|load|smoke|save <arguments>\n' "$0" >&2
  exit 2
  ;;
esac
