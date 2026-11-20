"""Real Git worktree regressions for L1 freezing and fail-closed recovery."""

import subprocess
import sys
from pathlib import Path

import pytest

from rill_cli.core import governance_git
from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import AttemptEvidence, DefectRecord, Disposition, Severity
from rill_cli.core.governance_engine import GovernanceEngine, RecoveryOutcome
from rill_cli.core.governance_git import RepairWorkspace, check_frozen, freeze_contracts


@pytest.fixture
def prepared(tmp_path: Path) -> tuple[Path, GovernanceEngine]:
    root = tmp_path / "project"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/attempt-test")
    (root / "contracts").mkdir()
    (root / "contracts/api.json").write_text('{"type":"object"}\n', encoding="utf-8")
    (root / "README.md").write_text("# Product\n", encoding="utf-8")
    (root / "justfile").write_text("ci-full:\n    @test -f fixed.txt\n", encoding="utf-8")
    (root / "tests").mkdir()
    (root / "tests/test_edge.py").write_text("def test_edge():\n    assert True\n")
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
    baseline = worker.witness_baseline(["just", "ci-full"])
    assert baseline.exit_code != 0
    checkout = worker.open()
    (checkout / "README.md").write_text("# Fixed product\n", encoding="utf-8")
    (checkout / "fixed.txt").write_text("Verified repair artifact\n", encoding="utf-8")
    git(checkout, "add", "README.md", "fixed.txt")
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
    observed = worker.run_check(["just", "ci-full"])
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
            RecoveryOutcome(recovered=False),
        )
    assert new.is_dir()
    assert engine.load().defects["issue-44"].state == Disposition.ATTEMPTING
    worker.abort(failure(new))


def test_trivial_green_cannot_verify_unrepaired_p0(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    scratch = worker.open()
    observed = worker.run_check([sys.executable, "-c", "print('success')"])
    assert observed.exit_code == 0
    with pytest.raises(PermissionError, match="new descendant commit"):
        worker.complete()
    assert scratch.exists()
    assert engine.load().defects["issue-44"].state == Disposition.ATTEMPTING
    worker.abort(failure(scratch))
    assert not scratch.exists()
    assert engine.load().defects["issue-44"].state == Disposition.RETRY_ELIGIBLE
    assert revision(root) == observed.revision


def test_l1_frozen_contract_rejects_git_mode_only_changes(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    contract = root / "contracts/api.json"
    git(root, "update-index", "--chmod=+x", "contracts/api.json")
    with pytest.raises(PermissionError, match="Staged L1"):
        check_frozen(engine)
    git(root, "update-index", "--chmod=-x", "contracts/api.json")
    contract.chmod(contract.stat().st_mode | 0o111)
    with pytest.raises(PermissionError, match="Frozen L1"):
        check_frozen(engine)


def test_noncritical_p1_is_quarantined_only_after_real_full_gate_passes(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    (root / "fixed.txt").write_text("Critical business path remains healthy\n", encoding="utf-8")
    git(root, "add", "fixed.txt")
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
        "test: verified baseline",
    )
    engine.register(
        DefectRecord(
            identity="isolatable-edge",
            severity=Severity.P1,
            baseline_revision=revision(root),
            hard_gate=False,
            root_cause="unrelated optional edge behavior",
        )
    )
    worker = RepairWorkspace(engine, "isolatable-edge")
    for _ in range(2):
        checkout = worker.open()
        failed = worker.run_check(
            [sys.executable, "-c", "raise SystemExit(5)"],
            isolate_test="tests/edge/test_optional.py::test_edge",
            isolation_rationale="Full critical suite passes while optional edge test fails",
        )
        assert failed.exit_code == 5
        assert not checkout.exists()
    result = engine.load().defects["isolatable-edge"]
    assert result.state == Disposition.QUARANTINED
    assert result.isolation is not None
    assert result.isolation.unaffected_command == "just ci-full"
    assert "tests/edge/test_optional.py::test_edge" in (root / "TECH_DEBT.md").read_text()
    with pytest.raises(PermissionError):
        worker.open()


def test_failed_critical_suite_cannot_quarantine_noncritical_p1(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    engine.register(
        DefectRecord(
            identity="unsafe-edge",
            severity=Severity.P1,
            baseline_revision=revision(root),
            hard_gate=False,
            root_cause="edge test failure with critical gate broken",
        )
    )
    worker = RepairWorkspace(engine, "unsafe-edge")
    for _ in range(2):
        worker.open()
        worker.run_check(
            [sys.executable, "-c", "raise SystemExit(5)"],
            isolate_test="tests/edge/test_optional.py::test_edge",
            isolation_rationale="Request isolation only if native critical gate passes",
        )
    assert engine.load().defects["unsafe-edge"].state == Disposition.BLOCKED
    assert not (root / "TECH_DEBT.md").exists()


def test_owned_repair_branch_runs_normal_git_precommit_hook(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    hooks = root / ".git/hooks"
    hooks.mkdir(exist_ok=True)
    (hooks / "pre-commit").write_text(
        "#!/bin/sh\n" + f'exec "{sys.executable}" -m rill_cli policy pre-commit\n'
    )
    (hooks / "pre-commit").chmod(0o755)
    worker = RepairWorkspace(engine, "issue-44")
    scratch = worker.open()
    assert git(scratch, "symbolic-ref", "--short", "HEAD").stdout.strip().startswith("fix/")
    (scratch / "README.md").write_text("# Working repair\n", encoding="utf-8")
    git(scratch, "add", "README.md")
    committed = git(
        scratch,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        f"core.hooksPath={hooks}",
        "commit",
        "-m",
        "fix: standard protected repair commit",
        check=False,
    )
    assert committed.returncode == 0, committed.stderr
    assert revision(scratch) != revision(root)
    worker.abort(failure(scratch))
    assert not scratch.exists()


def test_unrelated_generic_green_cannot_certify_a_changed_p0(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    scratch = worker.open()
    (scratch / "unrelated.txt").write_text("Not a defect repair\n")
    git(scratch, "add", "unrelated.txt")
    git(
        scratch,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fix: unrelated change",
    )
    assert worker.run_check([sys.executable, "-c", "print('PASS')"]).exit_code == 0
    with pytest.raises(PermissionError, match="Missing observed defect-specific"):
        worker.complete()
    assert revision(root) == engine.load().defects["issue-44"].baseline_revision
    worker.abort(failure(scratch))


def test_committed_test_deletion_is_rejected_even_when_generic_suite_passes(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    _root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    worker.witness_baseline(["just", "ci-full"])
    scratch = worker.open()
    git(scratch, "rm", "tests/test_edge.py")
    (scratch / "fixed.txt").write_text("Fixed\n")
    git(scratch, "add", "fixed.txt")
    git(
        scratch,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fix: remove unrelated test",
    )
    assert worker.run_check(["just", "ci-full"]).exit_code == 0
    with pytest.raises(PermissionError, match="Committed test deletion"):
        worker.complete()
    worker.abort(failure(scratch))


def test_verified_p0_does_not_release_an_unrepaired_sibling_branch(
    prepared: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = prepared
    original = revision(root)
    worker = RepairWorkspace(engine, "issue-44")
    worker.witness_baseline(["just", "ci-full"])
    scratch = worker.open()
    (scratch / "fixed.txt").write_text("Fixed\n")
    git(scratch, "add", "fixed.txt")
    git(
        scratch,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fix: resolved P0",
    )
    assert worker.run_check(["just", "ci-full"]).exit_code == 0
    assert worker.complete().state == Disposition.VERIFIED
    assert not any("issue-44" in item for item in engine.release_blockers())
    sibling = root.parent / "other-branch"
    git(root, "worktree", "add", "-b", "feat/other", str(sibling), original)
    try:
        cross_branch = GovernanceEngine(sibling, data_root=root.parent / "data")
        assert any("issue-44" in item for item in cross_branch.release_blockers())
    finally:
        git(root, "worktree", "remove", "--force", str(sibling))
        git(root, "branch", "-D", "feat/other")


def test_owner_branch_switch_during_regression_refuses_merge(
    prepared: tuple[Path, GovernanceEngine],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, engine = prepared
    worker = RepairWorkspace(engine, "issue-44")
    worker.witness_baseline(["just", "ci-full"])
    scratch = worker.open()
    (scratch / "fixed.txt").write_text("Fixed\n")
    git(scratch, "add", "fixed.txt")
    git(
        scratch,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fix: complete candidate",
    )
    assert worker.run_check(["just", "ci-full"]).exit_code == 0
    real = worker._require_full_regression  # pyright: ignore[reportPrivateUsage]

    def change_branch(record: DefectRecord, checkout: Path, candidate: str) -> AttemptEvidence:
        result = real(record, checkout, candidate)
        git(root, "switch", "-c", "feat/owner-changed-during-check")
        return result

    monkeypatch.setattr(worker, "_require_full_regression", change_branch)
    with pytest.raises(PermissionError, match="Owner branch or worktree changed"):
        worker.complete()
    assert revision(root) == engine.load().defects["issue-44"].baseline_revision
    assert engine.load().defects["issue-44"].state == Disposition.ATTEMPTING
    git(root, "switch", "feat/attempt-test")
    worker.abort(failure(scratch))
