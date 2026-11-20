"""L1 contract rejects fake green, budget resets and unsafe classifications."""

from copy import deepcopy

import pytest
from pydantic import ValidationError

from rill_cli.core.constants import GOVERNANCE_ATTEMPT_LIMITS
from rill_cli.core.governance_contract import (
    AttemptEvidence,
    DefectRecord,
    Disposition,
    GovernanceLedger,
    IsolationEvidence,
    Severity,
    schema_digest,
)

REVISION = "a" * 40


def defect(severity: Severity = Severity.P0) -> DefectRecord:
    return DefectRecord(
        identity="issue-42",
        severity=severity,
        baseline_revision=REVISION,
        root_cause="reproducible defect",
    )


def test_limits_are_shared_and_invalid_severity_rejected() -> None:
    for severity in Severity:
        assert defect(severity).attempt_limit == GOVERNANCE_ATTEMPT_LIMITS[severity.value]
    with pytest.raises(ValidationError):
        DefectRecord.model_validate({**defect().model_dump(), "severity": "UNKNOWN"})


def test_over_budget_and_retry_without_remaining_attempt_are_rejected() -> None:
    payload = defect(Severity.P2).model_dump()
    payload["attempt_count"] = 2
    with pytest.raises(ValidationError, match="budget"):
        DefectRecord.model_validate(payload)
    payload["attempt_count"] = 1
    payload["state"] = Disposition.RETRY_ELIGIBLE
    with pytest.raises(ValidationError, match="retry"):
        DefectRecord.model_validate(payload)


def test_unverified_success_is_rejected() -> None:
    payload = defect().model_dump()
    payload["state"] = Disposition.VERIFIED
    payload["last_verified_revision"] = REVISION
    with pytest.raises(ValidationError, match="Verified requires"):
        DefectRecord.model_validate(payload)
    receipt = AttemptEvidence(revision=REVISION, command="just ci", exit_code=1, summary="failing")
    payload["evidence"] = [receipt.model_dump()]
    with pytest.raises(ValidationError, match="Verified requires"):
        DefectRecord.model_validate(payload)
    payload["evidence"] = [receipt.model_copy(update={"exit_code": 0}).model_dump()]
    assert DefectRecord.model_validate(payload).state == Disposition.VERIFIED


def test_hard_p1_cannot_be_quarantined_and_p2_hard_gate_cannot_defer() -> None:
    isolation = IsolationEvidence(
        failing_test="tests/test_edge.py::test_unrelated",
        unaffected_command="just ci",
        unaffected_revision=REVISION,
        unaffected_exit_code=0,
        rationale="isolated path",
    )
    first = defect(Severity.P1).model_dump()
    first.update(
        state=Disposition.QUARANTINED,
        hard_gate=True,
        attempt_count=2,
        evidence=[
            AttemptEvidence(
                revision=REVISION, command="pytest edge", exit_code=1, summary="fail"
            ).model_dump()
        ],
        isolation=isolation.model_dump(),
    )
    with pytest.raises(ValidationError, match="quarantined"):
        DefectRecord.model_validate(first)
    first["hard_gate"] = False
    assert DefectRecord.model_validate(first).isolation == isolation
    second = defect(Severity.P2).model_dump()
    second.update(
        state=Disposition.DEFERRED,
        hard_gate=True,
        attempt_count=1,
        evidence=[
            AttemptEvidence(
                revision=REVISION, command="check warning", exit_code=1, summary="noncritical"
            ).model_dump()
        ],
    )
    with pytest.raises(ValidationError, match="deferred"):
        DefectRecord.model_validate(second)


def test_ledger_schema_strict_identity_and_fingerprint() -> None:
    ledger = GovernanceLedger(defects={"issue-42": defect()})
    assert GovernanceLedger.model_validate_json(ledger.model_dump_json()) == ledger
    assert len(schema_digest()) == 64
    payload = deepcopy(ledger.model_dump())
    payload["schema_version"] += 1
    with pytest.raises(ValidationError, match="schema"):
        GovernanceLedger.model_validate(payload)
    payload = deepcopy(ledger.model_dump())
    payload["defects"]["wrong-key"] = payload["defects"].pop("issue-42")
    with pytest.raises(ValidationError, match="identity"):
        GovernanceLedger.model_validate(payload)
    with pytest.raises(ValidationError):
        GovernanceLedger.model_validate({**ledger.model_dump(), "unchecked": True})
