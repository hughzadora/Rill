"""Actual Git repo negative tests for bounded, durable governance budgets."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import (
    AttemptEvidence,
    DefectRecord,
    Disposition,
    IsolationEvidence,
    Severity,
)
from rill_cli.core.governance_engine import GovernanceEngine


@pytest.fixture
def repository(tmp_path: Path) -> Path:
    root = tmp_path / "product"
    root.mkdir()
    git(root, "init", "-b", "feat/governance-test", "-q")
    (root / "README.md").write_text("# Product\n", encoding="utf-8")
    git(root, "add", "README.md")
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
        "test: initial",
    )
    return root


def engine(root: Path) -> GovernanceEngine:
    return GovernanceEngine(root, data_root=root.parent / "xdg-data")


def register(root: Path, severity: Severity, *, hard_gate: bool = False) -> GovernanceEngine:
    result = engine(root)
    result.register(
        DefectRecord(
            identity="issue-42",
            severity=severity,
            baseline_revision=revision(root),
            root_cause="stable failed test",
            hard_gate=hard_gate,
            issue_number=42,
        )
    )
    return result


def error(root: Path, *, command: str = "pytest edge") -> AttemptEvidence:
    return AttemptEvidence(
        revision=revision(root), command=command, exit_code=1, summary="test failed"
    )


def test_p2_exhausts_after_one_attempt_and_survives_restart(repository: Path) -> None:
    control = register(repository, Severity.P2)
    assert control.begin("issue-42").attempt_count == 1
    result = control.record_failure("issue-42", error(repository), recovered=True)
    assert result.state == Disposition.DEFERRED
    recreated = engine(repository)
    assert recreated.load().defects["issue-42"].attempt_count == 1
    with pytest.raises(PermissionError, match="not eligible"):
        recreated.begin("issue-42")
    with pytest.raises(ValueError, match="cannot reset"):
        recreated.register(
            DefectRecord(
                identity="issue-42",
                severity=Severity.P0,
                baseline_revision=revision(repository),
                root_cause="renamed",
            )
        )


def test_p0_fourth_attempt_is_hard_blocked_across_worktrees(repository: Path) -> None:
    control = register(repository, Severity.P0)
    for index in range(3):
        assert control.begin("issue-42").attempt_count == index + 1
        control.record_failure("issue-42", error(repository), recovered=True)
    assert control.load().defects["issue-42"].state == Disposition.BLOCKED
    other = repository.parent / "linked"
    git(repository, "worktree", "add", "--detach", str(other), revision(repository))
    try:
        sibling = engine(other)
        assert sibling.state_path == control.state_path
        assert sibling.load().defects["issue-42"].attempt_count == 3
        with pytest.raises(PermissionError, match="not eligible"):
            sibling.begin("issue-42")
    finally:
        git(repository, "worktree", "remove", str(other))


def test_p1_quarantine_writes_reproducible_debt_without_deleting_test(repository: Path) -> None:
    control = register(repository, Severity.P1)
    control.begin("issue-42")
    assert (
        control.record_failure("issue-42", error(repository), recovered=True).state
        == Disposition.RETRY_ELIGIBLE
    )
    control.begin("issue-42")
    proof = IsolationEvidence(
        failing_test="tests/edge/test_unrelated.py::test_optional",
        unaffected_command="just ci",
        unaffected_revision=revision(repository),
        unaffected_exit_code=0,
        rationale="Critical product path tested independently",
    )
    result = control.record_failure("issue-42", error(repository), recovered=True, isolation=proof)
    assert result.state == Disposition.QUARANTINED
    debt = (repository / "TECH_DEBT.md").read_text(encoding="utf-8")
    assert "### Defect: issue-42" in debt
    assert "tests/edge/test_unrelated.py::test_optional" in debt
    assert "#42" in debt
    assert control.load().defects["issue-42"].isolation == proof


def test_hard_p1_never_quarantines_and_recovery_failure_blocks(repository: Path) -> None:
    control = register(repository, Severity.P1, hard_gate=True)
    control.begin("issue-42")
    failed = control.record_failure("issue-42", error(repository), recovered=False)
    assert failed.state == Disposition.BLOCKED
    assert control.load().defects["issue-42"].attempt_count == 1
    assert not (repository / "TECH_DEBT.md").exists()
    with pytest.raises(PermissionError):
        control.begin("issue-42")


def test_corrupted_counter_never_self_heals_or_grants_new_attempts(repository: Path) -> None:
    control = register(repository, Severity.P0)
    control.begin("issue-42")
    original = control.state_path.read_bytes()
    control.state_path.write_text('{"schema_version": 999}', encoding="utf-8")
    with pytest.raises(ValidationError):
        control.load()
    with pytest.raises(ValidationError):
        control.begin("issue-42")
    assert control.state_path.read_bytes() != original


def test_success_requires_clean_current_revision_and_real_zero_exit(repository: Path) -> None:
    control = register(repository, Severity.P0)
    control.begin("issue-42")
    with pytest.raises(ValueError, match="real passing"):
        control.record_success("issue-42", error(repository))
    (repository / "untracked.py").write_text("value = 1\n", encoding="utf-8")
    passing = AttemptEvidence(
        revision=revision(repository), command="just ci", exit_code=0, summary="passed"
    )
    with pytest.raises(PermissionError, match="Uncommitted"):
        control.record_success("issue-42", passing)
    (repository / "untracked.py").unlink()
    assert control.record_success("issue-42", passing).state == Disposition.VERIFIED
    assert control.load().defects["issue-42"].last_verified_revision == revision(repository)
