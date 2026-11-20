"""Codex hook event handlers: minimal stdout, explicit denial on pre-write."""

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import cast

from .constants import SYMBOLS_PATH
from .guardrails import audit, patch_targets, symbols, validate
from .state import load, record_error


def _payload() -> dict[str, object]:
    try:
        data: object = json.load(sys.stdin) if not sys.stdin.isatty() else {}
    except ValueError, OSError:
        return {}
    return cast("dict[str, object]", data) if isinstance(data, dict) else {}


def run(event: str, root: Path) -> int:
    payload = _payload()
    if event == "session-start":
        state = load(root)
        summary = {key: state.get(key) for key in ("mode", "task_scope", "budget_exhausted")}
        print(json.dumps({"state": summary, "repository": str(root)}))
        return 0
    if event == "pre-compact":
        output = root / SYMBOLS_PATH
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(symbols(root), encoding="utf-8")
        return 0
    if event == "stop":
        if load(root).get("budget_exhausted"):
            record_error(root, "Quota exhausted: continuation stopped")
        print("{}")
        return 0
    if event in {"pre-tool-use", "post-tool-use"}:
        return _check_tool(event, root, payload)
    raise ValueError(f"Unknown hook event: {event}")


def _deny(root: Path, event: str, exc: PermissionError) -> int:
    record_error(root, str(exc))
    if event == "pre-tool-use":
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": str(exc),
                    }
                }
            )
        )
        return 0
    print(str(exc), file=sys.stderr)
    return 2


def _targets(payload: dict[str, object]) -> tuple[object, list[tuple[str, int]]]:
    raw_input = payload.get("tool_input")
    tool_input = cast("dict[str, object]", raw_input) if isinstance(raw_input, dict) else {}
    path = tool_input.get("file_path")
    command = tool_input.get("command")
    targets = [(path, 0)] if isinstance(path, str) else []
    if isinstance(command, str):
        targets.extend(patch_targets(command))
    return path, targets


def _enforce(event: str, root: Path, targets: list[tuple[str, int]]) -> None:
    if event == "pre-tool-use" and load(root).get("budget_exhausted") is True:
        raise PermissionError("Token budget exhausted")
    if event == "pre-tool-use" and not targets:
        raise PermissionError("Cannot verify write target")
    for relative, added in targets:
        validate(root, root / relative, changed_lines=added)
    violations = audit(root) if event == "post-tool-use" else []
    if violations:
        raise PermissionError("; ".join(violations))


def _format(path: Path) -> None:
    if path.suffix == ".py" and path.is_file():
        subprocess.run(  # noqa: S603 - trusted formatter, argv only
            [shutil.which("ruff") or "/usr/bin/ruff", "format", "--quiet", str(path)],
            check=False,
            capture_output=True,
        )


def _check_tool(event: str, root: Path, payload: dict[str, object]) -> int:
    path, targets = _targets(payload)
    try:
        _enforce(event, root, targets)
    except PermissionError as exc:
        return _deny(root, event, exc)
    if event == "post-tool-use" and isinstance(path, str):
        _format(root / path)
    return 0
