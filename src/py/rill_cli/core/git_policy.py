"""Branch, staging and atomically scoped commit invariants for product work."""

import os
import shutil
import subprocess
from pathlib import Path

from .constants import (
    BACKEND_PATH_PREFIXES,
    BRANCH_PREFIXES,
    DISABLED_GIT_HOOKS,
    FALLBACK_GIT_AUTHOR,
    FALLBACK_GIT_EMAIL,
    FRONTEND_PATH_PREFIXES,
    GIT_HISTORY_COLUMNS,
    INIT_BRANCH,
    MAX_COMMIT_CHURN,
    MAX_COMMIT_FILES,
    MAX_DIRTY_FILES,
    PROTECTED_BRANCHES,
)


def git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603 - trusted native Git, fixed argument vector
        [shutil.which("git") or "git", "-c", "core.quotePath=false", "-C", str(root), *args],
        check=check,
        capture_output=True,
        text=True,
    )


def branch(root: Path) -> str:
    result = git(root, "symbolic-ref", "--quiet", "--short", "HEAD", check=False)
    return result.stdout.strip() if result.returncode == 0 else "(detached)"


def revision(root: Path) -> str:
    """Full commit SHA, not a display abbreviation, for verification records."""
    return git(root, "rev-parse", "--verify", "HEAD").stdout.strip()


def head_summary(root: Path) -> str:
    result = git(root, "rev-parse", "--short", "HEAD", check=False)
    return result.stdout.strip() if result.returncode == 0 else "(unborn)"


def history(root: Path) -> list[dict[str, str]]:
    result = git(root, "log", "-8", "--pretty=format:%h%x1f%s%x1f%cI", check=False)
    if result.returncode:
        return []
    rows = [entry.split("\x1f", maxsplit=2) for entry in result.stdout.splitlines()]
    return [
        {"short": row[0], "subject": row[1], "when": row[2]}
        for row in rows
        if len(row) == GIT_HISTORY_COLUMNS
    ]


def changed_paths(root: Path, *, staged: bool = False) -> list[str]:
    args = (
        ("diff", "--cached", "--no-renames", "--name-only", "-z")
        if staged
        else (
            "status",
            "--porcelain",
            "--no-renames",
            "-z",
            "--untracked-files=all",
        )
    )
    result = git(root, *args)
    chunks = result.stdout.split("\0")
    if staged:
        return [name for name in chunks if name]
    return [entry[3:] for entry in chunks if entry]


def is_business(path: str) -> bool:
    return path.startswith(
        ("src/", *FRONTEND_PATH_PREFIXES, *BACKEND_PATH_PREFIXES)
    ) and not path.startswith(("src/ts/__tests__/", "src/py/tests/"))


def business_changes(root: Path) -> list[str]:
    return [name for name in changed_paths(root) if is_business(name)]


def protect_branch(root: Path) -> None:
    current = branch(root)
    if current in PROTECTED_BRANCHES or current == "(detached)":
        raise PermissionError(f"Direct development on {current} is forbidden")
    if not current.startswith(BRANCH_PREFIXES):
        raise PermissionError(f"Unsupported development branch: {current}")


def ensure_branch(root: Path, *, upgrade: bool = False, version: str = "") -> None:
    if branch(root) not in PROTECTED_BRANCHES:
        protect_branch(root)
        return
    name = f"upgrade/rill-v{version}" if upgrade else INIT_BRANCH
    if (
        git(root, "show-ref", "--verify", "--quiet", f"refs/heads/{name}", check=False).returncode
        == 0
    ):
        raise ValueError(f"Refusing to reuse an existing upgrade/init branch: {name}")
    git(root, "switch", "-c", name)


def _staged_churn(root: Path, business: list[str]) -> int:
    result = git(root, "diff", "--cached", "--no-renames", "--numstat", "-z")
    churn = 0
    for row in result.stdout.split("\0"):
        if not row:
            continue
        add, deleted, name = row.split("\t", maxsplit=2)
        if name in business and add.isdigit() and deleted.isdigit():
            churn += int(add) + int(deleted)
    return churn


def check_staged(root: Path, *, trusted_detached: bool = False) -> None:
    if not (trusted_detached and branch(root) == "(detached)"):
        protect_branch(root)
    business = [name for name in changed_paths(root, staged=True) if is_business(name)]
    if len(business) > MAX_COMMIT_FILES:
        raise PermissionError(f"Atomic commit exceeds {MAX_COMMIT_FILES} business files")
    back = any(name.startswith(BACKEND_PATH_PREFIXES) for name in business)
    front = any(name.startswith(FRONTEND_PATH_PREFIXES) for name in business)
    if back and front:
        raise PermissionError("Backend and frontend must use separate commits")
    if _staged_churn(root, business) > MAX_COMMIT_CHURN:
        raise PermissionError(f"Atomic business change exceeds {MAX_COMMIT_CHURN} lines")


def check_dirty(root: Path) -> None:
    if len(business_changes(root)) > MAX_DIRTY_FILES:
        raise PermissionError(
            f"[ATOMIC GATE BLOCKED] More than {MAX_DIRTY_FILES} uncommitted business files"
        )


def commit(root: Path, message: str, paths: list[str], *, trusted_detached: bool = False) -> bool:
    if not paths:
        return False
    git(root, "add", "--", *sorted(set(paths)))
    if git(root, "diff", "--cached", "--quiet", check=False).returncode == 0:
        return False
    check_staged(root, trusted_detached=trusted_detached)
    configured = all(
        git(root, "config", f"user.{field}", check=False).stdout.strip()
        for field in ("name", "email")
    )
    explicit_env = bool(os.getenv("GIT_AUTHOR_NAME") and os.getenv("GIT_AUTHOR_EMAIL"))
    identity = (
        ()
        if configured or explicit_env
        else (
            "-c",
            f"user.name={FALLBACK_GIT_AUTHOR}",
            "-c",
            f"user.email={FALLBACK_GIT_EMAIL}",
        )
    )
    git(root, "-c", f"core.hooksPath={DISABLED_GIT_HOOKS}", *identity, "commit", "-m", message)
    return True
