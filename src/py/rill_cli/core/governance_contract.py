"""L1: native Pydantic contract for bounded, revision-bound defect governance."""

import hashlib
import json
from enum import StrEnum
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .constants import (
    GOVERNANCE_ATTEMPT_LIMITS,
    GOVERNANCE_MAX_CAUSE_CHARS,
    GOVERNANCE_MAX_EVIDENCE_CHARS,
    GOVERNANCE_SCHEMA_VERSION,
)

GitRevision = Annotated[str, StringConstraints(pattern=r"^(?:[0-9a-f]{40}|[0-9a-f]{64})$")]
SourceIdentity = Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")]


class Severity(StrEnum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class Disposition(StrEnum):
    OPEN = "OPEN"
    ATTEMPTING = "ATTEMPTING"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"
    RETRY_ELIGIBLE = "RETRY_ELIGIBLE"
    VERIFIED = "VERIFIED"
    BLOCKED = "BLOCKED"
    QUARANTINED = "QUARANTINED"
    DEFERRED = "DEFERRED"


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AttemptEvidence(ContractModel):
    """An actual command receipt; no self-assessed success without a process exit."""

    revision: GitRevision
    command: str = Field(min_length=1)
    exit_code: int
    summary: str = Field(min_length=1, max_length=GOVERNANCE_MAX_EVIDENCE_CHARS)


class IsolationEvidence(ContractModel):
    """Proof that a failing P1 is outside the verified critical business path."""

    failing_test: str = Field(min_length=1)
    unaffected_command: str = Field(min_length=1)
    unaffected_revision: GitRevision
    unaffected_exit_code: int
    rationale: str = Field(min_length=1, max_length=GOVERNANCE_MAX_CAUSE_CHARS)

    @model_validator(mode="after")
    def require_passing_critical_checks(self) -> Self:
        if self.unaffected_exit_code != 0:
            raise ValueError("P1 isolation requires passing critical-path verification")
        return self


class FrozenContract(ContractModel):
    """Git object IDs of every explicitly selected L1 source file."""

    revision: GitRevision
    schema_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    file_oids: dict[str, GitRevision] = Field(min_length=1)


class DefectRecord(ContractModel):
    identity: SourceIdentity
    severity: Severity
    baseline_revision: GitRevision
    state: Disposition = Disposition.OPEN
    attempt_count: int = Field(default=0, ge=0)
    hard_gate: bool = False
    issue_number: int | None = Field(default=None, ge=1)
    root_cause: str = Field(min_length=1, max_length=GOVERNANCE_MAX_CAUSE_CHARS)
    evidence: list[AttemptEvidence] = Field(default_factory=list[AttemptEvidence])
    isolation: IsolationEvidence | None = None
    last_verified_revision: GitRevision | None = None

    @property
    def attempt_limit(self) -> int:
        return GOVERNANCE_ATTEMPT_LIMITS[self.severity.value]

    @model_validator(mode="after")
    def enforce_disposition_contract(self) -> Self:
        """Validate status boundaries with isolated deterministic checks."""
        self._check_attempts()
        self._check_quarantine()
        self._check_deferral()
        self._check_verification()
        return self

    def _check_attempts(self) -> None:
        if self.attempt_count > self.attempt_limit:
            raise ValueError("Attempt budget exceeded")
        if self.state == Disposition.ATTEMPTING and not self.attempt_count:
            raise ValueError("Attempting requires a consumed attempt")
        if self.state == Disposition.RETRY_ELIGIBLE and self.attempt_count >= self.attempt_limit:
            raise ValueError("Exhausted defects cannot be retry-eligible")

    def _has_failed_evidence(self) -> bool:
        return any(receipt.exit_code != 0 for receipt in self.evidence)

    def _check_quarantine(self) -> None:
        if self.state != Disposition.QUARANTINED:
            return
        if (
            self.severity != Severity.P1
            or self.hard_gate
            or self.isolation is None
            or self.attempt_count != self.attempt_limit
            or not self._has_failed_evidence()
        ):
            raise ValueError("Only evidenced, noncritical P1 defects may be quarantined")

    def _check_deferral(self) -> None:
        if self.state != Disposition.DEFERRED:
            return
        if (
            self.severity not in {Severity.P2, Severity.P3}
            or self.hard_gate
            or self.attempt_count != self.attempt_limit
            or not self._has_failed_evidence()
        ):
            raise ValueError("Hard quality gates and P0/P1 cannot be deferred")

    def _check_verification(self) -> None:
        if self.state != Disposition.VERIFIED:
            return
        if self.last_verified_revision is None or not any(
            receipt.exit_code == 0 and receipt.revision == self.last_verified_revision
            for receipt in self.evidence
        ):
            raise ValueError("Verified requires successful, revision-matching test evidence")


class GovernanceLedger(ContractModel):
    schema_version: int = GOVERNANCE_SCHEMA_VERSION
    frozen: FrozenContract | None = None
    defects: dict[str, DefectRecord] = Field(default_factory=dict[str, DefectRecord])

    @model_validator(mode="after")
    def ensure_consistent_identity(self) -> Self:
        if self.schema_version != GOVERNANCE_SCHEMA_VERSION:
            raise ValueError("Unknown governance contract schema")
        if any(identity != defect.identity for identity, defect in self.defects.items()):
            raise ValueError("Defect key and identity do not match")
        return self


def schema_digest() -> str:
    """Fingerprint the Pydantic JSON Schema; no parallel handwritten schema."""
    encoded = json.dumps(
        GovernanceLedger.model_json_schema(), sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(encoded.encode()).hexdigest()
