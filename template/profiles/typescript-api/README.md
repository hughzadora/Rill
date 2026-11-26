# Rill TypeScript API profile

This runnable reference API quotes whether a party fits the supplied capacity. It accepts integer `requested` from 1 to 100 and integer `available` from 0 to 100, and returns `{"accepted":true}` or `{"accepted":false}`. An exact fit is accepted. The quote makes no booking or state change.

## Locked setup

Extract the checksum-verified `typescript-api` template from the selected Rill kit into the root of an independent project. Use Git and mise 2026.11.14 on Apple Silicon macOS. Review the project configuration before trusting it.

```sh
mise trust
mise install --locked
mise lock --check
mise exec -- bun install --frozen-lockfile
mise exec -- bun run architecture:info
mise run verify
mise run qualify
```

The supplied lock covers macOS arm64. Acquiring dependencies uses the upstream registries and the verification scan needs live OSV access. Record and qualify any new platform or tool version before accepting it. Run `mise run scan-history` from your committed consumer Git repository to scan its available history.

## Run the API

```sh
mise run dev
```

In another terminal, request an exact fit and then a bad quote:

```sh
curl --include http://127.0.0.1:3000/v1/reservation-quotes \
  --header 'Content-Type: application/json' \
  --data '{"requested":4,"available":4}'
curl --include http://127.0.0.1:3000/v1/reservation-quotes \
  --header 'Content-Type: application/json' \
  --data '{"requested":0,"available":4}'
```

The first request returns HTTP 200 with `{"accepted":true}`. The second returns HTTP 400 with `{"error":"invalid-request"}`. The application accepts JSON bodies up to 1,024 bytes. Oversized bodies return 413, non-JSON media types return 415, unknown routes return 404, and unsupported methods on the quote route return 405 with `Allow: POST`. The service listens only on loopback. Set `PORT=4200 mise run dev` to change the default port. Invalid port configuration fails before listening, without printing the supplied value.

## Contract and compatibility

[Runtime schemas](src/schemas/quotes.ts) own the request and response shapes. The [generator](scripts/generate-openapi.ts) derives [OpenAPI](openapi.json) from them. The verify task checks byte-for-byte drift, runs Spectral with `spectral:oas`, and compares the result with the generated initial [baseline](contracts/baseline-openapi.json). [Baseline provenance](contracts/baseline.json) identifies the original Git revision and artifact digest. An independent consumer needs only the baseline and provenance files included in the template.

Generate the candidate deliberately and review the resulting Git diff, including untracked outputs:

```sh
mise exec -- bun run openapi:generate > openapi.json
git status --short --untracked-files=all
git diff -- openapi.json
mise run api-contract
```

For a subsequent consumer release, generate the baseline from the chosen accepted consumer revision. In a separate checkout of that revision, run the locked setup and `mise exec -- bun run openapi:generate > /absolute/path/to/accepted-openapi.json`. In the candidate checkout, run `mise exec -- oasdiff breaking --fail-on WARN /absolute/path/to/accepted-openapi.json openapi.json`. Record the accepted base revision and baseline SHA-256 when updating the checked-in comparison inputs. Review the base selection, any compatibility warning, and any intentional break with the owner. The gate fails on warnings and errors.

## Qualification

`mise run verify` runs the real HTTP tests, the seeded capacity property, task and discovery assertions, format, type and lint checks, the dependency graph, contract checks, unused-code checks, spelling, local links, secrets, and dependency advisories.

`mise run qualify` also runs Stryker on the capacity decision and exercises controlled failures in disposable copies. It requires an actual non-empty Stryker report with only killed mutants. Stryker uses only the isolated behavior test command. Retain `reports/mutation/mutation.json` and review mutations and any behavior failures against the exact candidate. The pinned TypeScript parser serves only dependency-cruiser. tsrs remains the authoritative checker. TypeScript 7.0 is outside dependency-cruiser 18.9.0's reported parser support, so the profile uses the compatible stable TypeScript 6.0.3 API.

The two Stryker tooling overrides pin patched `minimatch` and `qs` versions selected after OSV flagged the upstream resolutions. Re-evaluate them when Stryker or its transitive dependencies are upgraded. Keep any replacement lock replay paired with the full mutation and qualification checks.

This example covers a stateless localhost HTTP contract. Storage, identities, authorization, upstream providers, production network exposure, and hosted CI require separate product scope and validation. The graph covers statically analyzable imports with the configured TypeScript resolver. The property and mutation results apply to the capacity decision only. OpenAPI comparison checks the declared contract; the real HTTP suite supplies runtime evidence.
