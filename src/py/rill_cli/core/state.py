"""Atomic, recoverable state with the repository as the trust boundary."""

import json
import os
import shutil
import subprocess
import tempfile
from collections.abc import Generator
from contextlib import contextmanager
from fcntl import LOCK_EX, LOCK_UN, flock
from pathlib import Path
from typing import cast

from .constants import DEFAULT_SCOPE, ERROR_LOG_PATH, SCHEMA_VERSION, STATE_PATH


def _lock_path(root: Path) -> Path:
    result = subprocess.run(  # noqa: S603 - trusted native Git, fixed argument vector
        [
            shutil.which("git") or "git",
            "-C",
            str(root),
            "rev-parse",
            "--git-path",
            "rill-state.lock",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    path = Path(result.stdout.strip())
    return path if path.is_absolute() else root / path


@contextmanager
def lock_state(root: Path) -> Generator[None]:
    """Serialize state read-modify-write operations across CLI, hooks and upgrades."""
    path = _lock_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as stream:
        flock(stream.fileno(), LOCK_EX)
        try:
            yield
        finally:
            flock(stream.fileno(), LOCK_UN)


def load(root: Path) -> dict[str, object]:
    path = root / STATE_PATH
    try:
        data = cast("object", json.loads(path.read_text(encoding="utf-8")))
        if not isinstance(data, dict):
            raise ValueError("State must be an object")
        typed = cast("dict[str, object]", data)
        if typed.get("schema") != SCHEMA_VERSION:
            raise ValueError("Unknown state schema")
        return typed
    except OSError, ValueError, TypeError:
        return {
            "schema": SCHEMA_VERSION,
            "mode": "normal",
            "task_scope": list(DEFAULT_SCOPE),
            "phase": "ready",
            "task_goal": "",
            "consecutive_failures": 0,
            "budget_exhausted": False,
        }


def write_json(root: Path, relative: Path, data: dict[str, object]) -> None:
    """Atomically replace a private runtime JSON anchor."""
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            json.dump(data, stream, sort_keys=True, separators=(",", ":"))
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def save(root: Path, data: dict[str, object]) -> None:
    write_json(root, STATE_PATH, data)


def record_error(root: Path, message: str) -> None:
    path = root / ERROR_LOG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(message.rstrip() + "\n", encoding="utf-8")
