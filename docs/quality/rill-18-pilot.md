# Rill #18 Existing-Project Pilot Evidence

Status: **executed but not accepted**, Issue #19.

## Isolation

The original development worktree (codex/native-feasibility) was never
modified. At observation, it held 17 tracked/untracked changes.
The separately created detached pilot uses commit
e71aae0d08c5ee3ed8b3ac4a7c58e6ec9275f4f3.

The original worktree retains its native Just, Husky, Biome, TypeScript,
and Vitest. The pilot was given only an untracked quality profile marker.
Its README SHA-256 remained unchanged:
a29cd839fc7e46b7a56685fb975e09bb0fe9f6843c77c06e3c820494f299bd62.

## Actual baseline

| Check                              | Result                         |
| ---------------------------------- | ------------------------------ |
| Locked dependency install          | Passed                         |
| Native lint                        | Passed: 67 Biome files         |
| Native full-spec CI                | Failed: exit 1                 |
| Native Vitest                      | 94/95 tests passed             |
| Clean committed TS/TSX inventory   | 41/41 Tokei and Lizard files   |
| Active worktree TS/TSX inventory   | 47/47 Tokei and Lizard files   |
| Full measured complexity/size gate | Failed                         |
| Bound candidate proposed audit     | Both gates executed and failed |

The committed native failure was in
tests/recovery-lifecycle.test.ts: serialized response length 5,505
violated its strict less-than-5,000 assertion. No #18 code or test
assertion was modified to hide this failure.

## Quality debt discovered

The configured file-size maximum is 500 code lines. On the committed
baseline, three files exceed that threshold:

| File                       | Code lines |
| -------------------------- | ---------: |
| tools/repair-evidence.ts   |        536 |
| tools/task-context.ts      |        634 |
| tools/delivery-evidence.ts |        554 |

The active worktree's task-context.ts increased to 646 lines.
Additional Lizard complexity/function-length warnings included
targetPlan and inventory. Neither historical source nor the configured
thresholds were silently changed.

## Profile execution and version integrity

The isolated pilot generated and explicitly applied a deterministic
version 0.1.0 profile plan. Its state was profiled-unverified, with
readiness false. The external audit called the real project-native
full-spec command (exit 1 in 14,684 ms) and a separate versioned
Tokei/Lizard command (exit 1 in 453 ms). The CLI recorded revision,
working-tree fingerprint, commands, outputs' SHA-256, durations, and
exit codes.

A later candidate manifest covers 19 release implementation and
configuration files with per-file SHA-256 hashes. As designed, the
older pilot marker was rejected as binding-invalid. It was not
silently upgraded or overwritten. A new detached pilot was bound to
the integrity-verified manifest with readback success and readiness false.
After installing #18's native locked dependencies, the two proposed
audit gates again failed: native full-spec exit 1 in 15,629 ms and
profile metrics exit 1 in 455 ms. Source provenance, signatures,
trusted distribution, and real on-project PR CI wiring are still
unverified.

## Acceptance boundary

This pilot proves the existence and real operation of the two local
checks on actual #18 source. It does not prove that #18 has passing
full-spec CI, that legacy debt has been authorised, or that the gates
automatically run in #18's hosted PR workflow. Do not merge or close
Issue #19 on the basis of this pilot alone.
