"""Shared domain constants; cross-language inputs are verified in tests."""

from pathlib import Path

SCHEMA_VERSION = 1
MAX_REWRITE_LINES = 60

RILL_DIR = Path(".rill")
STATE_PATH = RILL_DIR / "state.json"
SYMBOLS_PATH = RILL_DIR / "symbols.txt"
ERROR_LOG_PATH = RILL_DIR / "last-error.log"
COPIER_ANSWERS = RILL_DIR / "copier-answers.yml"
RUNTIME_ANCHORS = frozenset({STATE_PATH, SYMBOLS_PATH, ERROR_LOG_PATH})
FRAMEWORK_PATHS = ("justfile", "mise.toml", "mise.lock", ".codex/", ".github/workflows/")
MANAGED_DIRECTORIES = (".codex", ".agents/skills", ".github/workflows", ".rill")
HOOK_EVENTS = frozenset({"session-start", "pre-compact", "pre-tool-use", "post-tool-use", "stop"})
