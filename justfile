install:
    MISE_QUIET=1 mise install --locked node pnpm python uv just aqua:biomejs/biome aqua:oxc-project/oxc/oxlint aqua:astral-sh/ruff aqua:aquasecurity/trivy aqua:gitleaks/gitleaks cargo:tokei aqua:koalaman/shellcheck aqua:mvdan/sh aqua:bats-core/bats-core aqua:tamasfe/taplo npm:typescript npm:vitest npm:@playwright/test npm:markdownlint-cli2 pypi:mypy pypi:pytest pypi:pip-licenses pypi:lizard

lock:
    mise lock

lock-bump:
    mise lock --bump

lint:
    MISE_QUIET=1 mise exec --locked aqua:biomejs/biome -- biome check .
    MISE_QUIET=1 mise exec --locked aqua:astral-sh/ruff -- ruff check .
    MISE_QUIET=1 mise exec --locked aqua:astral-sh/ruff -- ruff format --check .
    MISE_QUIET=1 mise exec --locked aqua:tamasfe/taplo -- taplo check '**/*.toml'
    MISE_QUIET=1 mise exec --locked aqua:tamasfe/taplo -- taplo fmt --check '**/*.toml'

secret-scan:
    MISE_QUIET=1 mise exec --locked aqua:aquasecurity/trivy -- trivy fs --scanners secret --skip-dirs .mise --exit-code 1 --quiet --format table .

quality: lint secret-scan
