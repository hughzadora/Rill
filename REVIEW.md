# Rill Review Red Lines

1. Review the exact staged/candidate diff, after verified `just ci-full` success.
2. Any changed root `.codex/`, configuration or workflow asset must also update
   the corresponding canonical `standards/template/` asset when distributable.
3. `src/py/rill_cli/template/` must resolve to `standards/template/` in the
   source tree. Release builds embed those assets unchanged into
   `rill_cli/template/`. Never maintain a second hand-edited template.
4. A regular PR must never start a macOS runner or trigger Tag-only releases.
   PR Quality uses one Ubuntu job, skips Drafts and runs `just ci` only.
5. Do not bypass type checks, source/security scans or full local quality gates.
6. Never delete, skip, weaken or replace existing tests to manufacture a pass;
   verify regressions and new behavior against actual source and outcomes.
7. Look first for races, unsafe parallel writes, path escapes, confused Git
   ownership, secrets, untrusted inputs and unsafe restore/delete operations.
8. Reviewer is read-only. Findings require reproducible evidence at `path:line`;
   remove false positives before handing findings to the coordinator.
9. Only one reviewer at a time, and no more than two total review/fix rounds.
   If round two is still blocked, stop and hand the evidence to the owner.
10. A passing review never authorizes a protected Git merge, deployment,
    release, paid resource or data-destructive operation.
