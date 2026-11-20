"""Git atomisation must be exercised against disposable real repositories."""

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
    protect_branch,
    validate_message,
)


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


def test_reject_invalid_branch_and_bad_commit_message(repo: Path) -> None:
    git(repo, "symbolic-ref", "HEAD", "refs/heads/random")
    with pytest.raises(PermissionError, match="Unsupported"):
        protect_branch(repo)
    with pytest.raises(ValueError, match="Conventional"):
        validate_message("ship some things")
    validate_message("chore(rill): initialize harness")


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


def test_conventional_message_allows_body_and_breaking_footer() -> None:
    validate_message(
        "feat(api): add endpoint\n\nWhy this matters.\n\nBREAKING CHANGE: new contract"
    )
    with pytest.raises(ValueError, match="Conventional"):
        validate_message("wrong subject\n\nFix: legitimate details")
