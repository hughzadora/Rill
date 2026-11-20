"""Codex hook event handlers: minimal stdout, explicit denial on pre-write."""

import json
import shutil
import subprocess
import sys
from pathlib import Path
from select import select
from typing import cast

from .constants import FAILURE_LIMIT, SYMBOLS_PATH
from .dashboard import render as render_dashboard
from .git_policy import branch, check_dirty, head_summary, protect_branch
from .guardrails import audit, patch_targets, symbols, validate
from .state import load, record_error, save


def _payload() -> dict[str, object]:
    """Do not block an interactive or idle pipe awaiting hook input."""
    if sys.stdin.isatty():
        return {}
    try:
        ready, _, _ = select([sys.stdin], [], [], 0)
        if not ready:
            return {}
        data: object = json.load(sys.stdin)
    except ValueError, OSError:
        return {}
    return cast("dict[str, object]", data) if isinstance(data, dict) else {}


def run(event: str, root: Path) -> int:
    payload = _payload()
    if event == "session-start":
        state = load(root)
        try:
            protect_branch(root)
            notice = None
        except PermissionError as exc:
            notice = str(exc)
        summary = {key: state.get(key) for key in ("mode", "phase", "task_goal")}
        print(
            json.dumps(
                {
                    "state": summary,
                    "branch": branch(root),
                    "head": head_summary(root),
                    "notice": notice,
                }
            )
        )
        return 0
    if event == "pre-compact":
        output = root / SYMBOLS_PATH
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(symbols(root), encoding="utf-8")
        state = load(root)
        state["last_compact_head"] = head_summary(root)
        save(root, state)
        render_dashboard(root)
        return 0
    if event == "stop":
        state = load(root)
        exhausted = state.get("budget_exhausted") is True
        failed = state.get("consecutive_failures", 0)
        if exhausted or (isinstance(failed, int) and failed >= FAILURE_LIMIT):
            record_error(root, "[QUOTA GUARD] Continuation stopped")
            render_dashboard(root)
            print("[QUOTA GUARD] Stop after repeated failures", file=sys.stderr)
            return 1
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
    return 1


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
    if event == "pre-tool-use":
        protect_branch(root)
        check_dirty(root)
        if load(root).get("budget_exhausted") is True:
            raise PermissionError("Token budget exhausted")
    if event == "pre-tool-use" and not targets:
        raise PermissionError("Cannot verify write target")
    for relative, added in targets:
        validate(root, root / relative, changed_lines=added)
    if event == "post-tool-use":
        check_dirty(root)
    violations = audit(root) if event == "post-tool-use" else []
    if violations:
        raise PermissionError("; ".join(violations))


def _format(path: Path) -> None:
    if not path.is_file():
        return
    commands = {
        ".py": ("ruff", ("check", "--fix", "--quiet"), ("format", "--quiet")),
        ".ts": (
            "biome",
            ("check", "--write", "--no-errors-on-unmatched"),
        ),
        ".tsx": (
            "biome",
            ("check", "--write", "--no-errors-on-unmatched"),
        ),
        ".js": (
            "biome",
            ("check", "--write", "--no-errors-on-unmatched"),
        ),
        ".sh": (
            "shfmt",
            ("-w", "-i", "2", "-ci"),
        ),
    }
    candidate = commands.get(path.suffix)
    if candidate is None:
        return
    executable = shutil.which(candidate[0])
    if executable is None:
        return
    for args in candidate[1:]:
        subprocess.run(  # noqa: S603 - resolved formatter executable; no shell
            [executable, *args, str(path)],
            check=False,
            capture_output=True,
        )


def _check_tool(event: str, root: Path, payload: dict[str, object]) -> int:
    _path, targets = _targets(payload)
    try:
        _enforce(event, root, targets)
    except PermissionError as exc:
        return _deny(root, event, exc)
    if event == "post-tool-use":
        for relative, _changed in targets:
            _format(root / relative)
    return 0
