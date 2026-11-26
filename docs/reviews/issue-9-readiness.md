# Issue #9 integration readiness review

- **Outcome:** NOT READY to merge or release.
- **Issue:** [hughzadora/rill#9](https://github.com/hughzadora/rill/issues/9) is open and blocks issue #6.
- **Review time:** 2026-11-27 Asia/Sanghai.
- **Publication:** None.

## Candidate identities

| Identity | Value |
| --- | --- |
| Issue worktree | `/private/var/folders/0n/b2qhdgrs2j75m7g0qgvyvzsw0000gn/T/rill-api-issue9.rgMmODADNr` |
| Branch | `rill/issue-9-typescript-api` |
| HEAD | `78fe3ba1cb168c191214400b1852d3129cc85962` |
| HEAD tree | `42132737945c99b704c4403b67f287fe7dd6fc92` |
| Worktree state | UNCOMMITTED |
| Relevant file inventory | 32 files; SHA-256 `537e6111d88fb950113822037ba288d8a12f69b0d72d70f7dd2a41c7716c4f1f` |
| Clean kit | `bf88b10f6dfba99371fbcdcb3da80f88671b8244f761312301d8a2ee30a7a440` |
| Clean kit nested TypeScript API template | `d6f786a341dfaaee72fa42bc3b6485b41e56d17c13656f72e463b653532f8939` |
| Generated OpenAPI | SHA-256 `288711bd8f17684a991f7eaad48f9b23f3539a63cdbf497a83265c36463ac46d` |
| Mutation report from isolated issue copy | SHA-256 `9986bc02fc6287791247d02fe4b27866f1c15938d11087b3cfaf913c37e610cd` |

The issue branch diverges from `integration/ai-dlc-foundation`: merge base `c7a20078154266a8dfad40af873e6b1c4e40ada2`, issue branch ahead by 3 commits, integration branch ahead by 7 commits. The issue is therefore not an integration-ready descendant of the current integration branch.

## Blocking findings

### P0: Clean kit adoption cannot verify its own OpenAPI baseline

The clean consumer extracted only from the locally built release candidate reported:

```text
OpenAPI baseline bytes do not match their recorded SHA-256
verify_rc=1
```

The kit's recorded provenance is:

```json
{
  "revision": "78fe3ba1cb168c191214400b1852d3129cc85962",
  "sha256": "288711bd8f17684a991f7eaad48f9b23f3539a63cdbf497a83265c36463ac46d"
}
```

But in the kit, `contracts/baseline-openapi.json` has SHA-256 `323b7a9d0b23a52c24d1d97a62603629970f6a92e0e69fdcd316d4b5aa7f657b`. The issue worktree's `contracts/baseline-openapi.json` does match `288711...`. The packaging result therefore does not preserve the issue's contract bytes.

The recorded revision also does not contain the baseline provenance, baseline OpenAPI, or qualification test at that path; all three `git cat-file` existence checks returned `no`.

### P0: `mise run qualify` fails

- Issue-copy isolated run: 17 passed, 2 failed; exit 1.
- Clean kit consumer run: 14 passed, 5 failed; exit 1.

Issue-copy failures:

1. `the pinned parser sees the valid Bun adapter and the real TypeScript alias`: dependency-cruiser rejects `src/schemas/quotes.ts -> node_modules/zod/index.js` because the disposable directory path does not satisfy the configured path rule.
2. `Stryker fails its threshold when superficial tests let mutants survive`: the negative fixture fails as expected, but the assertion expects `lower than break threshold 100` while the pinned output says `under breaking threshold 100`.

Clean-kit adds three contract failures caused by the baseline mismatch:

1. `the composed API task fails on a stale generated artifact and passes after regeneration`.
2. `oasdiff evaluates a generated contract with a wider request range`.
3. `oasdiff evaluates a generated contract with a narrower request range`.

The qualification suite is not accepted as a positive/negative qualification until all applicable failures are fixed or factually scoped.

### P1: `mise run verify` fails lint

The isolated issue copy and clean kit both failed `oxlint --type-aware --deny-warnings`:

```text
src/server.ts:7:51: typescript(restrict-template-expressions)
tests/tooling/contracts/profile.test.ts:42:5: typescript(no-unsafe-argument)
tests/tooling/contracts/profile.test.ts:54:5: typescript(no-unsafe-argument)
tests/tooling/contracts/profile.test.ts:57:5: typescript(no-unsafe-argument)
tests/tooling/contracts/profile.test.ts:59:42: typescript(no-unsafe-argument)
```

The failures are specific and actionable: the server logs a URL value without a safe template conversion, and the task-graph assertions use a loosely typed `depends` array against `expect.arrayContaining`.

### P1: baseline provenance is not candidate-bound enough

The issue worktree's current generated OpenAPI and checked-in baseline both match the recorded digest, and `mise run api-contract` passes in the issue copy. That is not sufficient for release evidence because:

- the provenance revision points to a commit where the named files do not exist;
- the kit's archived baseline does not match the provenance digest;
- the issue worktree is dirty, so HEAD/tree identity does not cover the reviewed files.

The candidate should be committed, then the baseline provenance should point to a revision that actually contains the reviewed baseline, with the kit rebuilt and rechecked from that candidate.

## What passed

- Locked installation: `mise lock --check`, `mise install --locked`, and `bun install --frozen-lockfile` succeeded on Darwin arm64.
- Pinned tools: mise `2026.11.14`, Bun `1.4.5`, Node `v24.22.3`.
- Architecture parser: dependency-cruiser `18.9.0`, supported TypeScript `6.0.3`; positive architecture check passes outside the disposable-path qualification fixture.
- API contract task on the issue copy: OpenAPI drift, Spectral, and oasdiff compatibility all pass; generated and baseline OpenAPI match the recorded issue digest.
- API runtime tests: 23 pass, 0 fail in the ordinary suite, including malformed, out-of-range, unexpected-field, oversized, media-type, method, route, and capacity behavior cases.
- Property evidence: seeded fast-check capacity property passes with 200 runs and explicit boundary examples.
- Mutation evidence: Stryker produced 5 non-empty mutants, all 5 killed, score 100%, no survivors/timeouts/errors; checker confirmed the report.
- Clean-kit identity: checksum sidecars verify, nested TypeScript API template checksum verifies, `RILL_VERSION=0.1.0`, and no `.git` source checkout is present in the consumer.

## Readiness

| Area | Status |
| --- | --- |
| Issue implementation structure | Promising, but uncommitted and diverged from integration |
| Runtime behavior and property tests | Evidence present; ordinary tests pass |
| OpenAPI generation/Spectral/oasdiff in issue copy | Passes |
| Architecture boundaries | Positive pass; qualification positive fixture fails in disposable copy |
| Mutation gate | Baseline evidence passes |
| `verify` | FAIL |
| `qualify` | FAIL |
| Clean kit adoption | Checksums/install pass; contract verification fails |
| Candidate-bound provenance | FAIL |
| Merge/release readiness | NOT READY |

No main-worktree source files were edited and no GitHub release was published. The local build command wrote the ignored `dist/rill-kit-0.1.0.tar.gz` artifact used for the clean-consumer check; this is an ignored artifact change, not a source edit.
