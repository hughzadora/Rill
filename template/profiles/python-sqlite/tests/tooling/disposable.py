import shutil
from pathlib import Path

PROJECT_FILES = (
    ".gitleaks.toml",
    ".gitignore",
    ".oxfmtrc.json",
    "README.md",
    "mise.lock",
    "mise.toml",
    "pyproject.toml",
    "uv.lock",
)


def copy_project(source: Path, target: Path) -> None:
    for filename in PROJECT_FILES:
        shutil.copy2(source / filename, target / filename)
    for directory in ("src", "tests"):
        shutil.copytree(
            source / directory,
            target / directory,
            ignore=shutil.ignore_patterns("__pycache__"),
        )
