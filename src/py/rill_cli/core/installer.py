"""Copier-owned installation; never replace a dirty consumer checkout."""

import hashlib
import shutil
import subprocess
from pathlib import Path
from typing import cast

import copier
import yaml

from rill_cli import __version__

from .constants import (
    COPIER_ANSWERS,
    MANAGED_DIRECTORIES,
    RUNTIME_ANCHORS,
    SCHEMA_VERSION,
)
from .state import load, save


def source() -> Path:
    embedded = Path(__file__).resolve().parents[1] / "template"
    if (embedded / "copier.yml").is_file():
        return embedded
    for parent in embedded.parents:
        candidate = parent / "standards/template"
        if (candidate / "copier.yml").is_file():
            return candidate
    raise FileNotFoundError("The bundled Copier template is missing")


def preflight(path: Path) -> Path:
    root = path.expanduser().resolve()
    if root.exists() and not root.is_dir():
        raise ValueError("Target is not a directory")
    if not root.exists():
        root.mkdir(parents=True)
    result = subprocess.run(  # noqa: S603 - trusted Git binary, no shell
        [shutil.which("git") or "/usr/bin/git", "-C", str(root), "rev-parse", "--show-toplevel"],
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
            [shutil.which("git") or "/usr/bin/git", "init", str(root)],
            check=True,
            capture_output=True,
            text=True,
        )
    return root


def ownership(root: Path) -> dict[str, bool]:
    return {
        "preserve_justfile": (root / "justfile").exists(),
        "preserve_agent_entry": (root / "AGENTS.md").exists(),
        "preserve_codex_roles": (root / ".codex/config.toml").exists(),
        "preserve_hook_config": (root / ".codex/hooks.json").exists(),
        "preserve_rill_skills": (root / ".agents/skills/rill-deliver/SKILL.md").exists(),
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
    for name in ("AGENTS.md",):
        path = root / name
        if path.is_file():
            files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
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
    config: object = yaml.safe_load((source() / "copier.yml").read_text(encoding="utf-8"))
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


def install(path: Path, *, upgrade: bool = False, data: list[str] | None = None) -> Path:
    supplied = select_data(data or [])
    if upgrade and supplied:
        raise ValueError("Upgrade uses recorded profile; no implicit scope changes")
    target = path.expanduser().resolve()
    if upgrade and not (target / COPIER_ANSWERS).is_file():
        raise ValueError("Cannot upgrade a project not installed by Rill")
    root = preflight(path)
    answers = root / COPIER_ANSWERS
    if not upgrade and answers.exists():
        raise ValueError("Already installed: use rill upgrade")
    before = fingerprint(root)
    state = load(root)
    values: dict[str, object] = dict(ownership(root))
    tracked: dict[str, object] = {}
    if upgrade:
        tracked, values = upgrade_values(root, state, before)
    else:
        values.update(supplied)
    copier.run_copy(
        src_path=str(source()),
        dst_path=root,
        defaults=True,
        data=values,
        overwrite=upgrade,
        unsafe=False,
    )
    after = fingerprint(root)
    owned = (set(tracked) | (set(after) - set(before))) if upgrade else set(after) - set(before)
    state.update(
        {
            "schema": SCHEMA_VERSION,
            "version": __version__,
            "mode": "normal",
            "managed": {name: digest for name, digest in after.items() if name in owned},
        }
    )
    state.setdefault("task_scope", [])
    save(root, state)
    return root
