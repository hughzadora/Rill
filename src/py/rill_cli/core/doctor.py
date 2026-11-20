"""Runtime diagnosis without modifying the target."""

import json
import shutil
import subprocess
from pathlib import Path
from typing import cast

from .constants import (
    CODEX_CONFIG,
    CODEX_HOOKS,
    COPIER_ANSWERS,
    FLEET_COMMAND_TIMEOUT_SECONDS,
    JUSTFILE,
    REVIEW_FILE,
    REVIEW_SKILL,
    TOOL_NAMES,
)
from .guardrails import audit
from .state import load


def inspect(root: Path) -> dict[str, object]:
    state = load(root)
    required = (CODEX_HOOKS, CODEX_CONFIG, REVIEW_SKILL, REVIEW_FILE, JUSTFILE)
    missing = [name.as_posix() for name in required if not (root / name).is_file()]
    return {
        "repository": str(root.resolve()),
        "installed": (root / COPIER_ANSWERS).exists(),
        "state": state,
        "tools": {name: shutil.which(name) is not None for name in TOOL_NAMES},
        "missing_guardrails": missing,
        "violations": audit(root) if (root / ".git").exists() else [],
    }


def mise_versions() -> dict[str, str]:
    """Summarize native active versions, excluding machine configuration paths."""
    binary = shutil.which("mise")
    if binary is None:
        return {}
    result = subprocess.run(  # noqa: S603 - resolved native mise CLI
        [binary, "ls", "--current", "--json"],
        check=True,
        capture_output=True,
        text=True,
        timeout=FLEET_COMMAND_TIMEOUT_SECONDS,
    )
    raw: object = json.loads(result.stdout)
    if not isinstance(raw, dict):
        raise ValueError("Unexpected native mise response")
    tools: dict[str, str] = {}
    for name, entries in cast("dict[str, object]", raw).items():
        if not isinstance(entries, list):
            continue
        for item in cast("list[object]", entries):
            if isinstance(item, dict):
                row = cast("dict[str, object]", item)
                if row.get("active") is True and isinstance(row.get("version"), str):
                    tools[name] = cast("str", row["version"])
    return tools


def codex_mcp_status(requested: set[str]) -> dict[str, object]:
    """Native Codex registration inspection; do not claim server connectivity."""
    binary = shutil.which("codex")
    if binary is None:
        return {"available": False, "missing": sorted(requested), "connectivity": "unverified"}
    result = subprocess.run(  # noqa: S603 - trusted Codex CLI, no shell
        [binary, "mcp", "list", "--json"],
        check=True,
        capture_output=True,
        text=True,
        timeout=FLEET_COMMAND_TIMEOUT_SECONDS,
    )
    raw: object = json.loads(result.stdout)
    if not isinstance(raw, list):
        raise ValueError("Unexpected native Codex MCP inventory")
    available: set[str] = set()
    for item in cast("list[object]", raw):
        if isinstance(item, dict):
            row = cast("dict[str, object]", item)
            name = row.get("name")
            if isinstance(name, str) and row.get("enabled") is True:
                available.add(name)
    return {
        "available": True,
        "configured": sorted(available & requested),
        "missing": sorted(requested - available),
        "connectivity": "unverified",
    }
