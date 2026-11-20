"""Atomic, recoverable state with the repository as the trust boundary."""

import json
import os
import tempfile
from pathlib import Path
from typing import cast

from .constants import ERROR_LOG_PATH, SCHEMA_VERSION, STATE_PATH


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
            "task_scope": [],
            "budget_exhausted": False,
        }


def save(root: Path, data: dict[str, object]) -> None:
    path = root / STATE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            json.dump(data, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def record_error(root: Path, message: str) -> None:
    path = root / ERROR_LOG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(message.rstrip() + "\n", encoding="utf-8")
