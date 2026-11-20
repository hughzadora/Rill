"""L4 deterministic Git/CI acceptance backed by existing native tools."""

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import cast

import yaml

from .constants import (
    CI_SUMMARY_PATH,
    COPIER_ANSWERS,
    FLEET_COMMAND_TIMEOUT_SECONDS,
    GOVERNANCE_ROOT_QUALITY_WORKFLOW,
    GOVERNANCE_TEMPLATE_QUALITY_WORKFLOW,
)
from .git_policy import git, revision
from .governance_engine import GovernanceEngine
from .governance_git import check_frozen


def _profile_test_roots(contents: str) -> set[str]:
    """Project-approved test directories, retaining upstream Copier's layout choices."""
    raw: object = yaml.safe_load(contents)
    if not isinstance(raw, dict):
        raise ValueError("Invalid Rill Copier answers")
    answers = cast("dict[str, object]", raw)
    roots: set[str] = set()
    for enabled, keys in (
        ("python", ("python_root", "python_tests")),
        ("shell", ("shell_tests",)),
    ):
        if answers.get(enabled) is not True:
            continue
        parts: list[str] = []
        for key in keys:
            value = answers.get(key)
            if not isinstance(value, str):
                raise ValueError(f"Missing configured test directory: {enabled}")
            parts.append(value)
        relative = Path(*parts)
        if relative.is_absolute() or ".." in relative.parts:
            raise PermissionError("Unsafe configured test directory")
        roots.add(relative.as_posix().rstrip("/") + "/")
    return roots


def _test_roots(root: Path, baseline: str | None = None) -> tuple[str, ...]:
    """Union the current and original Git-tracked layout, preventing profile drift."""
    roots = {"tests/"}
    config = root / COPIER_ANSWERS
    if config.is_file():
        if config.is_symlink():
            raise PermissionError("Symlinked Copier answers are not trusted")
        roots.update(_profile_test_roots(config.read_text(encoding="utf-8")))
    if baseline:
        old = git(root, "show", f"{baseline}:{COPIER_ANSWERS.as_posix()}", check=False)
        if old.returncode == 0:
            roots.update(_profile_test_roots(old.stdout))
    return tuple(sorted(roots))


def committed_test_deletions(root: Path, baseline: str) -> bool:
    """Review native history across all known test roots, regardless of CI."""
    ancestors = git(root, "merge-base", "--is-ancestor", baseline, "HEAD", check=False)
    if ancestors.returncode:
        raise PermissionError("Governance baseline is not an ancestor of HEAD")
    history = git(
        root,
        "log",
        "--format=",
        "-m",
        "--no-renames",
        "--diff-filter=D",
        "--name-only",
        "-z",
        f"{baseline}..HEAD",
        "--",
        *_test_roots(root, baseline),
    ).stdout
    return bool(history.strip("\0\n"))


def check_ci_committed_test_deletions(root: Path) -> None:
    """CI must inspect committed diffs, not only an empty checkout index."""
    if os.environ.get("CI") != "true":
        return
    workspace = os.environ.get("GITHUB_WORKSPACE")
    if workspace and root.resolve() != Path(workspace).resolve():
        return  # Hosted CI baseline must not escape into independent temp repositories.
    baseline = os.environ.get("RILL_CI_BASE_SHA", "")
    if re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", baseline) is None:
        raise PermissionError("CI has no trustworthy native event base SHA")
    if committed_test_deletions(root, baseline):
        raise PermissionError("Committed test deletions violate CI baseline")


def check_pre_commit(root: Path, *, data_root: Path | None = None) -> None:
    """Reject deleted tests and post-freeze contract edits, without rewriting tests."""
    check_ci_committed_test_deletions(root)
    deleted = git(
        root,
        "diff",
        "--cached",
        "--no-renames",
        "--diff-filter=D",
        "--name-only",
        "-z",
        "--",
        *_test_roots(root, revision(root)),
    ).stdout
    if deleted:
        paths = sorted(filter(None, deleted.split("\0")))
        raise PermissionError(f"Native Git detected deleted tests: {', '.join(paths)}")
    engine = GovernanceEngine(root, data_root=data_root)
    if engine.state_path.exists() and engine.load().frozen is not None:
        check_frozen(engine)


def _remote_quality_observed(root: Path, head: str) -> bool:
    """Require a real GitHub Actions success on the exact SHA; local JSON is untrusted."""
    binary = shutil.which("gh")
    if binary is None or git(root, "remote", "get-url", "origin", check=False).returncode:
        return False
    workflow = (
        GOVERNANCE_ROOT_QUALITY_WORKFLOW
        if (root / GOVERNANCE_ROOT_QUALITY_WORKFLOW).is_file()
        else GOVERNANCE_TEMPLATE_QUALITY_WORKFLOW
    )
    result = subprocess.run(  # noqa: S603 - native authenticated gh CLI, no shell
        [
            binary,
            "run",
            "list",
            "--commit",
            head,
            "--workflow",
            workflow.name,
            "--json",
            "headSha,status,conclusion,event",
            "--limit",
            "20",
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
        timeout=FLEET_COMMAND_TIMEOUT_SECONDS,
    )
    raw: object = json.loads(result.stdout)
    if not isinstance(raw, list):
        raise ValueError("Unexpected native GitHub Actions response")
    for item in cast("list[object]", raw):
        if isinstance(item, dict):
            row = cast("dict[str, object]", item)
            if (
                row.get("headSha") == head
                and row.get("status") == "completed"
                and row.get("conclusion") == "success"
                and row.get("event") in {"push", "pull_request"}
            ):
                return True
    return False


def _candidate_blockers(root: Path, engine: GovernanceEngine) -> list[str]:
    blockers = engine.release_blockers()
    frozen = engine.load().frozen
    if frozen is not None:
        try:
            if committed_test_deletions(root, frozen.revision):
                blockers.append("Committed test deletions violate frozen L1 baseline")
        except (OSError, ValueError, PermissionError, subprocess.SubprocessError) as exc:
            blockers.append(str(exc))
    if git(root, "status", "--porcelain", "-z", "--untracked-files=all").stdout:
        blockers.append("Release candidate has uncommitted or untracked work")
    return blockers


def _receipt_blockers(root: Path) -> list[str]:
    receipt = root / CI_SUMMARY_PATH
    if not receipt.is_file():
        return ["Missing L3 CI receipt"]
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
            return ["L3 CI receipt is stale or not green for this Git HEAD"]
    except OSError, ValueError, TypeError:
        return ["L3 CI receipt is unreadable"]
    return []


def release_gate(root: Path, *, data_root: Path | None = None) -> list[str]:
    """Require exact-sha native CI proof; local receipts alone never authorize."""
    blockers: list[str] = []
    try:
        check_pre_commit(root, data_root=data_root)
    except (OSError, PermissionError, ValueError) as exc:
        blockers.append(str(exc))
    engine = GovernanceEngine(root, data_root=data_root)
    blockers.extend(_candidate_blockers(root, engine))
    blockers.extend(_receipt_blockers(root))
    if blockers:
        return blockers
    try:
        if not _remote_quality_observed(root, revision(root)):
            blockers.append("No independently observed successful GitHub Quality run on this SHA")
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        blockers.append(f"GitHub Quality evidence unavailable: {type(exc).__name__}")
    return blockers
