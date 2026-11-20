"""Deterministic path ownership and source symbol inventory."""

import ast
import re
import shutil
import subprocess
from pathlib import Path
from typing import cast

from .state import load

MAX_REWRITE_LINES = 60

FRAMEWORK = ("justfile", "mise.toml", "mise.lock", ".codex/", ".github/workflows/")
RUNTIME = (".rill/state.json", ".rill/symbols.txt", ".rill/last-error.log")


def within(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError as exc:
        raise PermissionError(f"Outside repository: {path}") from exc


def is_framework(relative: str) -> bool:
    return any(
        relative == item or (item.endswith("/") and relative.startswith(item)) for item in FRAMEWORK
    )


def validate(root: Path, path: Path, *, changed_lines: int | None = None) -> None:
    relative = within(path, root)
    state = load(root)
    if relative in RUNTIME:
        return
    if is_framework(relative) and state["mode"] != "upgrade":
        raise PermissionError(f"Tier 0 requires upgrade mode: {relative}")
    check_scope(relative, state.get("task_scope", []))
    if changed_lines is not None and changed_lines > MAX_REWRITE_LINES:
        raise PermissionError(f"Full-file rewrite exceeds 60 lines: {relative}")


def check_scope(relative: str, scope: object) -> None:
    if not isinstance(scope, list):
        raise PermissionError("Invalid task_scope configuration")
    items = cast("list[object]", scope)
    if not all(isinstance(entry, str) for entry in items):
        raise PermissionError("Invalid task_scope configuration")
    selected = cast("list[str]", items)
    if selected and not any(
        relative == entry or relative.startswith(entry.rstrip("/") + "/") for entry in selected
    ):
        raise PermissionError(f"Outside task_scope: {relative}")


def tracked_changes(root: Path) -> list[str]:
    result = subprocess.run(  # noqa: S603 - trusted git binary; explicit argv
        [
            shutil.which("git") or "/usr/bin/git",
            "-C",
            str(root),
            "status",
            "--porcelain",
            "--untracked-files=all",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line[3:].split(" -> ")[-1] for line in result.stdout.splitlines()]


def audit(root: Path) -> list[str]:
    violations: list[str] = []
    for relative in tracked_changes(root):
        try:
            validate(root, root / relative)
        except PermissionError as exc:
            violations.append(str(exc))
    return violations


def symbols(root: Path) -> str:
    names: list[str] = []
    for path in sorted(root.rglob("*.py")):
        if any(part in {".venv", ".git", "node_modules", "dist"} for part in path.parts):
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except OSError, SyntaxError, UnicodeError:
            continue
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                names.append(
                    f"{path.relative_to(root)}:{node.lineno} {type(node).__name__} {node.name}"
                )
    return "\n".join(names) + ("\n" if names else "")


def patch_targets(command: str) -> list[tuple[str, int]]:
    """Enumerate affected apply_patch files and added/replaced line counts."""
    targets: list[tuple[str, int]] = []
    current: str | None = None
    changed = 0
    for line in command.splitlines():
        match = re.fullmatch(r"\*\*\* (?:Update|Add|Delete) File: (.+)", line)
        if match:
            if current is not None:
                targets.append((current, changed))
            current = match.group(1)
            changed = 0
        elif current and line.startswith("+") and not line.startswith("+++"):
            changed += 1
    if current is not None:
        targets.append((current, changed))
    return targets
