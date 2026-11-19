install:
    MISE_QUIET=1 mise install --locked node pnpm python uv just aqua:biomejs/biome aqua:oxc-project/oxc/oxlint aqua:astral-sh/ruff aqua:aquasecurity/trivy aqua:gitleaks/gitleaks cargo:tokei aqua:koalaman/shellcheck aqua:mvdan/sh aqua:bats-core/bats-core aqua:tamasfe/taplo npm:typescript npm:vitest npm:@playwright/test npm:markdownlint-cli2 pypi:mypy pypi:pytest pypi:pip-licenses pypi:lizard
    HUSKY=0 MISE_QUIET=1 mise exec --locked pnpm -- pnpm install --frozen-lockfile
    HUSKY=0 MISE_QUIET=1 mise exec --locked pnpm -- pnpm --dir quality-fixtures/web install --frozen-lockfile
    MISE_QUIET=1 mise exec --locked uv -- uv sync --python "$(mise which python)" --project quality-fixtures/python --locked

lock:
    mise lock

lock-bump:
    mise lock --bump

lint:
    MISE_QUIET=1 mise exec --locked aqua:biomejs/biome -- biome check .
    MISE_QUIET=1 mise exec --locked aqua:oxc-project/oxc/oxlint -- oxlint .
    MISE_QUIET=1 mise exec --locked npm:markdownlint-cli2 -- markdownlint-cli2 '**/*.md'
    MISE_QUIET=1 mise exec --locked aqua:astral-sh/ruff -- ruff check .
    MISE_QUIET=1 mise exec --locked aqua:astral-sh/ruff -- ruff format --check .
    MISE_QUIET=1 mise exec --locked aqua:tamasfe/taplo -- taplo check '**/*.toml'
    MISE_QUIET=1 mise exec --locked aqua:tamasfe/taplo -- taplo fmt --check '**/*.toml'
    MISE_QUIET=1 mise exec --locked aqua:koalaman/shellcheck -- shellcheck --severity=style quality-fixtures/shell/check-env.sh
    MISE_QUIET=1 mise exec --locked aqua:mvdan/sh -- shfmt -d -i 2 quality-fixtures/shell/check-env.sh

typecheck:
    MISE_QUIET=1 mise exec --locked pnpm -- pnpm --dir quality-fixtures/web run typecheck
    MISE_QUIET=1 mise exec --locked pypi:mypy -- mypy --strict quality-fixtures/python/quality_sample.py

test:
    MISE_QUIET=1 mise exec --locked pnpm -- pnpm test
    MISE_QUIET=1 mise exec --locked pnpm -- pnpm --dir quality-fixtures/web run test
    MISE_QUIET=1 mise exec --locked pypi:pytest -- pytest -q quality-fixtures/python

build:
    MISE_QUIET=1 mise exec --locked pnpm -- pnpm --dir quality-fixtures/web run build
    test -s quality-fixtures/web/dist/index.html

secret-scan:
    MISE_QUIET=1 mise exec --locked aqua:aquasecurity/trivy -- trivy fs --scanners secret --skip-dirs .mise --skip-dirs node_modules --skip-dirs quality-fixtures/web/node_modules --skip-dirs quality-fixtures/python/.venv --skip-dirs dist --exit-code 1 --quiet --format table .

audit:
    MISE_QUIET=1 mise exec --locked pnpm -- pnpm --dir quality-fixtures/web audit --prod
    MISE_QUIET=1 mise exec --locked aqua:aquasecurity/trivy -- trivy fs --scanners vuln,misconfig,license --include-dev-deps --license-full --ignored-licenses MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC,MPL-2.0,0BSD,Unicode-DFS-2016,BlueOak-1.0.0 --skip-dirs .mise --skip-dirs node_modules --skip-dirs quality-fixtures/web/node_modules --skip-dirs quality-fixtures/python/.venv --skip-dirs dist --exit-code 1 --quiet --format table .
    MISE_QUIET=1 mise exec --locked pypi:pip-licenses -- pip-licenses --python quality-fixtures/python/.venv/bin/python --allow-only "MIT;MIT License;Apache Software License;BSD License;BSD-3-Clause;Mozilla Public License 2.0 (MPL 2.0)"

sbom:
    MISE_QUIET=1 mise exec --locked aqua:aquasecurity/trivy -- trivy fs --format cyclonedx --output quality-fixtures/web/dist/rill-quality-profile.cdx.json --skip-dirs .mise --skip-dirs dist quality-fixtures/web

history-secrets:
    MISE_QUIET=1 mise exec --locked aqua:gitleaks/gitleaks -- gitleaks git --redact --exit-code 1

metrics: (project-metrics "." "quality-self")

quality: lint secret-scan

full-spec-ci: lint typecheck test build metrics secret-scan audit sbom history-secrets

# Audit real TypeScript repositories, preserving the target worktree.
project-metrics root profile="rill-typescript":
    MISE_QUIET=1 mise exec --locked cargo:tokei pypi:lizard pnpm -- pnpm exec tsx tools/quality-metrics.ts --root {{quote(root)}} --profile {{quote(profile)}}
