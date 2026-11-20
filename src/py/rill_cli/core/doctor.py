"""Runtime diagnosis without modifying the target."""

import shutil
from pathlib import Path

from .constants import (
    CODEX_CONFIG,
    CODEX_HOOKS,
    COPIER_ANSWERS,
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
