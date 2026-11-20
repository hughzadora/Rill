set shell := ["bash", "-euo", "pipefail", "-c"]
export MISE_QUIET := "1"
export MISE_LOCKED_SCOPES := "project"
export MISE_LOCKFILE_PLATFORMS := "linux-x64"
# Prevent machine-level tools from silently changing the project's pinned CI.
export MISE_CONFIG_DIR := justfile_directory() + "/.mise"
export MISE_SYSTEM_CONFIG_DIR := justfile_directory() + "/.mise"

# Mise resolves upstream CLI versions, pnpm and uv lock package dependencies.
lock:
    mise lock

lock-bump:
    mise lock --bump

# Install tools, project dependencies, hooks and Chromium for browser E2E.
setup:
    mise install --locked
    HUSKY=0 mise exec --locked -- pnpm install --frozen-lockfile
    mise exec --locked -- uv sync --all-extras --dev --locked --python "$(mise which python)"
    mise exec --locked -- pnpm exec husky
    @if [[ "${CI:-}" == "true" ]]; then mise exec --locked -- pnpm exec playwright install --with-deps chromium; else mise exec --locked -- pnpm exec playwright install chromium; fi

pre-commit:
    mise exec --locked -- gitleaks git --staged --redact --no-banner
    mise exec --locked -- pnpm exec lint-staged

commit-msg msg_file:
    mise exec --locked -- pnpm exec commitlint --edit {{quote(msg_file)}}

# Repository-level checks are mandatory on full and incremental runs.
_ci-guardrails:
    @modified="$(git status --porcelain -- justfile mise.toml biome.json pyproject.toml .semgrep.yml tsconfig.json vitest.config.ts stryker.config.json playwright.config.ts | cut -c4- | sort -u)"; if [[ -n "$modified" ]]; then printf "%s\n" "======================================================================" "[AUDIT WARNING] Core CI guardrail configuration changed; human review required:" "$modified" "======================================================================"; fi
    mise exec --locked -- taplo check mise.toml pyproject.toml
    mise exec --locked -- taplo fmt --check mise.toml pyproject.toml
    mise exec --locked -- typos --force-exclude --exclude "**/.mise/locks/**" --exclude "**/dist/**" --exclude "**/playwright-report/**" --exclude "**/test-results/**"
    mise exec --locked -- markdownlint-cli2 '**/*.md' '#node_modules' '#.venv' '#dist' '#playwright-report' '#test-results'
    mise exec --locked -- gitleaks git --redact --exit-code 1
    mise exec --locked -- semgrep scan --config .semgrep.yml --error --quiet src/
    mise exec --locked -- pnpm exec jscpd src/
    @warnings="$(mise exec --locked -- lizard src/ -C 12 -L 60 -a 5 -w)"; if [[ -n "$warnings" ]]; then printf '%s\n' "$warnings" >&2; exit 1; fi
    mise exec --locked -- tokei src/
    mise exec --locked -- trivy fs --scanners vuln,misconfig,secret,license --severity HIGH,CRITICAL --ignored-licenses MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC,MPL-2.0,0BSD,Unicode-DFS-2016,BlueOak-1.0.0 --skip-dirs .mise --skip-dirs node_modules --skip-dirs .venv --skip-dirs dist --skip-dirs coverage --skip-dirs playwright-report --skip-dirs test-results --skip-dirs mutants --skip-dirs .stryker-tmp --exit-code 1 --quiet .

# The browser tests run against the verified production build, not a dev server.
_ci-ts:
    mise exec --locked -- biome check .
    mise exec --locked -- oxlint --react-plugin --jsx-a11y-plugin .
    mise exec --locked -- pnpm exec tsc --noEmit
    mise exec --locked -- pnpm exec knip
    mise exec --locked -- pnpm exec vitest run --coverage --passWithNoTests
    mise exec --locked -- pnpm exec vite build
    test -s dist/index.html
    mise exec --locked -- pnpm exec playwright test

_ci-py:
    mise exec --locked -- ruff check .
    mise exec --locked -- ruff format --check .
    mise exec --locked -- uv run --python "$(mise which python)" pyright
    mise exec --locked -- pip-licenses --python .venv/bin/python --allow-only "MIT;MIT License;Apache Software License;Apache-2.0;BSD License;BSD-2-Clause;BSD-3-Clause;PSF-2.0;Apache-2.0 OR BSD-2-Clause;Mozilla Public License 2.0 (MPL 2.0)"
    mise exec --locked -- uv run --python "$(mise which python)" pytest --cov=src/rill_quality --cov-fail-under=80

_ci-sh:
    mise exec --locked -- shellcheck --severity=style -x src/sh/*.sh
    mise exec --locked -- shfmt -d -i 2 -ci src/sh/*.sh
    mise exec --locked -- bats --jobs 4 tests/sh

# Single Just shebang recipe: diff detection and four parallel worker processes.
ci mode="incremental":
    #!/usr/bin/env bash
    set -euo pipefail

    mode={{quote(mode)}}
    if [[ "$mode" != "incremental" && "$mode" != "full" ]]; then
      printf 'Unknown CI mode: %s\n' "$mode" >&2
      exit 2
    fi

    changed=()
    if [[ "$mode" == "incremental" ]]; then
      if git rev-parse --verify origin/main >/dev/null 2>&1; then
        base="$(git merge-base HEAD origin/main)"
      elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
        base="HEAD~1"
      else
        base="$(git hash-object -t tree /dev/null)"
      fi
      mapfile -d '' -t changed < <(
        {
          git diff --name-only -z "$base" --
          git ls-files --others --exclude-standard -z
        } | sort -zu
      )
    fi

    run_all=false
    [[ "$mode" == "full" ]] && run_all=true
    run_ts=false
    run_py=false
    run_sh=false

    for path in "${changed[@]}"; do
      case "$path" in
        justfile|mise.toml|mise.lock|package.json|pnpm-lock.yaml|uv.lock|pyproject.toml|AGENTS.md|.editorconfig|.jscpd.json|.semgrep.yml|biome.json|knip.json|tsconfig.json|vitest.config.ts|vite.config.ts|stryker.config.json|playwright.config.ts|index.html|.github/workflows/*)
          run_all=true ;;
        src/ts/*|tests/ts/*|tests/e2e/*|*.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.css|*.html)
          run_ts=true ;;
        *.py)
          run_py=true ;;
        *.sh|*.bats)
          run_sh=true ;;
      esac
    done

    if [[ "$run_all" == true ]]; then
      run_ts=true
      run_py=true
      run_sh=true
    fi

    tasks=(guardrails)
    [[ "$run_ts" == true ]] && tasks+=(ts)
    [[ "$run_py" == true ]] && tasks+=(py)
    [[ "$run_sh" == true ]] && tasks+=(sh)

    workdir="$(mktemp -d)"
    trap 'rm -rf -- "$workdir"' EXIT
    pids=()
    for name in "${tasks[@]}"; do
      printf '[ci] START %s\n' "$name"
      just "_ci-$name" >"$workdir/$name.log" 2>&1 &
      pids+=("$!")
    done

    result=0
    for index in "${!pids[@]}"; do
      name="${tasks[index]}"
      if wait "${pids[index]}"; then
        printf '[ci] PASS %s\n' "$name"
      else
        printf '[ci] FAIL %s\n' "$name" >&2
        result=1
      fi
      cat "$workdir/$name.log"
    done
    exit "$result"

ci-full:
    just ci full

# ==============================================================================
# 4. 防假测试压测：前后端并行变异测试 (Mutation Testing)
# ==============================================================================
verify-tests:
    #!/usr/bin/env bash
    set -euo pipefail

    if [[ ! -d src/rill_quality ]] || ! find tests/py -type f -name 'test_*.py' -print -quit | grep -q .; then
      printf '%s\n' "[mutation] Python sources or unit tests are missing." >&2
      exit 1
    fi

    printf '%s\n' "[mutation] Running independent TypeScript and Python mutation suites."
    pids=()
    names=()

    mise exec --locked -- pnpm exec stryker run &
    pids+=("$!")
    names+=(typescript)

    (
      mise exec --locked -- uv run mutmut run --max-children 4
      results="$(mise exec --locked -- uv run mutmut results --all true)"
      printf '%s\n' "$results"
      if [[ -z "$results" ]] || ! awk 'NF && $0 !~ /: killed$/ { bad = 1 } END { exit bad }' <<< "$results"; then
        printf '%s\n' "[mutation] Python produced no verified kills or has surviving, untested, or failed mutants." >&2
        exit 1
      fi
    ) &
    pids+=("$!")
    names+=(python)

    failed=0
    for i in "${!pids[@]}"; do
      if wait "${pids[i]}"; then
        printf '[mutation] PASS %s\n' "${names[i]}"
      else
        printf '[mutation] FAIL %s\n' "${names[i]}" >&2
        failed=1
      fi
    done
    exit "$failed"
