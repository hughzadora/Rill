default:
    @just --list

lint:
    pnpm exec biome check .

typecheck:
    pnpm exec tsc --noEmit

check: lint typecheck

test:
    rm -f .cache/ci/vitest.json
    pnpm test
    node tools/check-test-report.ts .cache/ci/vitest.json

full-spec-ci:
    node tools/ci-evidence.ts full-spec

[parallel]
_full-spec-checks: lint typecheck test

gate: full-spec-ci

task-sync issue_url:
    node tools/task-context.ts sync {{quote(issue_url)}}

task-record record_file:
    node tools/task-context.ts record {{quote(record_file)}}

task-publish:
    node tools/task-context.ts publish

recover-task thread_id:
    node tools/recover-task.ts {{quote(thread_id)}}

ci-evidence-verify receipt:
    node tools/ci-evidence.ts verify {{quote(receipt)}}

# Materialize a self-contained local plugin source; native Codex handles install/trust.
stage-plugin destination:
    #!/usr/bin/env sh
    set -eu
    target={{quote(destination)}}
    if [ -e "$target" ]; then
        echo 'Choose a new staging directory; existing content is preserved.' >&2
        exit 1
    fi
    mkdir -p "$target/.codex-plugin"
    cp -R tools schemas skills hooks "$target/"
    cp package.json pnpm-lock.yaml .mcp.json "$target/"
    cp .codex-plugin/plugin.json "$target/.codex-plugin/"
    store_dir=$(pnpm store path)
    pnpm --dir "$target" install --prod --offline --frozen-lockfile --ignore-scripts --node-linker=hoisted --store-dir "$store_dir" --package-import-method=copy

[positional-arguments]
repair-check problem_key hypothesis +command:
    node tools/repair-evidence.ts check "$@"

[positional-arguments]
repair-diagnose problem_key +command:
    node tools/repair-evidence.ts diagnose "$@"

[positional-arguments]
repair-interpret problem_key evidence_id explanation:
    node tools/repair-evidence.ts interpret "$@"

repair-status:
    node tools/repair-evidence.ts status

project-enroll repository:
    node tools/project-enrollment.ts enroll {{quote(repository)}}

project-leave:
    node tools/project-enrollment.ts leave

install-personal-policy:
    node tools/install-personal-policy.ts

[positional-arguments]
decision-source stage thread_id item_id subject quote:
    node tools/decision-evidence.ts "$@"

ci-full-spec-verify receipt:
    node tools/ci-evidence.ts verify-full-spec {{quote(receipt)}}

delivery-status:
    node tools/delivery-evidence.ts status

delivery-question:
    node tools/delivery-evidence.ts question

delivery-audit bundle:
    node tools/delivery-evidence.ts audit {{quote(bundle)}}

[positional-arguments]
delivery-retract receipt_id criterion_ids reason:
    node tools/delivery-evidence.ts retract "$@"

# The repository hosts one native plugin and an independently testable quality package.
workspace-install:
    MISE_QUIET=1 mise install --locked node pnpm just python uv aqua:oxc-project/oxc/oxlint aqua:astral-sh/ruff aqua:aquasecurity/trivy aqua:gitleaks/gitleaks cargo:tokei aqua:koalaman/shellcheck aqua:mvdan/sh aqua:bats-core/bats-core aqua:tamasfe/taplo npm:markdownlint-cli2 pypi:mypy pypi:pytest pypi:pip-licenses pypi:lizard
    HUSKY=0 MISE_QUIET=1 mise exec --locked pnpm -- pnpm install --frozen-lockfile
    cd packages/quality && just install

workspace-ci: full-spec-ci
    cd packages/quality && just full-spec-ci
