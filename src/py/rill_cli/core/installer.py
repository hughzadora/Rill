"""Copier-owned installation; never replace a dirty consumer checkout."""

import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import cast

import copier
import yaml

from rill_cli import __version__
from rill_cli.assets import template as embedded_template

from .constants import (
    AGENT_ENTRY,
    CODEX_CONFIG,
    CODEX_HOOKS,
    COPIER_ANSWERS,
    DEFAULT_SCOPE,
    DELIVER_SKILL,
    INIT_BRANCH,
    INIT_COMMIT,
    JUSTFILE,
    MANAGED_DIRECTORIES,
    PROTECTED_BRANCHES,
    REVIEW_FILE,
    RUNTIME_ANCHORS,
    SCHEMA_VERSION,
    STATE_PATH,
    TEMPLATE_SCHEMA,
    UPGRADE_COMMIT,
)
from .git_policy import branch, commit, ensure_branch, git, revision
from .state import load, lock_state, save


def source() -> Path:
    return embedded_template()


def preflight(path: Path) -> Path:
    root = path.expanduser().resolve()
    if root.exists() and not root.is_dir():
        raise ValueError("Target is not a directory")
    if not root.exists():
        root.mkdir(parents=True)
    result = subprocess.run(  # noqa: S603 - trusted Git binary, no shell
        [
            shutil.which("git") or "/usr/bin/git",
            "-c",
            "core.quotePath=false",
            "-C",
            str(root),
            "rev-parse",
            "--show-toplevel",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        if Path(result.stdout.strip()).resolve() != root:
            raise ValueError("Target must be a Git repository root")
        changes = subprocess.run(  # noqa: S603 - trusted Git binary, no shell
            [
                shutil.which("git") or "/usr/bin/git",
                "-c",
                "core.quotePath=false",
                "-C",
                str(root),
                "status",
                "--porcelain",
                "--untracked-files=all",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        if changes.stdout.strip():
            raise ValueError("Dirty target: commit or preserve existing work before installation")
    elif any(root.iterdir()):
        raise ValueError("Non-empty target must be a Git repository")
    else:
        subprocess.run(  # noqa: S603 - trusted Git binary; argv only
            [shutil.which("git") or "/usr/bin/git", "init", "-b", INIT_BRANCH, str(root)],
            check=True,
            capture_output=True,
            text=True,
        )
    return root


def ownership(root: Path) -> dict[str, bool]:
    return {
        "preserve_justfile": (root / JUSTFILE).exists(),
        "preserve_agent_entry": (root / AGENT_ENTRY).exists(),
        "preserve_codex_roles": (root / CODEX_CONFIG).exists(),
        "preserve_hook_config": (root / CODEX_HOOKS).exists(),
        "preserve_rill_skills": (root / DELIVER_SKILL).exists(),
    }


def fingerprint(root: Path) -> dict[str, str]:
    """Snapshot only Rill-managed files, excluding mutable runtime anchors."""
    files: dict[str, str] = {}
    for directory in MANAGED_DIRECTORIES:
        parent = root / directory
        if not parent.exists():
            continue
        for path in parent.rglob("*"):
            if not path.is_file() or path.is_symlink():
                continue
            relative = path.relative_to(root).as_posix()
            if Path(relative) in RUNTIME_ANCHORS:
                continue
            files[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    for name in (AGENT_ENTRY, JUSTFILE, REVIEW_FILE):
        path = root / name
        if path.is_file():
            files[name.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def _answers(path: Path) -> dict[str, object]:
    loaded: object = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError("Invalid Copier answers file")
    values = cast("dict[str, object]", loaded)
    return {key: value for key, value in values.items() if not key.startswith("_")}


def upgrade_values(
    root: Path, state: dict[str, object], before: dict[str, str]
) -> tuple[dict[str, object], dict[str, object]]:
    answers = root / COPIER_ANSWERS
    previous = state.get("managed")
    if not isinstance(previous, dict) or not previous:
        raise ValueError("Missing prior managed-file hashes; upgrade requires recovery")
    tracked = cast("dict[str, object]", previous)
    for relative, digest in tracked.items():
        if before.get(relative) != digest:
            raise ValueError(f"Managed file changed or removed: {relative}")
    values = _answers(answers)
    return tracked, values


def select_data(pairs: list[str]) -> dict[str, str]:
    """Validate names against the one canonical Copier question schema."""
    config: object = yaml.safe_load((source() / TEMPLATE_SCHEMA).read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValueError("Invalid template schema")
    questions = cast("dict[str, object]", config)
    allowed = {name for name in questions if not name.startswith("_")}
    chosen: dict[str, str] = {}
    for pair in pairs:
        name, separator, value = pair.partition("=")
        if not separator or name not in allowed or name.startswith("preserve_"):
            raise ValueError(f"Unknown or reserved Copier option: {name}")
        if name in chosen:
            raise ValueError(f"Duplicate Copier option: {name}")
        chosen[name] = value
    return chosen


def _profile_data(
    root: Path,
    upgrade: bool,
    supplied: dict[str, str],
    state: dict[str, object],
    before: dict[str, str],
) -> tuple[dict[str, object], dict[str, object]]:
    if upgrade:
        return upgrade_values(root, state, before)
    values: dict[str, object] = {**ownership(root), **supplied}
    return {}, values


def _project_scope(root: Path) -> list[str]:
    """Use the validated Copier profile's real package layout, not one fixed src root."""
    values = _answers(root / COPIER_ANSWERS)
    workspace = str(values.get("js_workspace", "."))
    locations = [
        ("react", workspace, "react_root"),
        ("node", workspace, "node_root"),
        ("python", ".", "python_root"),
        ("shell", ".", "shell_sources"),
    ]
    paths: set[str] = set(DEFAULT_SCOPE)
    for enabled, base, key in locations:
        if values.get(enabled) is not True:
            continue
        relative = Path(base) / str(values.get(key, "."))
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError(f"Unsafe Copier task root: {relative}")
        if relative.parts:
            paths.add(relative.as_posix().rstrip("/") + "/")
    return sorted(paths)


def _undo_uncommitted_init(root: Path, before: dict[str, str], after: dict[str, str]) -> None:
    """Only undo unchanged files created by this failed initialization."""
    added = sorted(set(after) - set(before))
    if not added:
        return
    git(root, "reset", "-q", "--", *added, check=False)
    for relative in added:
        path = root / relative
        if path.is_symlink() or not path.is_file():
            continue
        if hashlib.sha256(path.read_bytes()).hexdigest() == after[relative]:
            path.unlink()


def _finalize(
    root: Path,
    state: dict[str, object],
    before: dict[str, str],
    tracked: dict[str, object],
    upgrade: bool,
) -> None:
    after = fingerprint(root)
    owned = (set(tracked) | (set(after) - set(before))) if upgrade else set(after) - set(before)
    state.update(
        {
            "schema": SCHEMA_VERSION,
            "version": __version__,
            "mode": "normal",
            "phase": "ready",
            "managed": {name: digest for name, digest in after.items() if name in owned},
        }
    )
    if not upgrade:
        state["task_scope"] = _project_scope(root)
    else:
        state.setdefault("task_scope", list(DEFAULT_SCOPE))
    changed = [name for name in owned if before.get(name) != after.get(name)]
    try:
        commit(
            root,
            UPGRADE_COMMIT if upgrade else INIT_COMMIT,
            changed,
            trusted_detached=upgrade,
        )
    except subprocess.CalledProcessError:
        if not upgrade:
            _undo_uncommitted_init(root, before, after)
        raise
    save(root, state)


def _upgrade_in_worktree(
    root: Path,
    state: dict[str, object],
    profile: tuple[dict[str, object], dict[str, object]],
    before: dict[str, str],
    baseline: tuple[str, str],
) -> Path:
    """Native Git worktree isolates Copier, signing and commit failures."""
    tracked, values = profile
    start_head, start_branch = baseline
    if (
        revision(root) != start_head
        or branch(root) != start_branch
        or git(root, "status", "--porcelain", "-z", "--untracked-files=all").stdout
    ):
        raise RuntimeError("Project changed while preparing upgrade")
    with tempfile.TemporaryDirectory(prefix="rill-upgrade-") as directory:
        scratch = Path(directory) / "checkout"
        git(root, "worktree", "add", "--detach", str(scratch), start_head)
        try:
            state_path = root / STATE_PATH
            if state_path.is_file():
                output = scratch / STATE_PATH
                output.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(state_path, output)
            state["rollback_head"] = start_head
            copier.run_copy(
                src_path=str(source()),
                dst_path=scratch,
                defaults=True,
                data=values,
                overwrite=True,
                unsafe=False,
                quiet=True,
            )
            _finalize(scratch, state, before, tracked, True)
            candidate = revision(scratch)
            _apply_upgraded_commit(root, candidate, start_head, start_branch, state)
        finally:
            git(root, "worktree", "remove", "--force", str(scratch))
    return root


def _drop_created_branch(
    root: Path,
    created: bool,
    start_head: str,
    start_branch: str,
    selected: str,
) -> None:
    """Never switch or delete a branch that this upgrade did not create."""
    if created and revision(root) == start_head and branch(root) == selected:
        git(root, "switch", start_branch)
        git(root, "branch", "-d", selected)


def _apply_upgraded_commit(
    root: Path,
    candidate: str,
    start_head: str,
    start_branch: str,
    state: dict[str, object],
) -> None:
    """Merge only into the original branch; clean up only our own branch."""
    if (
        revision(root) != start_head
        or branch(root) != start_branch
        or git(root, "status", "--porcelain", "-z", "--untracked-files=all").stdout
    ):
        raise RuntimeError("Project changed while rendering upgrade; no files overwritten")
    created = start_branch in PROTECTED_BRANCHES
    ensure_branch(root, upgrade=True, version=__version__)
    selected = branch(root)
    try:
        if revision(root) != start_head or branch(root) != selected:
            raise RuntimeError("Project branch changed before applying upgrade")
        git(root, "merge", "--ff-only", "--no-overwrite-ignore", candidate)
        try:
            save(root, state)
        except OSError:
            if revision(root) == candidate and branch(root) == selected:
                git(root, "reset", "--keep", start_head)
            raise
    except Exception:
        _drop_created_branch(root, created, start_head, start_branch, selected)
        raise


def _prepare_target(path: Path, upgrade: bool, supplied: dict[str, str]) -> Path:
    if upgrade and supplied:
        raise ValueError("Upgrade uses recorded profile; no implicit scope changes")
    target = path.expanduser().resolve()
    if upgrade and not (target / COPIER_ANSWERS).is_file():
        raise ValueError("Cannot upgrade a project not installed by Rill")
    root = preflight(path)
    if not upgrade and (root / COPIER_ANSWERS).exists():
        raise ValueError("Already installed: use rill upgrade")
    return root


def _upgrade_from_root(root: Path, baseline: tuple[str, str]) -> Path:
    """Render and apply an upgrade while holding the runtime state lock."""
    before = fingerprint(root)
    state = load(root)
    tracked, values = _profile_data(root, True, {}, state, before)
    return _upgrade_in_worktree(root, state, (tracked, values), before, baseline)


def install(path: Path, *, upgrade: bool = False, data: list[str] | None = None) -> Path:
    supplied = select_data(data or [])
    root = _prepare_target(path, upgrade, supplied)
    if upgrade:
        with lock_state(root):
            baseline = (revision(root), branch(root))
            return _upgrade_from_root(root, baseline)
    before = fingerprint(root)
    state = load(root)
    tracked, values = _profile_data(root, upgrade, supplied, state, before)
    ensure_branch(root, upgrade=False, version=__version__)
    state["rollback_head"] = None
    copier.run_copy(
        src_path=str(source()),
        dst_path=root,
        defaults=True,
        data=values,
        overwrite=False,
        unsafe=False,
        quiet=True,
    )
    _finalize(root, state, before, tracked, False)
    return root
