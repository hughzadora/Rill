import os
import sqlite3
import stat
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

import pytest

from rill_sqlite_tasks.requests import InvalidRequest
from rill_sqlite_tasks.store import Conflict, Task, TaskStore


class InterruptedWrite(RuntimeError):
    pass


@pytest.mark.parametrize(
    ("operation", "write_sql"),
    [
        ("initialize", "CREATE TABLE"),
        ("add", "INSERT INTO"),
        ("complete", "UPDATE tasks"),
        ("migrate", "ALTER TABLE"),
    ],
)
@pytest.mark.parametrize("phase", ["before", "during", "after"])
def test_interrupted_transaction_recovers_via_normal_operation(
    tmp_path: Path, operation: str, write_sql: str, phase: str
) -> None:
    path = tmp_path / "working.sqlite"
    other = tmp_path / "separate.sqlite"
    unrelated = Task("private", "Unrelated", False)
    TaskStore(other).initialize()
    TaskStore(other).add(unrelated.id, unrelated.title)
    preserved = Task("first", "Keep this", False)
    added = Task("second", "Add this", False)
    store = TaskStore(path)
    if operation != "initialize":
        store.initialize(1 if operation == "migrate" else 2)
        store.add(preserved.id, preserved.title)

    class InjectedConnection(sqlite3.Connection):
        def execute(self, sql: str, parameters: tuple = (), /) -> sqlite3.Cursor:
            if phase == "before" and sql == "BEGIN IMMEDIATE":
                raise InterruptedWrite(phase)
            result = super().execute(sql, parameters)
            if (phase == "during" and sql.startswith(write_sql)) or (
                phase == "after" and sql == "COMMIT"
            ):
                raise InterruptedWrite(phase)
            return result

    def apply(target: TaskStore) -> None:
        if operation == "initialize":
            target.initialize()
        elif operation == "add":
            target.add(added.id, added.title)
        elif operation == "complete":
            target.complete(preserved.id)
        else:
            target.migrate()

    with pytest.raises(InterruptedWrite, match=phase):
        apply(TaskStore(path, factory=InjectedConnection))
    if operation == "initialize":
        assert not path.exists()
    else:
        expected = [preserved]
        if phase == "after" and operation == "add":
            expected.append(added)
        if phase == "after" and operation == "complete":
            expected = [Task(preserved.id, preserved.title, True)]
        assert TaskStore(path).tasks() == expected
        with closing(sqlite3.connect(path)) as database:
            schema = 1 if operation == "migrate" and phase != "after" else 2
            assert database.execute("PRAGMA user_version").fetchone() == (schema,)
            columns = [
                column[1] for column in database.execute("PRAGMA table_info(tasks)")
            ]
            assert columns == (
                ["id", "title"] if schema == 1 else ["id", "title", "completed"]
            )
            assert database.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
    apply(TaskStore(path))
    if operation == "add":
        assert TaskStore(path).tasks() == [preserved, added]
    assert TaskStore(other).tasks() == [unrelated]
    assert sorted(file.name for file in tmp_path.iterdir()) == [
        "separate.sqlite",
        "working.sqlite",
    ]


@pytest.mark.parametrize("operation", ["backup", "restore"])
@pytest.mark.parametrize("phase", ["before", "during", "after"])
def test_interrupted_copy_never_publishes_partial_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, operation: str, phase: str
) -> None:
    active = tmp_path / "active.sqlite"
    backup = tmp_path / "backup.sqlite"
    source, destination = (
        (active, backup) if operation == "backup" else (backup, tmp_path / "new.sqlite")
    )
    expected = Task("first", "Preserved", False)
    TaskStore(active).initialize()
    TaskStore(active).add(expected.id, expected.title)
    if operation == "restore":
        TaskStore(active).copy_to(source)
    source_bytes = source.read_bytes()
    original_fsync = os.fsync

    class InjectedConnection(sqlite3.Connection):
        def backup(self, target: sqlite3.Connection, **options: object) -> None:
            if phase == "before":
                raise InterruptedWrite(phase)

            def progress(status: int, remaining: int, total: int) -> None:
                raise InterruptedWrite(phase)

            if phase == "during":
                super().backup(target, pages=1, progress=progress)
            else:
                super().backup(target)

    def after_sync(descriptor: int) -> None:
        original_fsync(descriptor)
        if stat.S_ISDIR(os.fstat(descriptor).st_mode):
            raise InterruptedWrite(phase)

    with monkeypatch.context() as patch:
        if phase == "after":
            patch.setattr(os, "fsync", after_sync)
        with pytest.raises(InterruptedWrite, match=phase):
            TaskStore(source, factory=InjectedConnection).copy_to(destination)
    if phase == "after":
        assert TaskStore(destination).tasks() == [expected]
        with pytest.raises(Conflict, match="already exists"):
            TaskStore(source).copy_to(destination)
    else:
        assert not destination.exists()
        assert TaskStore(source).copy_to(destination) == 2
    assert source.read_bytes() == source_bytes
    assert TaskStore(destination).tasks() == [expected]
    assert not list(tmp_path.glob(".rill-sqlite-*"))


def test_concurrent_writers_and_initializers_serialize_safely(tmp_path: Path) -> None:
    path = tmp_path / "shared.sqlite"

    def initialize() -> str:
        try:
            TaskStore(path).initialize()
        except Conflict:
            return "conflict"
        return "created"

    def add_title(title: str) -> str:
        try:
            return TaskStore(path).add("same-key", title).title
        except Conflict:
            return "conflict"

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert sorted(
            future.result() for future in [pool.submit(initialize) for _ in range(2)]
        ) == [
            "conflict",
            "created",
        ]
        titles = list(
            pool.map(
                add_title, ["Open valve", "Open valve", "Close valve", "Close valve"]
            )
        )
    winner = TaskStore(path).tasks()[0].title
    assert sorted(titles) == sorted([winner, winner, "conflict", "conflict"])
    assert TaskStore(path).tasks() == [Task("same-key", winner, False)]


def test_unsafe_or_invalid_inputs_leave_existing_data_intact(tmp_path: Path) -> None:
    actual = tmp_path / "actual.sqlite"
    original = TaskStore(actual)
    original.initialize()
    original.add("only", "Keep me")
    before = actual.read_bytes()
    link = tmp_path / "alias.sqlite"
    link.symlink_to(actual)
    with pytest.raises(InvalidRequest, match="regular files"):
        TaskStore(link).migrate()
    with pytest.raises(InvalidRequest, match="parent traversal"):
        TaskStore(tmp_path / ".." / actual.name).initialize()
    occupied = tmp_path / "occupied.sqlite"
    journal = tmp_path / f"{occupied.name}-journal"
    journal.write_bytes(b"unrelated")
    with pytest.raises(Conflict, match="sidecar"):
        original.copy_to(occupied)
    foreign = tmp_path / "foreign.sqlite"
    with closing(sqlite3.connect(foreign)) as database:
        database.execute("CREATE TABLE unrelated (name TEXT)")
    foreign_bytes = foreign.read_bytes()
    with pytest.raises(InvalidRequest, match="Unsupported"):
        TaskStore(foreign).copy_to(tmp_path / "must-not-exist.sqlite")
    with pytest.raises(InvalidRequest, match="does not exist"):
        original.complete("missing")
    assert not occupied.exists()
    assert journal.read_bytes() == b"unrelated"
    assert not (tmp_path / "must-not-exist.sqlite").exists()
    assert foreign.read_bytes() == foreign_bytes
    assert actual.read_bytes() == before
