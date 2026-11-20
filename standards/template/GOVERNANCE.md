# Rill governance acceptance contract

## Delivery order

Freeze L1 interface contracts before L3 core logic. Verify L3 failures and
recovery before L2 presentation. Connect L4 native Git, tests, type checks
and security gates before full-stack acceptance. Every phase requires a green
checked Commit. Do not restructure earlier verified modules as side effects.

## Repair budgets

| Severity | Attempts | Exhaustion | Release |
| --- | ---: | --- | --- |
| P0 | 3 | BLOCKED | Zero P0 allowed |
| P1 | 2 | Proven quarantine or BLOCKED | Record debt |
| P2 | 1 | Nonblocking DEFERRED or BLOCKED | Hard gates pass |
| P3 | 1 | Nonblocking DEFERRED | No polish loop |

Every attempt consumes its budget before editing. Model changes, sessions and
branch switches never reset counts. Keep exact Git revision evidence and
original failing tests. Never delete tests, weaken assertions, bypass CI,
invent green results, auto-purchase credits or reduce quality thresholds.

## Native execution and recovery

Start each repair in a clean, task-owned Git worktree pinned to the latest
green Commit. On failure, capture a bounded failure excerpt, safely remove
**only** that task worktree and verify the original worktree is preserved.
Never reset or clean unrelated work. If recovery cannot be proven, block
further attempts. Frozen L1 contracts require a separate, explicit L1 change
transaction before editing.

## Completion

N1: P2 loop blocked; N2: L1 tamper blocked; N3: dirty task worktree restored;
N4: fourth P0 attempt refused; N5: traceable P1 quarantine;
N6: test weakening and fake pass rejected; N7: HEAD drift rejected;
N8: failed recovery blocks. Independent review is limited to two review/fix
rounds. Report BLOCKED instead of claiming success when a required gate fails.
