"""Runtime diagnosis without modifying the target."""

import shutil
from pathlib import Path

from .constants import COPIER_ANSWERS
from .guardrails import audit
from .state import load


def inspect(root: Path) -> dict[str, object]:
    state = load(root)
    return {
        "repository": str(root.resolve()),
        "installed": (root / COPIER_ANSWERS).exists(),
        "state": state,
        "tools": {name: shutil.which(name) is not None for name in ("git", "just", "mise", "gh")},
        "violations": audit(root) if (root / ".git").exists() else [],
    }
