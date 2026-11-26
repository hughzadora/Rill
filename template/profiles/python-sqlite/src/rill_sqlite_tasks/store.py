import os
import re
import sqlite3
from collections.abc import Callable, Generator
from contextlib import closing, contextmanager
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Literal

from .requests import InvalidRequest, validate_title

LATEST_SCHEMA = 2
APPLICATION_ID = 0x52494C4C
SIDECARS = ("-journal", "-wal", "-shm")


class Conflict(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Task:
    id: str
    title: str
    completed: bool


def _local_path(path: Path) -> Path:
    if ".." in path.parts or not path.name:
        raise InvalidRequest("Database path must name a file without parent traversal")
    resolved = path.parent.resolve(strict=True) / path.name
    for file in (
        resolved,
        *(resolved.with_name(resolved.name + suffix) for suffix in SIDECARS),
    ):
        if file.is_symlink() or (file.exists() and not file.is_file()):
            raise InvalidRequest("Database and sidecar paths must be regular files")
    return resolved


def _publish(path: Path, prepare: Callable[[Path], None]) -> None:
    destination = _local_path(path)
    for file in (
        destination,
        *(destination.with_name(destination.name + s) for s in SIDECARS),
    ):
        if file.exists():
            raise Conflict("Destination database or sidecar already exists")
    with TemporaryDirectory(
        prefix=".rill-sqlite-", dir=destination.parent
    ) as temporary:
        staged = Path(temporary) / "database"
        prepare(staged)
        staged.chmod(0o600)
        with staged.open("rb") as database:
            os.fsync(database.fileno())
        try:
            os.link(staged, destination)
        except FileExistsError:
            raise Conflict("Destination database already exists") from None
        directory = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)


def _version(database: sqlite3.Connection) -> int:
    application_id = int(database.execute("PRAGMA application_id").fetchone()[0])
    version = int(database.execute("PRAGMA user_version").fetchone()[0])
    if application_id != APPLICATION_ID or version not in (1, LATEST_SCHEMA):
        raise InvalidRequest("Unsupported task database or schema version")
    return version


def _task_id(value: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value) is None:
        raise InvalidRequest(
            "Task ID must be 1–64 ASCII letters, digits, underscores or hyphens"
        )
    return value


def _add_completion(database: sqlite3.Connection) -> None:
    database.execute(
        "ALTER TABLE tasks ADD COLUMN completed INTEGER NOT NULL DEFAULT 0 "
        "CHECK (completed IN (0, 1))"
    )
    database.execute(f"PRAGMA user_version={LATEST_SCHEMA}")


class TaskStore:
    def __init__(
        self, path: Path, *, factory: type[sqlite3.Connection] = sqlite3.Connection
    ):
        self.path = path
        self.factory = factory

    def _connect(
        self, path: Path, mode: Literal["ro", "rw", "rwc"]
    ) -> sqlite3.Connection:
        database = sqlite3.connect(
            f"{path.as_uri()}?mode={mode}",
            uri=True,
            autocommit=True,
            factory=self.factory,
        )
        try:
            database.execute("PRAGMA trusted_schema=OFF")
            if mode != "ro":
                database.execute("PRAGMA synchronous=FULL")
        except BaseException:
            database.close()
            raise
        return database

    @contextmanager
    def _transaction(
        self, path: Path, mode: Literal["ro", "rw", "rwc"]
    ) -> Generator[sqlite3.Connection]:
        with closing(self._connect(path, mode)) as database:
            database.execute("BEGIN" if mode == "ro" else "BEGIN IMMEDIATE")
            try:
                yield database
                database.execute("COMMIT")
            finally:
                if database.in_transaction:
                    database.execute("ROLLBACK")

    def initialize(self, schema: int = LATEST_SCHEMA) -> int:
        if schema not in (1, LATEST_SCHEMA):
            raise InvalidRequest("Initial schema must be 1 or 2")

        def create(staged: Path) -> None:
            with self._transaction(staged, "rwc") as database:
                database.execute(f"PRAGMA application_id={APPLICATION_ID}")
                database.execute(
                    """CREATE TABLE tasks (
                        id TEXT PRIMARY KEY NOT NULL
                            CHECK (length(id) BETWEEN 1 AND 64
                                AND id NOT GLOB '*[^A-Za-z0-9_-]*'),
                        title TEXT NOT NULL
                            CHECK (length(title) BETWEEN 1 AND 160 AND instr(title, char(0)) = 0)
                    ) STRICT"""
                )
                database.execute("PRAGMA user_version=1")
                if schema == LATEST_SCHEMA:
                    _add_completion(database)

        _publish(self.path, create)
        return schema

    def migrate(self) -> int:
        with self._transaction(_local_path(self.path), "rw") as database:
            if _version(database) == 1:
                _add_completion(database)
        return LATEST_SCHEMA

    def tasks(self) -> list[Task]:
        with self._transaction(_local_path(self.path), "ro") as database:
            completed = "completed" if _version(database) == LATEST_SCHEMA else "0"
            rows: list[tuple[str, str, int]] = database.execute(
                f"SELECT id, title, {completed} FROM tasks ORDER BY id"
            ).fetchall()
            return [Task(key, title, bool(done)) for key, title, done in rows]

    def add(self, key: str, title: str) -> Task:
        _task_id(key)
        validate_title(title)
        with self._transaction(_local_path(self.path), "rw") as database:
            completed = "completed" if _version(database) == LATEST_SCHEMA else "0"
            database.execute(
                "INSERT INTO tasks (id, title) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
                (key, title),
            )
            stored_title, done = database.execute(
                f"SELECT title, {completed} FROM tasks WHERE id = ?", (key,)
            ).fetchone()
            if stored_title != title:
                raise Conflict("Task ID already has a different title")
            return Task(key, title, bool(done))

    def complete(self, key: str) -> Task:
        _task_id(key)
        with self._transaction(_local_path(self.path), "rw") as database:
            if _version(database) != LATEST_SCHEMA:
                raise InvalidRequest("Run migrate before completing tasks")
            row: tuple[str] | None = database.execute(
                "UPDATE tasks SET completed = 1 WHERE id = ? RETURNING title", (key,)
            ).fetchone()
            if row is None:
                raise InvalidRequest("Task ID does not exist")
            return Task(key, row[0], True)

    def copy_to(self, destination: Path) -> int:
        with self._transaction(_local_path(self.path), "ro") as source:
            schema = _version(source)

            def copy(staged: Path) -> None:
                with closing(self._connect(staged, "rwc")) as snapshot:
                    source.backup(snapshot, pages=128)
                    if _version(snapshot) != schema:
                        raise InvalidRequest(
                            "Snapshot schema does not match the source"
                        )
                    if snapshot.execute("PRAGMA integrity_check").fetchall() != [
                        ("ok",)
                    ]:
                        raise InvalidRequest(
                            "Snapshot failed the SQLite integrity check"
                        )
                    columns = (
                        "id, title, completed"
                        if schema == LATEST_SCHEMA
                        else "id, title"
                    )
                    snapshot.execute(f"SELECT {columns} FROM tasks LIMIT 0")

            _publish(destination, copy)
        return schema
