import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from rill_sqlite_tasks.requests import InvalidRequest
from rill_sqlite_tasks.store import Conflict, Task, TaskStore


def test_add_returns_durable_task_and_uses_id_as_retry_key(tmp_path: Path) -> None:
    path = tmp_path / "work list #1.sqlite"
    sentinel = tmp_path / "keep.txt"
    sentinel.write_text("unrelated")
    store = TaskStore(path)
    assert store.initialize() == 2
    assert path.stat().st_mode & 0o777 == 0o600
    expected = Task("pump", "Reset the pump", False)
    assert store.add("pump", "Reset the pump") == expected
    assert TaskStore(path).tasks() == [expected]
    assert TaskStore(path).add("pump", "Reset the pump") == expected
    with pytest.raises(Conflict, match="different title"):
        store.add("pump", "Cancel the appointment")
    with pytest.raises(InvalidRequest, match="Task ID"):
        store.add("../escape", "Cannot be written")
    assert TaskStore(path).tasks() == [expected]
    assert sentinel.read_text() == "unrelated"


def test_v1_upgrade_preserves_contents_and_restores_pre_upgrade_state(
    tmp_path: Path,
) -> None:
    path = tmp_path / "tasks.sqlite"
    snapshot = tmp_path / "snapshot.sqlite"
    restored = tmp_path / "restored.sqlite"
    store = TaskStore(path)
    assert store.initialize(1) == 1
    assert store.add("first", "Inspect valve") == Task("first", "Inspect valve", False)
    assert store.add("second", "Send a reminder") == Task(
        "second", "Send a reminder", False
    )
    assert store.copy_to(snapshot) == 1
    original = snapshot.read_bytes()
    assert store.migrate() == 2
    assert store.migrate() == 2
    assert store.complete("first") == Task("first", "Inspect valve", True)
    assert store.complete("first") == Task("first", "Inspect valve", True)
    assert TaskStore(path).tasks() == [
        Task("first", "Inspect valve", True),
        Task("second", "Send a reminder", False),
    ]
    with closing(sqlite3.connect(path)) as database:
        assert database.execute("PRAGMA user_version").fetchone() == (2,)
        assert database.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
        with pytest.raises(sqlite3.IntegrityError):
            database.execute("UPDATE tasks SET completed = 2 WHERE id = 'second'")
    assert TaskStore(snapshot).copy_to(restored) == 1
    assert TaskStore(restored).tasks() == [
        Task("first", "Inspect valve", False),
        Task("second", "Send a reminder", False),
    ]
    assert snapshot.read_bytes() == original
    with pytest.raises(Conflict, match="already exists"):
        TaskStore(snapshot).copy_to(path)
    assert TaskStore(path).tasks()[0].completed
