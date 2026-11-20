"""Deterministic path ownership and source symbol inventory."""

import ast
import re
import shutil
import subprocess
from pathlib import Path
from typing import cast

from .constants import FRAMEWORK_PATHS, MAX_REWRITE_LINES, MAX_SYMBOL_LINES, RUNTIME_ANCHORS
from .state import load


def within(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError as exc:
        raise PermissionError(f"Outside repository: {path}") from exc


def is_framework(relative: str) -> bool:
    return any(
        relative == item or (item.endswith("/") and relative.startswith(item))
        for item in FRAMEWORK_PATHS
    )


def validate(root: Path, path: Path, *, changed_lines: int | None = None) -> None:
    relative = within(path, root)
    if Path(relative) in RUNTIME_ANCHORS:
        raise PermissionError(f"Tier 2 runtime anchor is CLI-owned: {relative}")
    if is_framework(relative):
        raise PermissionError(f"Tier 0 requires authorized rill upgrade: {relative}")
    state = load(root)
    check_scope(relative, state.get("task_scope", []))
    if changed_lines is not None and changed_lines > MAX_REWRITE_LINES:
        raise PermissionError(f"Full-file rewrite exceeds {MAX_REWRITE_LINES} lines: {relative}")


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


def _public_python_symbols(root: Path) -> list[str]:
    names: list[str] = []
    for path in sorted(root.rglob("*.py")):
        if any(part in {".venv", ".git", "node_modules", "dist"} for part in path.parts):
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except OSError, SyntaxError, UnicodeError:
            continue
        for node in tree.body:
            if isinstance(
                node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
            ) and not node.name.startswith("_"):
                names.append(
                    f"{path.relative_to(root)}:{node.lineno} {type(node).__name__} {node.name}"
                )
    return names


def _exported_typescript_symbols(root: Path) -> list[str]:
    names: list[str] = []
    source = root / "src"
    if not source.exists():
        return names
    signature = re.compile(
        r"^export\s+(?:(?:default|declare|async)\s+)*(?:function|class|interface|type|const)\s+([\w$]+)",
        re.MULTILINE,
    )
    for path in sorted((*source.rglob("*.ts"), *source.rglob("*.tsx"))):
        if any(part in {"node_modules", "dist", "__tests__"} for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError, UnicodeError:
            continue
        for match in signature.finditer(text):
            lineno = text.count("\n", 0, match.start()) + 1
            names.append(f"{path.relative_to(root)}:{lineno} Export {match.group(1)}")
    return names


def symbols(root: Path) -> str:
    """Index public Python and TS signatures without loading entire files into prompts."""
    names = [*_public_python_symbols(root), *_exported_typescript_symbols(root)]
    selected = names[:MAX_SYMBOL_LINES]
    return "\n".join(selected) + ("\n" if selected else "")


def patch_targets(command: str) -> list[tuple[str, int]]:
    """Count changed lines and reject unsafe patch deletions and destinations."""
    targets: list[tuple[str, int]] = []
    current: str | None = None
    changed = 0
    for line in command.splitlines():
        match = re.fullmatch(r"\*\*\* (Update|Add|Delete) File: (.+)", line)
        if match:
            if current is not None:
                targets.append((current, changed))
            current = match.group(2)
            changed = MAX_REWRITE_LINES + 1 if match.group(1) == "Delete" else 0
        elif current is not None and line.startswith("*** Move to: "):
            targets.append((line.removeprefix("*** Move to: "), MAX_REWRITE_LINES + 1))
        elif current and line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
            changed += 1
    if current is not None:
        targets.append((current, changed))
    return targets
