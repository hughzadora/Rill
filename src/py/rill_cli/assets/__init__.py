"""Canonical template and frozen-safe embedded asset lookup."""

import sys
from pathlib import Path

from rill_cli.core.constants import (
    ASSET_DASHBOARD,
    FLEET_HTML_ASSET,
    PACKAGE_DIR,
    PACKAGE_VERSION_FILE,
    RILL_VERSION,
    SOURCE_TEMPLATE,
    TEMPLATE_DIR,
    TEMPLATE_SCHEMA,
)


def base() -> Path:
    frozen = getattr(sys, "_MEIPASS", None)
    if isinstance(frozen, str):
        return Path(frozen) / PACKAGE_DIR
    return Path(__file__).resolve().parents[1]


def template() -> Path:
    bundled = base() / TEMPLATE_DIR
    if (bundled / TEMPLATE_SCHEMA).exists():
        return bundled
    for parent in Path(__file__).resolve().parents:
        source = parent / SOURCE_TEMPLATE
        if (source / TEMPLATE_SCHEMA).is_file():
            return source
    raise FileNotFoundError("Rill's embedded Copier template is unavailable")


def dashboard() -> Path:
    return base() / ASSET_DASHBOARD


def fleet_dashboard() -> Path:
    return base() / FLEET_HTML_ASSET


def template_version() -> str:
    bundled = base() / PACKAGE_VERSION_FILE
    return bundled.read_text(encoding="utf-8").strip() if bundled.exists() else RILL_VERSION
