"""Native independent review regression cases: scope, rollback, upgrade ordering."""

import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from threading import Event, Thread
from typing import cast

import pytest

from rill_cli.core import installer
from rill_cli.core.constants import COPIER_ANSWERS, STATE_PATH
from rill_cli.core.dashboard import receipt
from rill_cli.core.git_policy import branch, git, revision
from rill_cli.core.guardrails import validate
from rill_cli.core.installer import install
from rill_cli.core.state import load, save


def test_generated_default_profile_scope_includes_adopted_packages(tmp_path: Path) -> None:
    project = install(tmp_path / "product")
    scope = load(project)["task_scope"]
    assert isinstance(scope, list)
    assert "apps/web/" in scope and "apps/api/" in scope
    validate(project, project / "apps/web/src/App.tsx")
    validate(project, project / "apps/api/src/index.ts")
    validate(project, project / "scripts/safe.sh")
    with pytest.raises(PermissionError, match="Outside task_scope"):
        validate(project, project / "docs/unrelated.md")


def test_custom_workspace_scope_is_derived_from_copier_answers(tmp_path: Path) -> None:
    project = install(
        tmp_path / "custom",
        data=[
            "react=true",
            "node=false",
            "python=false",
            "shell=false",
            "js_workspace=frontend",
            "react_root=web-app",
        ],
    )
    scope = load(project)["task_scope"]
    assert isinstance(scope, list)
    assert "frontend/web-app/" in scope
    assert "apps/api/" not in scope
    validate(project, project / "frontend/web-app/src/App.tsx")


def test_failed_signed_init_cleans_owned_files_and_can_retry(tmp_path: Path) -> None:
    project = tmp_path / "retry"
    project.mkdir()
    git(project, "init", "-b", "main")
    git(project, "config", "commit.gpgsign", "true")
    git(project, "config", "gpg.program", "/bin/false")
    with pytest.raises(subprocess.CalledProcessError):
        install(project)
    assert git(project, "status", "--porcelain").stdout.strip() == ""
    assert not (project / COPIER_ANSWERS).exists()
    assert not (project / "REVIEW.md").exists()
    git(project, "config", "commit.gpgsign", "false")
    assert install(project) == project
    assert git(project, "status", "--porcelain").stdout.strip() == ""
    assert (
        git(project, "log", "-1", "--pretty=%s").stdout.strip() == "chore(rill): initialize harness"
    )


def test_hash_conflict_does_not_create_upgrade_branch(tmp_path: Path) -> None:
    project = install(tmp_path / "upgrade")
    git(project, "branch", "-m", "main")
    (project / "REVIEW.md").write_text("Modified and deliberately committed\n", encoding="utf-8")
    git(project, "add", "REVIEW.md")
    git(
        project, "-c", "core.hooksPath=/dev/null", "commit", "-m", "test(rill): modify managed file"
    )
    with pytest.raises(ValueError, match="Managed file changed"):
        install(project, upgrade=True)
    assert branch(project) == "main"
    assert git(project, "branch", "--list", "upgrade/*").stdout.strip() == ""
    assert git(project, "status", "--porcelain").stdout.strip() == ""


def test_upgrade_rejects_commit_after_managed_validation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = install(tmp_path / "baseline-race")
    git(project, "branch", "-m", "main")
    initial_head = revision(project)
    original_validation = installer.upgrade_values

    def commit_after_validation(
        root: Path, state: dict[str, object], before: dict[str, str]
    ) -> tuple[dict[str, object], dict[str, object]]:
        validated = original_validation(root, state, before)
        (root / "REVIEW.md").write_text("Owner commit during validation\n", encoding="utf-8")
        git(root, "add", "REVIEW.md")
        git(root, "-c", "core.hooksPath=/dev/null", "commit", "-m", "test(rill): race upgrade")
        return validated

    monkeypatch.setattr(installer, "upgrade_values", commit_after_validation)

    with pytest.raises(RuntimeError, match="Project changed while preparing upgrade"):
        install(project, upgrade=True)

    assert revision(project) != initial_head
    assert (project / "REVIEW.md").read_text(encoding="utf-8") == "Owner commit during validation\n"
    assert branch(project) == "main"


def test_upgrade_lock_does_not_dirty_previous_template_checkout(tmp_path: Path) -> None:
    project = install(tmp_path / "previous-template")
    git(project, "branch", "-m", "main")

    install(project, upgrade=True)

    assert branch(project).startswith("upgrade/rill-v")
    assert git(project, "status", "--porcelain", "-z", "--untracked-files=all").stdout == ""


def test_upgrade_serializes_runtime_state_updates_during_copier(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = install(tmp_path / "state-race")
    git(project, "branch", "-m", "main")
    original_copy = installer.copier.run_copy
    started = Event()
    writers: list[Thread] = []

    def concurrent_runtime_write(**kwargs: object) -> None:
        cast("Callable[..., object]", original_copy)(**kwargs)

        def update_receipt() -> None:
            started.set()
            receipt(project, "approve")

        writer = Thread(target=update_receipt)
        writers.append(writer)
        writer.start()
        assert started.wait(timeout=5)

    monkeypatch.setattr(installer.copier, "run_copy", concurrent_runtime_write)
    install(project, upgrade=True)

    for writer in writers:
        writer.join(timeout=5)
        assert not writer.is_alive()
    assert load(project)["owner_decision"] == "approve"


def test_failed_signed_upgrade_restores_branch_index_and_exact_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = install(tmp_path / "product")
    git(project, "branch", "-m", "main")
    baseline_head = revision(project)
    initial_review = (project / "REVIEW.md").read_bytes()
    state_path = project / STATE_PATH
    modified_state = load(project)
    modified_state["mode"] = "upgrade"
    save(project, modified_state)
    original_state = state_path.read_bytes()

    template = tmp_path / "next-template"
    shutil.copytree(installer.source(), template)
    (template / "REVIEW.md").write_text("# New review contract\n", encoding="utf-8")
    added_asset = ".agents/skills/rill-review/ADDED.md"
    (template / added_asset).write_text("New generated asset\n", encoding="utf-8")
    monkeypatch.setattr(installer, "source", lambda: template)
    git(project, "config", "commit.gpgsign", "true")
    git(project, "config", "gpg.program", "/bin/false")

    with pytest.raises(subprocess.CalledProcessError):
        install(project, upgrade=True)
    assert revision(project) == baseline_head
    assert branch(project) == "main"
    assert not git(project, "branch", "--list", "upgrade/*").stdout.strip()
    assert git(project, "status", "--porcelain").stdout == ""
    assert git(project, "diff", "--cached", "--name-only").stdout == ""
    assert (project / "REVIEW.md").read_bytes() == initial_review
    assert not (project / added_asset).exists()
    assert state_path.read_bytes() == original_state

    git(project, "config", "commit.gpgsign", "false")
    assert install(project, upgrade=True) == project
    assert git(project, "status", "--porcelain").stdout == ""
    assert (project / "REVIEW.md").read_text(encoding="utf-8") == "# New review contract\n"
    assert load(project)["rollback_head"] == baseline_head


def test_copier_error_after_partial_upgrade_is_rolled_back(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = install(tmp_path / "partial")
    old_head = revision(product)
    old_state = (product / STATE_PATH).read_bytes()

    def fail_after_copy(**kwargs: object) -> None:
        scratch = Path(str(kwargs["dst_path"]))
        (scratch / "REVIEW.md").write_text("# Partial Copier write\n", encoding="utf-8")
        raise OSError("Simulated Copier post-write failure")

    monkeypatch.setattr(installer.copier, "run_copy", fail_after_copy)
    with pytest.raises(OSError, match="Simulated Copier"):
        install(product, upgrade=True)
    assert revision(product) == old_head
    assert (product / STATE_PATH).read_bytes() == old_state
    assert git(product, "status", "--porcelain").stdout == ""


def test_state_write_failure_after_upgrade_commit_reverts_generated_commit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = install(tmp_path / "post-commit")
    initial_revision = revision(project)
    original_state = (project / STATE_PATH).read_bytes()
    source = tmp_path / "next-version"
    shutil.copytree(installer.source(), source)
    (source / "REVIEW.md").write_text("# Version after upgrade\n", encoding="utf-8")
    monkeypatch.setattr(installer, "source", lambda: source)

    def failed_state_save(_root: Path, _data: dict[str, object]) -> None:
        raise OSError("Injected failure after Git commit")

    monkeypatch.setattr(installer, "save", failed_state_save)
    with pytest.raises(OSError, match="after Git commit"):
        install(project, upgrade=True)
    assert revision(project) == initial_revision
    assert git(project, "status", "--porcelain").stdout == ""
    assert (project / STATE_PATH).read_bytes() == original_state
    assert git(project, "log", "-1", "--format=%s").stdout.strip() == (
        "chore(rill): initialize harness"
    )


def test_concurrent_managed_edit_is_preserved_on_failed_upgrade(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = install(tmp_path / "concurrent-edit")
    old_head = revision(product)
    old_state = (product / STATE_PATH).read_bytes()
    original_copy = installer.copier.run_copy

    def concurrent_edit(**kwargs: object) -> None:
        cast("Callable[..., object]", original_copy)(**kwargs)
        (product / "REVIEW.md").write_text("Human concurrent edit\n", encoding="utf-8")

    monkeypatch.setattr(installer.copier, "run_copy", concurrent_edit)
    with pytest.raises(RuntimeError, match="Project changed"):
        install(product, upgrade=True)
    assert revision(product) == old_head
    assert (product / "REVIEW.md").read_text(encoding="utf-8") == "Human concurrent edit\n"
    assert (product / STATE_PATH).read_bytes() == old_state


def test_concurrent_new_framework_file_is_not_deleted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = install(tmp_path / "concurrent-file")
    old_head = revision(product)
    old_state = (product / STATE_PATH).read_bytes()
    original_copy = installer.copier.run_copy
    owned = product / ".agents/skills/rill-review/human-note.md"

    def concurrent_new_file(**kwargs: object) -> None:
        cast("Callable[..., object]", original_copy)(**kwargs)
        owned.write_text("Human-owned note\n", encoding="utf-8")

    monkeypatch.setattr(installer.copier, "run_copy", concurrent_new_file)
    with pytest.raises(RuntimeError, match="Project changed"):
        install(product, upgrade=True)
    assert revision(product) == old_head
    assert owned.read_text(encoding="utf-8") == "Human-owned note\n"
    assert (product / STATE_PATH).read_bytes() == old_state


def test_commit_applied_but_state_save_fails_uses_native_keep_reset(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A failed final state write must not strand a half-upgraded Git revision."""
    product = install(tmp_path / "post-merge")
    old_head = revision(product)
    old_state = (product / STATE_PATH).read_bytes()
    template = tmp_path / "replacement"
    shutil.copytree(installer.source(), template)
    (template / "REVIEW.md").write_text("# Replaced contract\n", encoding="utf-8")
    monkeypatch.setattr(installer, "source", lambda: template)
    actual_save = installer.save

    def fail_at_live_save(root: Path, data: dict[str, object]) -> None:
        if root == product:
            raise OSError("Injected live state-write failure")
        actual_save(root, data)

    monkeypatch.setattr(installer, "save", fail_at_live_save)
    with pytest.raises(OSError, match="live state-write failure"):
        install(product, upgrade=True)
    assert revision(product) == old_head
    assert (product / STATE_PATH).read_bytes() == old_state
    assert git(product, "status", "--porcelain").stdout == ""
    assert git(product, "worktree", "list", "--porcelain").stdout.count("worktree ") == 1


def test_real_concurrent_commit_blocks_fast_forward_without_reset(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = install(tmp_path / "concurrent-head")
    original_save = (product / STATE_PATH).read_bytes()
    original_copier = installer.copier.run_copy

    def change_live_head(**kwargs: object) -> None:
        cast("Callable[..., object]", original_copier)(**kwargs)
        (product / "outside.txt").write_text("Concurrent revision\n", encoding="utf-8")
        git(product, "add", "outside.txt")
        git(
            product,
            "-c",
            "user.name=Owner",
            "-c",
            "user.email=owner@example.test",
            "-c",
            "core.hooksPath=/dev/null",
            "commit",
            "-m",
            "test: concurrent commit",
        )

    monkeypatch.setattr(installer.copier, "run_copy", change_live_head)
    with pytest.raises(RuntimeError, match="Project changed"):
        install(product, upgrade=True)
    assert git(product, "log", "-1", "--format=%s").stdout.strip() == "test: concurrent commit"
    assert (product / "outside.txt").read_text(encoding="utf-8") == "Concurrent revision\n"
    assert (product / STATE_PATH).read_bytes() == original_save
    assert git(product, "worktree", "list", "--porcelain").stdout.count("worktree ") == 1


def test_upgrade_does_not_delete_existing_branch_selected_by_owner(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = install(tmp_path / "branch-owner")
    start_head = revision(product)
    start_branch = branch(product)
    original_copier = installer.copier.run_copy

    def switch_to_existing_branch(**kwargs: object) -> None:
        cast("Callable[..., object]", original_copier)(**kwargs)
        git(product, "switch", "-c", "fix/owner-branch")

    monkeypatch.setattr(installer.copier, "run_copy", switch_to_existing_branch)
    with pytest.raises(RuntimeError, match="Project changed"):
        install(product, upgrade=True)
    assert revision(product) == start_head
    assert branch(product) == "fix/owner-branch"
    assert git(product, "branch", "--list", "fix/owner-branch").stdout.strip()
    assert git(product, "branch", "--list", "upgrade/*").stdout.strip() == ""
    assert git(product, "status", "--porcelain").stdout == ""
    assert start_branch != branch(product)
