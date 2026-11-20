"""Native independent review regression cases: scope, rollback, upgrade ordering."""

import subprocess
from pathlib import Path

import pytest

from rill_cli.core.constants import COPIER_ANSWERS
from rill_cli.core.git_policy import branch, git
from rill_cli.core.guardrails import validate
from rill_cli.core.installer import install
from rill_cli.core.state import load


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
