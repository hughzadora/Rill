"""Rill software factory CLI, versioned from the repository's VERSION file."""

from pathlib import Path


def _read_version() -> str:
    package = Path(__file__).resolve().parent
    bundled = package / "VERSION"
    if bundled.is_file():
        return bundled.read_text(encoding="utf-8").strip()
    for directory in package.parents:
        if (directory / "pyproject.toml").is_file():
            return (directory / "VERSION").read_text(encoding="utf-8").strip()
    raise RuntimeError("The Rill VERSION resource is missing")


__version__ = _read_version()
