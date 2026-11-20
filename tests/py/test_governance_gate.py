"""L4 negative checks use real Git stages, schema and native CI receipts."""

import json
from pathlib import Path

import pytest

from rill_cli.core.constants import CI_SUMMARY_PATH
from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import DefectRecord, Severity
from rill_cli.core.governance_engine import GovernanceEngine
from rill_cli.core.governance_gate import check_pre_commit, release_gate
from rill_cli.core.governance_git import freeze_contracts


@pytest.fixture
def workspace(tmp_path: Path) -> tuple[Path, GovernanceEngine]:
    root = tmp_path / "business"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/acceptance")
    (root / ".gitignore").write_text(".rill/\n", encoding="utf-8")
    (root / "contracts").mkdir()
    (root / "contracts/api.json").write_text('{"type":"object"}\n', encoding="utf-8")
    (root / "tests").mkdir()
    (root / "tests/test_api.py").write_text("def test_contract():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: baseline",
    )
    engine = GovernanceEngine(root, data_root=tmp_path / "data")
    freeze_contracts(engine, ["contracts/"])
    return root, engine


def _receipt(root: Path, *, sha: str | None = None) -> None:
    current = sha or revision(root)
    output = root / CI_SUMMARY_PATH
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "head": current,
                "tier": "full",
                "result": "pass",
                "last_verified_sha": current,
            }
        ),
        encoding="utf-8",
    )


def test_l1_contract_is_immutable_during_integration(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    (root / "contracts/api.json").write_text('{"type":"string"}\n', encoding="utf-8")
    git(root, "add", "contracts/api.json")
    with pytest.raises(PermissionError, match="Frozen L1"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)
    git(root, "restore", "--source=HEAD", "--staged", "--worktree", "--", "contracts/api.json")
    check_pre_commit(root, data_root=engine.data_root.parent.parent)


def test_test_deletion_is_blocked_without_skipping_assertions(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    git(root, "rm", "tests/test_api.py")
    with pytest.raises(PermissionError, match="deleted tests"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)
    git(root, "restore", "--source=HEAD", "--staged", "--worktree", "--", "tests/test_api.py")
    check_pre_commit(root, data_root=engine.data_root.parent.parent)


def test_stale_revision_and_dirty_source_never_receive_release_status(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    data_root = engine.data_root.parent.parent
    _receipt(root)
    assert release_gate(root, data_root=data_root) == []
    (root / "untracked.py").write_text("unexpected = 1\n")
    assert any("uncommitted" in item for item in release_gate(root, data_root=data_root))
    (root / "untracked.py").unlink()
    (root / "feature.py").write_text("changed = True\n")
    git(root, "add", "feature.py")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: changed head",
    )
    assert any("stale" in item for item in release_gate(root, data_root=data_root))


def test_unresolved_p0_blocks_despite_green_receipt(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    _receipt(root)
    engine.register(
        DefectRecord(
            identity="p0-critical",
            severity=Severity.P0,
            baseline_revision=revision(root),
            root_cause="customer data corruption",
        )
    )
    result = release_gate(root, data_root=engine.data_root.parent.parent)
    assert any("p0-critical" in item for item in result)


def test_unfrozen_and_missing_ci_never_approve(tmp_path: Path) -> None:
    repo = tmp_path / "unmanaged"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "feat/unmanaged")
    (repo / "README.md").write_text("# Business\n")
    git(repo, "add", "README.md")
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
        "test: init",
    )
    assert check_pre_commit(repo, data_root=tmp_path / "data") is None
    blockers = release_gate(repo, data_root=tmp_path / "data")
    assert "L1 contract has not been frozen" in blockers
    assert "Missing L3 CI receipt" in blockers
