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

[parallel]
full-spec-ci: lint typecheck test

gate: full-spec-ci

task-sync issue_url:
    node tools/task-context.ts sync {{quote(issue_url)}}

task-record record_file:
    node tools/task-context.ts record {{quote(record_file)}}

task-publish:
    node tools/task-context.ts publish
