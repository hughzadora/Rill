"""Real Git worktree regressions for L1 freezing and fail-closed recovery."""

import subprocess
import sys
from pathlib import Path

import pytest

from rill_cli.core import governance_git
from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import AttemptEvidence, DefectRecord, Disposition, Severity
from rill_cli.core.governance_engine import GovernanceEngine
from rill_cli.core.governance_git import RepairWorkspace, check_frozen, freeze_contracts


@pytest.fixture
def prepared(tmp_path: Path) -> tuple[Path, GovernanceEngine]:
    root = tmp_path / "project"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/attempt-test")
    (root / "contracts").mkdir()
    (root / "contracts/api.json").write_text('{"type":"object"}\n', encoding="utf-8")
    (root / "README.md").write_text("# Product\n", encoding="utf-8")
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
        "test: base",
    )
    engine = GovernanceEngine(root, data_root=tmp_path / "data")
    freeze_contracts(engine, ["contracts/"])
    engine.register(
        DefectRecord(
            identity="issue-44",
            severity=Severity.P0,
            baseline_revision=revision(root),
            root_cause="known defect",
            issue_number=44,
        )
    )
    return root, engine


def failure(root: Path) -> AttemptEvidence:
    return AttemptEvidence(
        revision=revision(root), command="pytest critical", exit_code=1, summary="failed"
    )


def test_contract_freeze_detects_staged_index_and_untracked_additions(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    with pytest.raises(PermissionError, match="already frozen"):
        freeze_contracts(engine, ["contracts/"])
    source = root / "contracts/api.json"
    source.write_text('{"type":"string"}\n', encoding="utf-8")
    git(root, "add", "contracts/api.json")
    source.write_text('{"type":"object"}\n', encoding="utf-8")
    with pytest.raises(PermissionError, match="Staged L1"):
        check_frozen(engine)
    git(root, "restore", "--source=HEAD", "--staged", "--worktree", "--", "contracts/api.json")
    (root / "contracts/new.json").write_text("{}\n", encoding="utf-8")
    with pytest.raises(PermissionError, match="Frozen L1"):
        check_frozen(engine)


def test_dirty_scratch_rolls_back_without_touching_original(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    baseline = revision(root)
    session = RepairWorkspace(engine, "issue-44")
    scratch = session.open()
    (scratch / "README.md").write_text("Agent unfinished edit\n", encoding="utf-8")
    (scratch / "agent-temp.txt").write_text("Task-owned scratch\n", encoding="utf-8")
    assert session.path() == scratch
    result = session.abort(failure(scratch))
    assert result.state == Disposition.RETRY_ELIGIBLE
    assert not scratch.exists()
    assert revision(root) == baseline
    assert (root / "README.md").read_text(encoding="utf-8") == "# Product\n"
    assert git(root, "status", "--porcelain", "-z").stdout == ""
    assert "rill" not in git(root, "worktree", "list", "--porcelain").stdout


def test_real_failed_command_autorolls_back_and_consumes_one_attempt(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    session = RepairWorkspace(engine, "issue-44")
    scratch = session.open()
    receipt = session.run_check([sys.executable, "-c", "raise SystemExit(7)"])
    assert receipt.exit_code == 7
    assert len(receipt.summary) < 600
    assert not scratch.exists()
    assert engine.load().defects["issue-44"].attempt_count == 1
    assert engine.load().defects["issue-44"].state == Disposition.RETRY_ELIGIBLE
    assert revision(root) == receipt.revision


def test_successful_check_does_not_falsely_certify_uncommitted_checkout(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    _root, engine = prepared
    session = RepairWorkspace(engine, "issue-44")
    scratch = session.open()
    (scratch / "README.md").write_text("Untested pending change\n", encoding="utf-8")
    with pytest.raises(PermissionError, match="Commit repair changes"):
        session.run_check([sys.executable, "-c", "print('test ran')"])
    assert engine.load().defects["issue-44"].state == Disposition.ATTEMPTING
    assert not engine.load().defects["issue-44"].evidence
    session.abort(failure(scratch))


def test_concurrent_user_edit_is_preserved_and_blocks_more_attempts(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    session = RepairWorkspace(engine, "issue-44")
    session.open()
    (root / "README.md").write_text("External owner edit\n", encoding="utf-8")
    with pytest.raises(PermissionError, match="rollback unverified"):
        session.abort(failure(root))
    assert (root / "README.md").read_text(encoding="utf-8") == "External owner edit\n"
    assert engine.load().defects["issue-44"].state == Disposition.BLOCKED
    with pytest.raises(PermissionError):
        session.open()


def test_failed_native_removal_blocks_instead_of_claiming_recovery(
    prepared: tuple[Path, GovernanceEngine],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, engine = prepared
    session = RepairWorkspace(engine, "issue-44")
    scratch = session.open()
    real_git = governance_git.git

    def refuse_remove(path: Path, *argv: str, **kwargs: bool) -> subprocess.CompletedProcess[str]:
        if argv[:2] == ("worktree", "remove"):
            raise subprocess.CalledProcessError(1, "git worktree remove")
        return real_git(path, *argv, **kwargs)

    with monkeypatch.context() as context:
        context.setattr(governance_git, "git", refuse_remove)
        with pytest.raises(PermissionError, match="rollback unverified"):
            session.abort(failure(scratch))
    assert engine.load().defects["issue-44"].state == Disposition.BLOCKED
    assert scratch.exists()
    git(root, "worktree", "remove", "--force", str(scratch))


def test_successful_committed_repair_merges_only_into_isolated_feature_branch(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    checkout = worker.open()
    (checkout / "README.md").write_text("# Fixed product\n", encoding="utf-8")
    git(checkout, "add", "README.md")
    git(
        checkout,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fix: repair regression",
    )
    candidate = revision(checkout)
    observed = worker.run_check([sys.executable, "-c", "print('critical test passed')"])
    assert observed.exit_code == 0 and observed.revision == candidate
    assert engine.load().defects["issue-44"].state == Disposition.ATTEMPTING
    final = worker.complete()
    assert final.state == Disposition.VERIFIED
    assert final.last_verified_revision == candidate
    assert revision(root) == candidate
    assert not checkout.exists()
    assert git(root, "status", "--porcelain").stdout == ""
    assert (root / "README.md").read_text(encoding="utf-8") == "# Fixed product\n"


def test_git_head_switch_while_check_runs_is_blocked_not_certified(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    checkout = worker.open()
    command = [
        sys.executable,
        "-c",
        "import subprocess; from pathlib import Path; "
        "Path('README.md').write_text('changed\\n'); "
        "subprocess.run(['git','add','README.md'],check=True); "
        "subprocess.run(['git','-c','user.name=Test','-c','user.email=test@example.test',"
        "'-c','core.hooksPath=/dev/null','commit','-m','test: moving head'],check=True)",
    ]
    with pytest.raises(PermissionError, match="changed during verification"):
        worker.run_check(command)
    assert engine.load().defects["issue-44"].state == Disposition.BLOCKED
    assert checkout.exists()
    assert git(root, "status", "--porcelain").stdout == ""
    git(root, "worktree", "remove", "--force", str(checkout))


def test_stale_observation_cannot_affect_later_active_attempt(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    old = worker.open()
    old_attempt = engine.load().defects["issue-44"].attempt_count
    worker.abort(failure(old))
    new = worker.open()
    with pytest.raises(PermissionError, match="Stale"):
        worker.abort(failure(root), expected_checkout=old, expected_attempt=old_attempt)
    with pytest.raises(PermissionError, match="Stale"):
        engine.record_failure_for_attempt(
            "issue-44",
            failure(root),
            old_attempt,
            recovered=False,
        )
    assert new.is_dir()
    assert engine.load().defects["issue-44"].state == Disposition.ATTEMPTING
    worker.abort(failure(new))
