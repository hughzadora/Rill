"""L4 deterministic Git/CI acceptance backed by existing native tools."""

import json
from pathlib import Path
from typing import cast

from .constants import CI_SUMMARY_PATH
from .git_policy import git, revision
from .governance_engine import GovernanceEngine
from .governance_git import check_frozen


def check_pre_commit(root: Path, *, data_root: Path | None = None) -> None:
    """Reject deleted tests and post-freeze contract edits, without rewriting tests."""
    deleted = git(
        root,
        "diff",
        "--cached",
        "--no-renames",
        "--diff-filter=D",
        "--name-only",
        "-z",
        "--",
        "tests/",
    ).stdout
    if deleted:
        paths = sorted(filter(None, deleted.split("\0")))
        raise PermissionError(f"Native Git detected deleted tests: {', '.join(paths)}")
    engine = GovernanceEngine(root, data_root=data_root)
    if engine.state_path.exists():
        check_frozen(engine)


def release_gate(root: Path, *, data_root: Path | None = None) -> list[str]:
    """Require local L3 CI receipt and P0-free ledger; never authorize release."""
    blockers: list[str] = []
    try:
        check_pre_commit(root, data_root=data_root)
    except (OSError, PermissionError, ValueError) as exc:
        blockers.append(str(exc))
    engine = GovernanceEngine(root, data_root=data_root)
    blockers.extend(engine.release_blockers())
    if git(root, "status", "--porcelain", "-z", "--untracked-files=all").stdout:
        blockers.append("Release candidate has uncommitted or untracked work")
    receipt = root / CI_SUMMARY_PATH
    if not receipt.is_file():
        blockers.append("Missing L3 CI receipt")
        return blockers
    try:
        value: object = json.loads(receipt.read_text(encoding="utf-8"))
        info = cast("dict[str, object]", value) if isinstance(value, dict) else {}
        sha = revision(root)
        if (
            info.get("tier") != "full"
            or info.get("result") != "pass"
            or info.get("last_verified_sha") != sha
            or info.get("head") != sha
        ):
            blockers.append("L3 CI receipt is stale or not green for this Git HEAD")
    except OSError, ValueError, TypeError:
        blockers.append("L3 CI receipt is unreadable")
    return blockers
