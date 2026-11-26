import json
import signal
import sqlite3
import subprocess
import sys
from contextlib import closing
from pathlib import Path

import pytest


def cli(root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(Path(sys.executable).with_name("rill-tasks")), *arguments],
        cwd=root,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )


def test_actual_cli_upgrades_and_restores_a_task_list(tmp_path: Path) -> None:
    help_result = cli(tmp_path, "--help")
    assert help_result.returncode == 0 and "migrate" in help_result.stdout
    assert help_result.stderr == ""
    active = ("--db", "active #1.sqlite")
    backup = ("--db", "snapshot.sqlite")
    restored = ("--db", "restored.sqlite")
    commands = [
        ((*active, "init", "--schema", "1"), {"schema": 1}),
        (
            (*active, "add", "water", "Refill water"),
            {"id": "water", "title": "Refill water", "completed": False},
        ),
        ((*active, "backup", backup[-1]), {"schema": 1}),
        ((*active, "migrate"), {"schema": 2}),
        (
            (*active, "complete", "water"),
            {"id": "water", "title": "Refill water", "completed": True},
        ),
        ((*backup, "restore", restored[-1]), {"schema": 1}),
        (
            (*restored, "list"),
            [{"id": "water", "title": "Refill water", "completed": False}],
        ),
    ]
    for arguments, expected in commands:
        result = cli(tmp_path, *arguments)
        assert result.returncode == 0, result.stderr
        assert result.stderr == ""
        assert json.loads(result.stdout) == expected
    duplicate = cli(tmp_path, *active, "add", "water", "Replace the title")
    assert duplicate.returncode == 3 and not duplicate.stdout
    assert "different title" in duplicate.stderr
    listed = cli(tmp_path, *active, "list")
    assert json.loads(listed.stdout) == [
        {"id": "water", "title": "Refill water", "completed": True}
    ]


def test_cancelled_cli_writer_can_be_retried_without_duplicate_effect(
    tmp_path: Path,
) -> None:
    target = ("--db", "active.sqlite")
    assert cli(tmp_path, *target, "init").returncode == 0
    with closing(sqlite3.connect(tmp_path / target[-1])) as holder:
        holder.execute("BEGIN IMMEDIATE")
        with subprocess.Popen(
            [
                str(Path(sys.executable).with_name("rill-tasks")),
                *target,
                "add",
                "new",
                "New task",
            ],
            cwd=tmp_path,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as writer:
            try:
                with pytest.raises(subprocess.TimeoutExpired):
                    writer.wait(timeout=0.3)
            finally:
                if writer.poll() is None:
                    writer.send_signal(signal.SIGTERM)
                stdout, stderr = writer.communicate(timeout=10)
            assert writer.returncode == -signal.SIGTERM
            assert not stdout and not stderr
        holder.rollback()
    assert json.loads(cli(tmp_path, *target, "list").stdout) == []
    for attempt in range(2):
        result = cli(tmp_path, *target, "add", "new", "New task")
        assert result.returncode == 0, (attempt, result.stderr)
    assert json.loads(cli(tmp_path, *target, "list").stdout) == [
        {"id": "new", "title": "New task", "completed": False}
    ]


def test_cli_rejects_invalid_usage_and_redacts_database_errors(tmp_path: Path) -> None:
    target = ("--db", "active.sqlite")
    missing = cli(tmp_path, *target, "add", "new")
    assert missing.returncode == 2 and not missing.stdout
    assert "required" in missing.stderr
    assert cli(tmp_path, *target, "init").returncode == 0
    invalid = cli(tmp_path, *target, "add", "new", "x" * 161)
    assert invalid.returncode == 2 and not invalid.stdout
    assert "Title must be" in invalid.stderr
    assert json.loads(cli(tmp_path, *target, "list").stdout) == []
    (tmp_path / "private-data.sqlite").write_bytes(b"not a database")
    corrupt = cli(tmp_path, "--db", "private-data.sqlite", "list")
    assert corrupt.returncode == 1 and not corrupt.stdout
    assert "SQLITE_NOTADB" in corrupt.stderr and "private-data" not in corrupt.stderr
