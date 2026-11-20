set shell := ["bash", "-euo", "pipefail", "-c"]
export MISE_QUIET := "1"
export MISE_LOCKED_SCOPES := "project"
export MISE_LOCKFILE_PLATFORMS := "linux-x64"
# Prevent machine-level tools from silently changing the project's pinned CI.
export MISE_CONFIG_DIR := justfile_directory() + "/.mise"
export MISE_SYSTEM_CONFIG_DIR := justfile_directory() + "/.mise"

release_platforms := "linux-x64,linux-arm64,macos-arm64"

# Mise resolves upstream CLI versions, pnpm and uv lock package dependencies.
lock:
    mise lock --platform linux-x64
    mise lock --platform {{release_platforms}} just uv python node pnpm

lock-bump:
    mise lock --bump --platform linux-x64
    mise lock --bump --platform {{release_platforms}} just uv python node pnpm

# Install tools, project dependencies, hooks and Chromium for browser E2E.
setup:
    mise install --locked
    HUSKY=0 mise exec --locked -- pnpm install --frozen-lockfile
    mise exec --locked -- uv sync --all-extras --dev --locked --python "$(mise which python)"
    mise exec --locked -- pnpm exec husky
    @if [[ "${CI:-}" == "true" ]]; then mise exec --locked -- pnpm exec playwright install --with-deps chromium chrome; else mise exec --locked -- pnpm exec playwright install chromium chrome; fi

# CI L2 installs only static analysis and unit-test tools; never downloads browsers.
setup-ci:
    mise install --locked node pnpm python uv just taplo biome oxlint ruff shellcheck shfmt bats markdownlint-cli2 typos gitleaks semgrep
    HUSKY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 mise exec --locked -- pnpm install --frozen-lockfile
    mise exec --locked -- uv sync --locked --dev --python "$(mise which python)"

pre-commit:
    mise exec --locked -- uv run rill policy pre-commit
    mise exec --locked -- gitleaks git --staged --redact --no-banner
    mise exec --locked -- pnpm exec lint-staged

commit-msg msg_file:
    mise exec --locked -- pnpm exec commitlint --edit {{quote(msg_file)}}

# All green checks stay concise; errors retain full evidence in the local anchor.
_silent-run label *argv:
    #!/usr/bin/env bash
    set -euo pipefail
    label={{quote(label)}}
    output="$(mktemp)"
    trap 'rm -f -- "$output"' EXIT
    if {{argv}} >"$output" 2>&1; then
      printf '✔ [%s] OK\n' "$label"
    else
      mkdir -p .rill
      { printf '\n[gate %s] command failed\n' "$label"; cat "$output"; } >>.rill/last-error.log
      printf '✖ [%s] FAIL (full log in .rill/last-error.log)\n' "$label" >&2
      head -n 15 "$output" >&2
      exit 1
    fi

# Repository-level checks are mandatory on full and incremental runs.
_ci-guardrails:
    @modified="$(git -c core.quotePath=false status --porcelain -- justfile mise.toml biome.json pyproject.toml .semgrep.yml tsconfig.json vitest.config.ts stryker.config.json playwright.config.ts | cut -c4- | sort -u)"; if [[ -n "$modified" ]]; then printf "%s\n" "======================================================================" "[AUDIT WARNING] Core CI guardrail configuration changed; human review required:" "$modified" "======================================================================"; fi
    mise exec --locked -- taplo check mise.toml pyproject.toml
    mise exec --locked -- taplo fmt --check mise.toml pyproject.toml
    mise exec --locked -- typos --force-exclude --exclude "**/.mise/locks/**" --exclude "**/dist/**" --exclude "**/playwright-report/**" --exclude "**/test-results/**"
    git -c core.quotePath=false ls-files -z -- '*.md' | xargs -0 -r mise exec --locked -- markdownlint-cli2
    mise exec --locked -- gitleaks git --redact --exit-code 1
    mise exec --locked -- semgrep scan --config .semgrep.yml --error --quiet src/
    mise exec --locked -- uv run rill policy governance-check
    mise exec --locked -- pnpm exec jscpd src/
    @if [[ "${RILL_CI_TIER:-L2}" == "L3" ]]; then if warnings="$(mise exec --locked -- lizard src/ -C 12 -L 60 -a 5 -w)"; then if [[ -n "$warnings" ]]; then printf '%s\n' "$warnings" >&2; exit 1; fi; else printf '%s\n' "$warnings" >&2; exit 1; fi; mise exec --locked -- tokei src/; mise exec --locked -- trivy fs --scanners vuln,misconfig,secret,license --include-dev-deps --ignored-licenses MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC,MPL-2.0,0BSD,Unicode-DFS-2016,BlueOak-1.0.0 --skip-dirs .mise --skip-dirs node_modules --skip-dirs .venv --skip-dirs dist --skip-dirs coverage --skip-dirs playwright-report --skip-dirs test-results --skip-dirs mutants --skip-dirs .stryker-tmp --exit-code 1 --quiet .; mise exec --locked -- pnpm audit --prod --audit-level moderate; fi

# The browser tests run against the verified production build, not a dev server.
_ci-ts:
    mise exec --locked -- biome check .
    mise exec --locked -- oxlint --react-plugin --jsx-a11y-plugin .
    mise exec --locked -- pnpm exec tsc --noEmit
    mise exec --locked -- pnpm exec knip
    mise exec --locked -- pnpm exec vitest run --coverage --passWithNoTests
    mise exec --locked -- pnpm exec vite build
    test -s dist/index.html
    @if [[ "${RILL_CI_TIER:-L2}" == "L3" ]]; then mise exec --locked -- pnpm exec playwright test; fi

_ci-py:
    mise exec --locked -- ruff check .
    mise exec --locked -- ruff format --check .
    mise exec --locked -- uv run --python "$(mise which python)" pyright
    # Inventory every dependency license for private use; legal classifications
    # are reported rather than treated as a CI correctness gate.
    mkdir -p build/reports
    mise exec --locked -- pip-licenses --python .venv/bin/python --format=json --output-file build/reports/python-licenses.json
    test -s build/reports/python-licenses.json
    mise exec --locked -- uv run --python "$(mise which python)" pytest --cov=src/rill_quality --cov-fail-under=80
    mise exec --locked -- uv run --python "$(mise which python)" pytest --cov=src/py/rill_cli --cov-fail-under=80

_ci-sh:
    mise exec --locked -- shellcheck --severity=style -x src/sh/*.sh
    mise exec --locked -- shfmt -d -i 2 -ci src/sh/*.sh
    mise exec --locked -- bats --jobs 4 tests/sh

# Single Just shebang recipe: diff detection and four parallel worker processes.
ci mode="incremental":
    #!/usr/bin/env bash
    START_HEAD="$(git rev-parse HEAD)" || exit 1
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
          git -c core.quotePath=false diff --name-only -z "$base" --
          git -c core.quotePath=false ls-files --others --exclude-standard -z
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

    tier=ci
    [[ "$mode" == "full" ]] && tier=core-full
    receipt() { mise exec --locked -- uv run --locked rill policy ci-receipt "$tier" "$1" "$START_HEAD"; }
    receipt running >/dev/null
    workdir="$(mktemp -d)"
    trap 'rm -rf -- "$workdir"' EXIT
    pids=()
    for name in "${tasks[@]}"; do
      RILL_CI_TIER="$([[ "$mode" == "full" ]] && echo L3 || echo L2)" just "_ci-$name" >"$workdir/$name.log" 2>&1 &
      pids+=("$!")
    done

    result=0
    for index in "${!pids[@]}"; do
      name="${tasks[index]}"
      if wait "${pids[index]}"; then
        printf '✔ [%s] OK\n' "$name"
      else
        mkdir -p .rill
        { printf '\n[ci %s] check failed\n' "$name"; cat "$workdir/$name.log"; } >> .rill/last-error.log
        printf '✖ [%s] FAIL (full log in .rill/last-error.log)\n' "$name" >&2
        head -n 15 "$workdir/$name.log" >&2
        result=1
      fi
    done
    if [[ "$result" -eq 0 ]]; then
      if [[ "$(git rev-parse HEAD)" != "$START_HEAD" ]]; then
        printf 'CI HEAD changed during verification: %s\n' "$START_HEAD" >&2
        exit 1
      fi
      receipt pass >/dev/null
    else
      receipt fail >/dev/null || true
    fi
    exit "$result"

ci-full:
    #!/usr/bin/env bash
    START_HEAD="$(git rev-parse HEAD)" || exit 1
    set -euo pipefail
    record() { mise exec --locked -- uv run --locked rill policy ci-receipt full "$1" "$START_HEAD"; }
    record running >/dev/null
    if just ci full; then
      record running >/dev/null
      if just _silent-run factory just factory-ci; then
        if [[ "$(git rev-parse HEAD)" != "$START_HEAD" ]]; then
          printf 'Full CI HEAD changed during verification: %s\n' "$START_HEAD" >&2
          exit 1
        fi
        record pass >/dev/null
        exit 0
      fi
    fi
    record fail >/dev/null || true
    exit 1

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

# Rill's distributed factory is a product of the same #39 CI, not a
# competing workspace-level quality framework.
factory-ci:
    mise exec --locked -- ruff check src/py/rill_cli tests/py
    mise exec --locked -- ruff format --check src/py/rill_cli tests/py
    mise exec --locked -- uv run pytest -n 0 tests/py
    mise exec --locked -- pnpm --dir apps/console run typecheck
    mise exec --locked -- pnpm --dir apps/console run test:coverage
    mise exec --locked -- pnpm --dir apps/console run build
    mise exec --locked -- node --test tests/preview.test.mjs
    mise exec --locked -- node --test tests/standard-adoption.test.mjs
    mise exec --locked -- pnpm exec playwright test -c playwright.console.config.mjs

# Standalone directory-mode executable with embedded Copier template assets.
build-cli:
    mise exec --locked uv python -- uv run pyinstaller --noconfirm --clean --specpath build --onedir --name rill --paths src/py --collect-all copier --collect-all rich --collect-all typer --collect-all textual --collect-all platformdirs --collect-all pydantic --collect-all jinja2_ansible_filters --copy-metadata rill-factory --add-data "$(pwd)/standards/template:rill_cli/template" --add-data "$(pwd)/VERSION:rill_cli" --add-data "$(pwd)/src/py/rill_cli/assets/dashboard.html:rill_cli/assets" --add-data "$(pwd)/src/py/rill_cli/assets/fleet_dashboard.html:rill_cli/assets" --add-data "$(pwd)/src/py/rill_cli/tui/app.tcss:rill_cli/tui" src/py/rill_cli/__main__.py

_check-fast:
    mise exec --locked -- ruff check src/py/rill_cli tests/py
    mise exec --locked -- uv run pytest -n 0 tests/py

check-fast:
    @just _silent-run fast just _check-fast
