"""Git atomisation must be exercised against disposable real repositories."""

import shutil
import subprocess
from pathlib import Path

import pytest

from rill_cli.core.constants import MAX_COMMIT_CHURN, MAX_COMMIT_FILES, MAX_DIRTY_FILES
from rill_cli.core.git_policy import (
    branch,
    business_changes,
    changed_paths,
    check_dirty,
    check_staged,
    commit,
    ensure_branch,
    git,
    head_summary,
    history,
    is_business,
    protect_branch,
)
from rill_cli.core.guardrails import audit, validate
from rill_cli.core.state import save


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    git(tmp_path, "init", "-b", "feat/real-product")
    return tmp_path


def test_protected_main_requires_explicit_branch(repo: Path) -> None:
    git(repo, "symbolic-ref", "HEAD", "refs/heads/main")
    with pytest.raises(PermissionError, match="Direct development"):
        protect_branch(repo)
    ensure_branch(repo)
    assert branch(repo) == "feat/rill-init"
    protect_branch(repo)
    (repo / "justfile").write_text("help:\n    @echo ready\n", encoding="utf-8")
    commit(repo, "chore(rill): initialize harness", ["justfile"])
    git(repo, "symbolic-ref", "HEAD", "refs/heads/main")
    with pytest.raises(ValueError, match="reuse"):
        ensure_branch(repo)


def test_reject_invalid_branch(repo: Path) -> None:
    git(repo, "symbolic-ref", "HEAD", "refs/heads/random")
    with pytest.raises(PermissionError, match="Unsupported"):
        protect_branch(repo)


def test_uncommitted_file_fuse(repo: Path) -> None:
    source = repo / "src"
    source.mkdir()
    for index in range(MAX_DIRTY_FILES):
        (source / f"file{index}.py").write_text("pass\n", encoding="utf-8")
    check_dirty(repo)
    (source / "overflow.py").write_text("pass\n", encoding="utf-8")
    assert len(business_changes(repo)) == MAX_DIRTY_FILES + 1
    with pytest.raises(PermissionError, match="ATOMIC GATE BLOCKED"):
        check_dirty(repo)


def test_staging_file_limit(repo: Path) -> None:
    source = repo / "src"
    source.mkdir()
    for index in range(MAX_COMMIT_FILES + 1):
        (source / f"file{index}.py").write_text("value = 1\n", encoding="utf-8")
    git(repo, "add", "--", "src")
    assert len(changed_paths(repo, staged=True)) == MAX_COMMIT_FILES + 1
    with pytest.raises(PermissionError, match="business files"):
        check_staged(repo)


def test_staging_line_limit(repo: Path) -> None:
    source = repo / "src/file.py"
    source.parent.mkdir()
    source.write_text("value = 1\n" * (MAX_COMMIT_CHURN + 1), encoding="utf-8")
    git(repo, "add", "--", "src/file.py")
    with pytest.raises(PermissionError, match="business change"):
        check_staged(repo)


def test_atomic_commit_never_mixes_frontend_and_backend(repo: Path) -> None:
    for name in ("src/ts/app.ts", "src/py/service.py"):
        file = repo / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text("value = 1\n", encoding="utf-8")
    git(repo, "add", "--", "src")
    with pytest.raises(PermissionError, match="Backend and frontend"):
        check_staged(repo)


def test_native_auto_commit_skips_only_unrelated_global_hooks(repo: Path) -> None:
    file = repo / "justfile"
    file.write_text("help:\n    @echo ready\n", encoding="utf-8")
    assert commit(repo, "chore(rill): initialize harness", ["justfile"])
    assert git(repo, "status", "--porcelain").stdout.strip() == ""
    assert git(repo, "log", "-1", "--pretty=%s").stdout.strip() == "chore(rill): initialize harness"
    assert head_summary(repo) != "(unborn)"
    assert history(repo)[0]["subject"] == "chore(rill): initialize harness"
    assert not commit(repo, "chore(rill): initialize harness", ["justfile"])


def test_unicode_staged_file_cannot_bypass_churn_limit(repo: Path) -> None:
    source = repo / "src/安全.py"
    source.parent.mkdir()
    source.write_text("value = 1\n" * (MAX_COMMIT_CHURN + 1), encoding="utf-8")
    git(repo, "add", "--", "src/安全.py")
    assert "src/安全.py" in changed_paths(repo, staged=True)
    with pytest.raises(PermissionError, match="business change"):
        check_staged(repo)


def test_default_app_packages_are_counted_and_cannot_mix_staged_modules(repo: Path) -> None:
    assert is_business("apps/web/src/App.tsx")
    assert is_business("apps/api/src/service.ts")
    assert is_business("src/ts/App.tsx")
    assert is_business("src/py/main.py")
    for name in ("apps/web/src/App.tsx", "apps/api/src/service.ts"):
        target = repo / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("export const value = 1;\n", encoding="utf-8")
    assert len(business_changes(repo)) == 2
    git(repo, "add", "apps")
    with pytest.raises(PermissionError, match="Backend and frontend"):
        check_staged(repo)


def test_default_app_packages_enforce_file_and_line_limits(repo: Path) -> None:
    root = repo / "apps/web/src"
    root.mkdir(parents=True)
    for i in range(MAX_DIRTY_FILES + 1):
        (root / f"new{i}.tsx").write_text("export const x = 1;\n", encoding="utf-8")
    with pytest.raises(PermissionError, match="ATOMIC GATE BLOCKED"):
        check_dirty(repo)
    git(repo, "add", "apps/web")
    (root / "large.tsx").write_text(
        "export const x = 1;\n" * (MAX_COMMIT_CHURN + 1), encoding="utf-8"
    )
    git(repo, "add", "apps/web/src/large.tsx")
    with pytest.raises(PermissionError, match=r"business change|business files"):
        check_staged(repo)


def test_chinese_and_quoted_filename_paths_are_exact_in_scope(repo: Path) -> None:
    (repo / ".git/info/exclude").write_text(".rill/state.json\n", encoding="utf-8")
    git(repo, "config", "core.quotePath", "true")
    files = ("src/中文组件.py", 'src/"leading and trailing".py')
    save(repo, {"schema": 1, "mode": "normal", "task_scope": ["src/"]})
    for filename in files:
        target = repo / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("value = 1\n", encoding="utf-8")
        validate(repo, target)
    assert set(files).issubset(set(changed_paths(repo)))
    assert audit(repo) == []
    git(repo, "add", "src")
    assert set(files).issubset(set(changed_paths(repo, staged=True)))
    check_staged(repo)


def test_native_commitlint_is_the_sole_commit_message_validator() -> None:
    """The upstream CLI validates both ordinary and breaking/revert commits."""
    for message in (
        "feat(api): add endpoint",
        "feat!: breaking change",
        "feat(api)!: breaking change",
        "fix(client.v2)!: remove legacy contract",
        "revert: restore previous behavior",
        "feat(api): add endpoint\n\nWhy this matters.\n\nBREAKING CHANGE: new contract",
    ):
        result = subprocess.run(  # noqa: S603 - resolved, configured upstream tool
            [shutil.which("pnpm") or "pnpm", "exec", "commitlint"],
            input=message + "\n",
            text=True,
            capture_output=True,
            cwd=Path(__file__).resolve().parents[2],
            check=False,
        )
        assert result.returncode == 0, (message, result.stderr, result.stdout)
    invalid = subprocess.run(  # noqa: S603 - upstream tool, no shell
        [shutil.which("pnpm") or "pnpm", "exec", "commitlint"],
        input="feat(api)! breaking change\n",
        text=True,
        capture_output=True,
        cwd=Path(__file__).resolve().parents[2],
        check=False,
    )
    assert invalid.returncode != 0


def test_default_api_package_cannot_bypass_churn_limit(repo: Path) -> None:
    source = repo / "apps/api/src/index.ts"
    source.parent.mkdir(parents=True)
    source.write_text("export const api = true;\n" * (MAX_COMMIT_CHURN + 1), encoding="utf-8")
    git(repo, "add", "apps/api/src/index.ts")
    with pytest.raises(PermissionError, match="Atomic business change"):
        check_staged(repo)


def test_git_path_enumeration_errors_fail_closed(tmp_path: Path) -> None:
    """Non-repositories must never appear to have zero unsafe changed paths."""
    with pytest.raises(subprocess.CalledProcessError):
        changed_paths(tmp_path)
    with pytest.raises(PermissionError, match="Git audit unavailable"):
        audit(tmp_path)


def test_native_status_handles_staged_rename_and_unstaged_edit(repo: Path) -> None:
    """Git --no-renames avoids hand-coded porcelain XY rename edge cases."""
    (repo / ".git/info/exclude").write_text(".rill/state.json\n", encoding="utf-8")
    save(repo, {"schema": 1, "mode": "normal", "task_scope": ["src/"]})
    original = repo / "src/old.py"
    original.parent.mkdir()
    original.write_text("value = 1\n", encoding="utf-8")
    git(repo, "add", "src/old.py")
    git(
        repo,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: initial file",
    )
    git(repo, "mv", "src/old.py", "src/new.py")
    (repo / "src/new.py").write_text("value = 2\n", encoding="utf-8")
    assert {"src/new.py", "src/old.py"}.issubset(set(changed_paths(repo)))
    assert audit(repo) == []
