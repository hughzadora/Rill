#!/usr/bin/env bash
set -euo pipefail

mode="${1:-incremental}"
if [[ "$mode" != full && "$mode" != incremental ]]; then
  printf 'Unsupported CI mode: %s\n' "$mode" >&2
  exit 2
fi

base=HEAD~1
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  base="$(git merge-base HEAD origin/main)"
fi

if [[ "$mode" == full ]]; then
  changed='FULL'
else
  changed="$({
    git diff --name-only "$base" HEAD
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  } | sort -u)"
fi

# Changes to shared orchestration or tool versions require every language gate.
if [[ "$mode" == incremental ]] && grep -Eq '(^|/)(justfile|mise.lock|AGENTS.md|pyproject.toml|biome.json|knip.json|vitest.config.ts|.semgrep.yml)$' <<<"$changed"; then
  mode=full
fi

run_guardrails() {
  local toml_files=(mise.toml pyproject.toml quality-fixtures/config/quality.toml quality-fixtures/python/pyproject.toml .codex/config.toml)
  mise exec --locked -- taplo fmt --check "${toml_files[@]}"
  mise exec --locked -- taplo check "${toml_files[@]}"
  mise exec --locked -- typos --force-exclude
  mise exec --locked -- gitleaks dir --redact --no-banner .
  mise exec --locked -- semgrep scan --config .semgrep.yml --error --quiet src tools
  mise exec --locked -- pnpm exec jscpd src tools
  mise exec --locked -- trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL --exit-code 1 --quiet --skip-dirs node_modules --skip-dirs .venv --skip-dirs quality-fixtures/web/node_modules --skip-dirs quality-fixtures/python/.venv .
}

run_ts() {
  mise exec --locked -- pnpm exec biome ci .
  mise exec --locked -- pnpm exec tsc --noEmit
  mise exec --locked -- pnpm exec tsc --project tsconfig.legacy.json --noEmit
  mise exec --locked -- pnpm exec knip
  mise exec --locked -- pnpm exec vitest run --coverage
}

run_py() {
  mise exec --locked -- uv run ruff check src/py tests/py
  mise exec --locked -- uv run ruff format --check src/py tests/py
  mise exec --locked -- uv run pyright
  if find tests/py -type f -name 'test_*.py' -print -quit | grep -q .; then
    mise exec --locked -- uv run pytest --cov=src/py --cov-fail-under=80
  fi
}

run_sh() {
  mapfile -d '' shells < <(find src/sh -type f -name '*.sh' -print0)
  if ((${#shells[@]} > 0)); then
    mise exec --locked -- shellcheck -x -S style "${shells[@]}"
    mise exec --locked -- shfmt -d -i 2 -ci "${shells[@]}"
  fi
  if find tests/sh -type f -name '*.bats' -print -quit | grep -q .; then
    mise exec --locked -- bats --jobs 4 tests/sh
  fi
}

pids=()
names=()
start() {
  local name="$1"
  printf '[ci] start %s\n' "$name"
  (
    case "$name" in
      guardrails) run_guardrails ;;
      ts) run_ts ;;
      py) run_py ;;
      sh) run_sh ;;
      *) exit 2 ;;
    esac
  ) >"${TMPDIR:-/tmp}/rill-ci-${name}-$$.log" 2>&1 &
  pids+=("$!")
  names+=("$name")
}

start guardrails
should_run() {
  local selector="$1"
  [[ "$mode" == full ]] && return 0
  case "$selector" in
    ts) grep -Eq '(^|/)([^/]+\.(ts|tsx|js|jsx|json|jsonc)|pnpm-lock\.yaml|package\.json|tsconfig\.json)$' <<<"$changed" ;;
    py) grep -Eq '(^|/)([^/]+\.(py|toml)|uv\.lock|mise\.lock)$' <<<"$changed" ;;
    sh) grep -Eq '\.(sh|bats)$' <<<"$changed" ;;
  esac
}
should_run ts && start ts
should_run py && start py
should_run sh && start sh

status=0
for index in "${!pids[@]}"; do
  if wait "${pids[$index]}"; then
    printf '[ci] PASS %s\n' "${names[$index]}"
  else
    printf '[ci] FAIL %s\n' "${names[$index]}" >&2
    status=1
  fi
  cat "${TMPDIR:-/tmp}/rill-ci-${names[$index]}-$$.log"
  rm -f "${TMPDIR:-/tmp}/rill-ci-${names[$index]}-$$.log"
done
exit "$status"
