"""Single registry for CLI-owned paths, protocol keys, and policy thresholds."""

from importlib.metadata import version
from pathlib import Path

DISTRIBUTION = "rill-factory"
RILL_VERSION = version(DISTRIBUTION)
SCHEMA_VERSION = 1
MAX_REWRITE_LINES = 60
MAX_DIRTY_FILES = 6
MAX_COMMIT_FILES = 8
MAX_COMMIT_CHURN = 350
MAX_SYMBOL_LINES = 50
MAX_STATE_LINES = 30
MAX_HOOK_LINES = 25
MAX_ERROR_LINES = 15
FAILURE_LIMIT = 2
MAX_POST_BYTES = 4096
HOOK_INPUT_TIMEOUT_SECONDS = 2
MAX_HOOK_PAYLOAD_BYTES = 65536
GIT_HISTORY_COLUMNS = 3

PACKAGE_DIR = "rill_cli"
TEMPLATE_DIR = "template"
TEMPLATE_SCHEMA = "copier.yml"
SOURCE_TEMPLATE = Path("standards/template")
CODEX_CONFIG = Path(".codex/config.toml")
CODEX_HOOKS = Path(".codex/hooks.json")
REVIEW_SKILL = Path(".agents/skills/rill-review/SKILL.md")
DELIVER_SKILL = Path(".agents/skills/rill-deliver/SKILL.md")
AGENT_ENTRY = Path("AGENTS.md")
REVIEW_FILE = Path("REVIEW.md")
JUSTFILE = Path("justfile")
PACKAGE_VERSION_FILE = Path("VERSION")
ASSET_DASHBOARD = Path("assets/dashboard.html")
RILL_DIR = Path(".rill")
STATE_PATH = RILL_DIR / "state.json"
SYMBOLS_PATH = RILL_DIR / "symbols.txt"
ERROR_LOG_PATH = RILL_DIR / "last-error.log"
DASHBOARD_PATH = RILL_DIR / "dashboard.html"
COPIER_ANSWERS = RILL_DIR / "copier-answers.yml"
CI_SUMMARY_PATH = RILL_DIR / "ci-summary.json"
RUNTIME_ANCHORS = frozenset(
    {STATE_PATH, SYMBOLS_PATH, ERROR_LOG_PATH, DASHBOARD_PATH, CI_SUMMARY_PATH}
)
FRAMEWORK_PATHS = (
    "justfile",
    "REVIEW.md",
    "mise.toml",
    "mise.lock",
    "biome.json",
    "tsconfig.json",
    "vitest.config.ts",
    "playwright.config.ts",
    "stryker.config.json",
    ".semgrep.yml",
    ".codex/",
    ".agents/",
    ".husky/",
    ".github/workflows/",
)
DEFAULT_SCOPE = ("src/", "tests/", "package.json", "pyproject.toml")
FRONTEND_PATH_PREFIXES = ("src/ts/", "apps/web/")
BACKEND_PATH_PREFIXES = ("src/py/", "apps/api/")
MANAGED_DIRECTORIES = (".codex", ".agents/skills", ".github/workflows", ".rill")
TOOL_NAMES = ("git", "mise", "uv", "pnpm", "just")
HOOK_EVENTS = frozenset({"session-start", "pre-compact", "pre-tool-use", "post-tool-use", "stop"})
PROTECTED_BRANCHES = frozenset({"main", "master"})
BRANCH_PREFIXES = ("feat/", "fix/", "refactor/", "upgrade/")
INIT_BRANCH = "feat/rill-init"
INIT_COMMIT = "chore(rill): initialize harness"
UPGRADE_COMMIT = "chore(rill): upgrade harness"
ALLOWED_DECISIONS = frozenset({"approve", "reject", "escalate"})
REVIEW_MODES = frozenset({"normal", "upgrade"})
UI_HOST = "127.0.0.1"
UI_PORT = 0
UI_TOKEN_BYTES = 32
DISABLED_GIT_HOOKS = "/dev/null"  # Automatic template commits use Rill validation only.
FALLBACK_GIT_AUTHOR = "Rill CLI"
FALLBACK_GIT_EMAIL = "rill@localhost"
GIT_ENV_IDENT = ("GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL")
