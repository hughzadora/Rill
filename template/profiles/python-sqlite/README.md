# Python and SQLite

This Rill consumer includes a local task-list CLI. It demonstrates schema changes, atomic updates, native snapshots and restore, and safe retries. Keep the checks when replacing the fixture. Revise their behavior oracles and suite inventory to match the adopted product.

## Run locally

Use the extracted `rill-python-sqlite` template in its own Git repository. Review and trust its `mise.toml`, then install the pinned tools and Python dependencies:

```sh
mise trust
mise install --locked
mise lock --check
mise exec -- uv sync --locked
mise run dev
```

The profile uses the mise-selected Python on `PATH`; automatic Python downloads by uv are disabled. mise also pins Node for Pyright. uv owns the Python packages and their exact resolved versions.

Run a migration and recovery rehearsal in a disposable directory or with fresh path names:

```sh
mise exec -- uv run --locked --no-sync rill-tasks --db tasks.sqlite init --schema 1
mise exec -- uv run --locked --no-sync rill-tasks --db tasks.sqlite add pump "Reset the pump"
mise exec -- uv run --locked --no-sync rill-tasks --db tasks.sqlite backup before.sqlite
mise exec -- uv run --locked --no-sync rill-tasks --db tasks.sqlite migrate
mise exec -- uv run --locked --no-sync rill-tasks --db tasks.sqlite complete pump
mise exec -- uv run --locked --no-sync rill-tasks --db before.sqlite restore recovered.sqlite
mise exec -- uv run --locked --no-sync rill-tasks --db recovered.sqlite list
```

The recovered list contains `pump` with `completed: false`. Listing `tasks.sqlite` shows `completed: true`. Ordinary `init` starts on schema 2. The included schema 1 compatibility baseline supports `add` and `list`. The `1 → 2` migration adds a constrained completion field and updates SQLite's schema version in the same transaction. `complete` requires schema 2. Upgrade and completed-task retries are idempotent. Reusing an `add` key returns the saved task when the title matches, including its current completion state. A different title for that key returns a conflict.

## Recover from failure

- Store the database, journals, and snapshots in directories you control on a local filesystem with transaction locking and hard-link support. The CLI uses explicit paths with an existing parent directory. It rejects parent traversal, linked leaf files and linked SQLite sidecars. Keep the directory free of concurrent external file renames and modifications.
- Snapshot and restore use SQLite's online backup API. Destinations are fresh files published after integrity validation and never replace existing files. Treat a backup as private data. The CLI creates new database files with mode `0600`.
- If a write is interrupted or acknowledgement is lost, reopen the database with `list`. If needed, repeat the same `add` key and title, `complete` key, or `migrate`. After an interrupted `init`, `backup`, or `restore`, verify any published target before using it. An existing destination yields a conflict. With no published target, retry the same operation. After a forced process kill, a `.rill-sqlite-*` staging directory can remain. Remove it only after confirming the writer has stopped.
- To recover a pre-migration version, restore a known snapshot into a fresh path, list and check the restored state, then explicitly switch the caller to that path. Keep the old database for investigation.
- The CLI writes one JSON value to standard output on success. Exit code `2` identifies invalid input or database identity, `3` identifies a conflict, and `1` identifies SQLite or filesystem failure. A caught interrupt exits `130`. OS termination follows the platform's signal status. Errors go to standard error without the raw database error text.

## Check and qualify

| Command                 | Evidence                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| `mise run check-fast`   | Ruff format/lint, standalone Oxfmt for the README, and strict Pyright.      |
| `mise run test`         | CLI, transaction, migration, snapshot and Hypothesis model tests.           |
| `mise run verify`       | Fast checks, behavior inventory, Gitleaks, OSV, spelling and offline links. |
| `mise run qualify`      | Positive and injected-fault runs using disposable copies of the consumer.   |
| `mise run mutation`     | Fresh mutmut run of title validation against its behavior-only suite.       |
| `mise run scan-history` | Redacted Gitleaks scan over available Git history.                          |
| `mise run build`        | Locked native Python wheel and source distribution in `dist/`.              |

`verify` and `qualify` use the live OSV service. Network failure or an empty dependency scan fails the gate. Qualification checks native diagnostics, test inventory/skips, a validation bypass, a broken transaction rollback and surviving mutants in a weakened suite. The behavior model checks reopened state against independent task records across generated add, complete and snapshot sequences. pytest reports are written to `reports/`; mutmut results and counts are in `reports/mutation/`.

The mutation runner needs a fork-capable environment. Its scope is explicitly title validation. Transaction and recovery faults are injected at the real SQLite connection and filesystem boundaries by the test suite.
