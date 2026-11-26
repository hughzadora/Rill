import argparse
import json
import sqlite3
import sys
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from .requests import InvalidRequest
from .store import LATEST_SCHEMA, Conflict, TaskStore


def main(arguments: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Keep a durable local task list.")
    parser.add_argument(
        "--db", required=True, type=Path, help="path to a local SQLite database"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    initialize = commands.add_parser("init", help="create a new database")
    initialize.add_argument(
        "--schema", choices=(1, LATEST_SCHEMA), type=int, default=LATEST_SCHEMA
    )
    commands.add_parser("migrate", help="upgrade to the current schema in place")
    commands.add_parser("list", help="list all tasks")
    add = commands.add_parser(
        "add", help="add a task using a caller-supplied retry key"
    )
    add.add_argument("key")
    add.add_argument("title")
    complete = commands.add_parser("complete", help="mark a task complete")
    complete.add_argument("key")
    for command in ("backup", "restore"):
        copy = commands.add_parser(command, help=f"{command} to a fresh SQLite file")
        copy.add_argument("destination", type=Path)
    options = parser.parse_args(arguments)
    store = TaskStore(options.db)

    try:
        match options.command:
            case "init":
                result = {"schema": store.initialize(options.schema)}
            case "migrate":
                result = {"schema": store.migrate()}
            case "list":
                result = [asdict(task) for task in store.tasks()]
            case "add":
                result = asdict(store.add(options.key, options.title))
            case "complete":
                result = asdict(store.complete(options.key))
            case _:
                result = {"schema": store.copy_to(options.destination)}
        print(json.dumps(result, ensure_ascii=True))
    except Conflict as error:
        print(error, file=sys.stderr)
        return 3
    except InvalidRequest as error:
        print(error, file=sys.stderr)
        return 2
    except (OSError, sqlite3.Error) as error:
        code = getattr(error, "sqlite_errorname", type(error).__name__)
        print(
            f"Database operation failed ({code}); inspect the target state before retrying.",
            file=sys.stderr,
        )
        return 1
    except KeyboardInterrupt:
        print("Interrupted; inspect the target state before retrying.", file=sys.stderr)
        return 130
    return 0
