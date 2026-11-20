"""Copier-owned installation; never replace a dirty consumer checkout."""

import hashlib
import shutil
import subprocess
from pathlib import Path
from typing import cast

import copier
import yaml

from rill_cli import __version__

from .state import load, save


def source() -> Path:
    embedded = Path(__file__).resolve().parents[1] / "template"
    if (embedded / "copier.yml").is_file():
        return embedded
    return Path(__file__).resolve().parents[4] / "standards/template"


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
        "preserve_agent_entry": (root / "AGENTS.md").exists(),
        "preserve_codex_roles": (root / ".codex/config.toml").exists(),
        "preserve_hook_config": (root / ".codex/hooks.json").exists(),
        "preserve_rill_skills": (root / ".agents/skills/rill-deliver/SKILL.md").exists(),
    }


def fingerprint(root: Path) -> dict[str, str]:
    """Snapshot only Rill-managed files, excluding mutable runtime anchors."""
    files: dict[str, str] = {}
    for directory in (".codex", ".agents/skills", ".github/workflows", ".rill"):
        parent = root / directory
        if not parent.exists():
            continue
        for path in parent.rglob("*"):
            if not path.is_file() or path.is_symlink():
                continue
            relative = path.relative_to(root).as_posix()
            if relative in {".rill/state.json", ".rill/last-error.log", ".rill/symbols.txt"}:
                continue
            files[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    for name in ("AGENTS.md", ".gitignore"):
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
    answers = root / ".rill/copier-answers.yml"
    previous = state.get("managed")
    if not isinstance(previous, dict) or not previous:
        raise ValueError("Missing prior managed-file hashes; upgrade requires recovery")
    tracked = cast("dict[str, object]", previous)
    for relative, digest in tracked.items():
        if before.get(relative) != digest:
            raise ValueError(f"Managed file changed or removed: {relative}")
    values = _answers(answers)
    return tracked, values


def install(path: Path, *, upgrade: bool = False) -> Path:
    root = preflight(path)
    answers = root / ".rill/copier-answers.yml"
    if upgrade and not answers.exists():
        raise ValueError("Cannot upgrade a project not installed by Rill")
    if not upgrade and answers.exists():
        raise ValueError("Already installed: use rill upgrade")
    before = fingerprint(root)
    state = load(root)
    values: dict[str, object] = dict(ownership(root))
    tracked: dict[str, object] = {}
    if upgrade:
        tracked, values = upgrade_values(root, state, before)
    copier.run_copy(
        src_path=str(source()),
        dst_path=root,
        defaults=True,
        data=values,
        overwrite=upgrade,
        unsafe=False,
    )
    after = fingerprint(root)
    owned = set(tracked) if upgrade else set(after) - set(before)
    state.update(
        {
            "schema": 1,
            "version": __version__,
            "mode": "normal",
            "task_scope": [],
            "managed": {name: digest for name, digest in after.items() if name in owned},
        }
    )
    save(root, state)
    return root
