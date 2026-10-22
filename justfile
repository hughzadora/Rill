# Native local task runner for Rill. No custom orchestrator or alternate runtime.
set default-list
set shell := ["sh", "-cu"]

# The only source formatter; checks are separate and non-writing.
fmt:
    pnpm exec biome check --write .

fmt-check:
    just --fmt --check
    pnpm exec biome ci .

markdown:
    pnpm run check:markdown

types:
    pnpm run typecheck

unit:
    pnpm run test

coverage:
    pnpm run test:coverage

unused:
    pnpm exec knip --no-progress

loc:
    pnpm run check:metrics

complexity:
    lizard -l typescript -C 15 -w -i 0 .

links:
    lychee --offline --no-progress --include-fragments=anchor-only README.md AGENTS.md rill-rebuild-plan.md "docs/**/*.md"

# Online remote links are flaky/subject to third-party status and are informational.
links-online:
    lychee --no-progress --max-retries 1 --timeout 10 README.md AGENTS.md rill-rebuild-plan.md "docs/**/*.md"

secrets-staged:
    gitleaks git --staged --redact=100 --no-banner .

secrets-history:
    gitleaks git --redact=100 --no-banner .

security:
    trivy fs --scanners vuln,misconfig --severity HIGH,CRITICAL --exit-code 1 --skip-version-check --include-dev-deps --skip-dirs node_modules --skip-dirs coverage .

# Offline diagnostic only; never substitutes for a fresh full gate.
security-offline:
    trivy fs --scanners vuln,misconfig --severity HIGH,CRITICAL --exit-code 1 --skip-db-update --skip-check-update --skip-version-check --include-dev-deps --skip-dirs node_modules --skip-dirs coverage .

security-db-update:
    trivy fs --download-db-only .

audit:
    pnpm run audit

report:
    pnpm run test:report

# Fast staged-only local check, preserves partially staged blobs.
precommit:
    pnpm run check:staged
    just secrets-staged

# Dev loop: deterministic tests and structural checks.
check: fmt-check markdown types unit unused loc complexity links

# Native pre-push quality gate: behavior, coverage, security, Git history.
gate: fmt-check markdown types coverage unused loc complexity links secrets-history security audit

# Installed versions; failure to find a tool is a blocker, not a silent skip.
doctor:
    node --version
    pnpm --version
    pnpm exec biome --version
    pnpm exec tsc --version
    pnpm exec vitest --version
    pnpm exec knip --version
    just --version
    gitleaks version
    lychee --version
    lizard --version
    tokei --version
    trivy --version
