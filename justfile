default:
    @just --list

check:
    pnpm check

test:
    pnpm test

gate: check test

task-sync issue_url:
    node tools/task-context.ts sync {{quote(issue_url)}}

task-record record_file:
    node tools/task-context.ts record {{quote(record_file)}}

task-publish:
    node tools/task-context.ts publish
