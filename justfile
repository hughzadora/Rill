default:
    @just --list

lint:
    pnpm exec biome check .
    cd packages/quality && just lint

# Locked upstream tool installations; no unpinned global fallback.
workspace-install:
    MISE_QUIET=1 mise install --locked node pnpm just python uv aqua:oxc-project/oxc/oxlint aqua:astral-sh/ruff aqua:aquasecurity/trivy aqua:gitleaks/gitleaks cargo:tokei aqua:koalaman/shellcheck aqua:mvdan/sh aqua:bats-core/bats-core aqua:tamasfe/taplo npm:markdownlint-cli2 pypi:mypy pypi:pytest pypi:pip-licenses pypi:lizard pypi:copier aqua:rhysd/actionlint
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 HUSKY=0 MISE_QUIET=1 mise exec --locked pnpm -- pnpm install --frozen-lockfile
    cd packages/quality && just install

# Full hosted PR quality gate. Native user acceptance is a separate check.
workspace-ci:
    pnpm exec biome check .
    MISE_QUIET=1 mise exec --locked aqua:oxc-project/oxc/oxlint -- oxlint -D correctness --deny-warnings apps/console/src tools/preview.mjs
    MISE_QUIET=1 mise exec --locked pypi:lizard -- lizard -l typescript -l tsx -l javascript -i 0 apps/console/src tools/preview.mjs
    cd packages/quality && just full-spec-ci
    pnpm --dir apps/console run typecheck
    pnpm --dir apps/console run test:coverage
    pnpm --dir apps/console run build
    node --test tests/preview.test.mjs
    node --test tests/standard-adoption.test.mjs
    pnpm exec playwright test

preview port="8765" parent="22" bugs="23":
    pnpm --dir apps/console run build
    PORT={{quote(port)}} node tools/preview.mjs {{quote(parent)}} {{quote(bugs)}}
