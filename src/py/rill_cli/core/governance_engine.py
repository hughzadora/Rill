"""L3 durable defect budgets; scoped to a native Git common directory."""

import fcntl
import hashlib
import os
from collections.abc import Callable, Generator
from contextlib import contextmanager
from pathlib import Path
from textwrap import fill

from platformdirs import user_data_path

from .assets_mgr import atomic_write
from .constants import (
    FLEET_APP_ID,
    GOVERNANCE_DATA_DIR,
    GOVERNANCE_LOCK_FILE,
    GOVERNANCE_MAX_DEBT_BYTES,
    GOVERNANCE_STATE_FILE,
    GOVERNANCE_TECH_DEBT_PATH,
)
from .git_policy import git, revision
from .governance_contract import (
    AttemptEvidence,
    DefectRecord,
    Disposition,
    FrozenContract,
    GovernanceLedger,
    IsolationEvidence,
    Severity,
    schema_digest,
)


class GovernanceEngine:
    """Attempt budgets persist across sessions and linked Git worktrees."""

    def __init__(self, root: Path, *, data_root: Path | None = None) -> None:
        self.root = root.expanduser().resolve(strict=True)
        common = git(self.root, "rev-parse", "--path-format=absolute", "--git-common-dir")
        identity = Path(common.stdout.strip()).resolve(strict=True).as_posix()
        key = hashlib.sha256(identity.encode()).hexdigest()
        self.data_root = (
            (data_root or user_data_path(FLEET_APP_ID, appauthor=False)) / GOVERNANCE_DATA_DIR / key
        )
        self.state_path = self.data_root / GOVERNANCE_STATE_FILE
        self.lock_path = self.data_root / GOVERNANCE_LOCK_FILE

    @contextmanager
    def _locked(self) -> Generator[None]:
        self.data_root.mkdir(parents=True, exist_ok=True)
        if self.lock_path.is_symlink() or self.state_path.is_symlink():
            raise PermissionError("Governance storage cannot be a symlink")
        with self.lock_path.open("a+b") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock, fcntl.LOCK_UN)

    def load(self) -> GovernanceLedger:
        """Never self-heal malformed counters; that would reset exhausted budgets."""
        if not self.state_path.exists():
            return GovernanceLedger()
        ledger = GovernanceLedger.model_validate_json(self.state_path.read_bytes())
        if ledger.frozen is not None and ledger.frozen.schema_digest != schema_digest():
            raise PermissionError("Frozen L1 schema differs from this installed Rill binary")
        return ledger

    def _update(self, mutation: Callable[[GovernanceLedger], None]) -> GovernanceLedger:
        with self._locked():
            ledger = self.load()
            mutation(ledger)
            checked = GovernanceLedger.model_validate_json(ledger.model_dump_json())
            atomic_write(self.state_path, (checked.model_dump_json(indent=2) + "\n").encode())
            return checked

    def freeze(self, contract: FrozenContract) -> FrozenContract:
        """A committed L1 freeze cannot silently be replaced by later workers."""
        if contract.schema_digest != schema_digest():
            raise ValueError("Freeze must use the installed Pydantic contract schema")

        def set_once(ledger: GovernanceLedger) -> None:
            if ledger.frozen is not None:
                raise PermissionError("L1 contract is already frozen")
            ledger.frozen = contract

        saved = self._update(set_once).frozen
        if saved is None:
            raise RuntimeError("L1 freeze did not persist")
        return saved

    def register(self, record: DefectRecord) -> DefectRecord:
        """Defect identity, grade and root cause cannot be rewritten to reset budget."""
        if record.state != Disposition.OPEN or record.attempt_count or record.evidence:
            raise ValueError("New defects must begin OPEN without repair history")

        def add(ledger: GovernanceLedger) -> None:
            if record.identity in ledger.defects:
                raise ValueError("Existing defect identity cannot reset its repair budget")
            if revision(self.root) != record.baseline_revision:
                raise PermissionError("Defect baseline must be the current Git revision")
            ledger.defects[record.identity] = record

        return self._update(add).defects[record.identity]

    def begin(self, identity: str) -> DefectRecord:
        def start(ledger: GovernanceLedger) -> None:
            defect = ledger.defects[identity]
            if defect.state not in {Disposition.OPEN, Disposition.RETRY_ELIGIBLE}:
                raise PermissionError(f"Repair not eligible: {defect.state}")
            if defect.attempt_count >= defect.attempt_limit:
                raise PermissionError("Repair budget exhausted")
            if revision(self.root) != defect.baseline_revision:
                raise PermissionError("Defect baseline changed; explicit reclassification required")
            defect.attempt_count += 1
            defect.state = Disposition.ATTEMPTING

        return self._update(start).defects[identity]

    def record_failure(
        self,
        identity: str,
        evidence: AttemptEvidence,
        *,
        recovered: bool,
        isolation: IsolationEvidence | None = None,
    ) -> DefectRecord:
        if evidence.exit_code == 0:
            raise ValueError("Failure must contain the actual failing exit code")

        def fail(ledger: GovernanceLedger) -> None:
            defect = ledger.defects[identity]
            if defect.state != Disposition.ATTEMPTING:
                raise PermissionError("Only an active attempt can fail")
            defect.evidence.append(evidence)
            defect.isolation = isolation
            defect.state = self._failed_disposition(defect, recovered)
            if defect.state == Disposition.QUARANTINED:
                self._append_debt(defect)

        return self._update(fail).defects[identity]

    @staticmethod
    def _failed_disposition(defect: DefectRecord, recovered: bool) -> Disposition:
        if not recovered or (
            defect.attempt_count >= defect.attempt_limit and defect.severity == Severity.P0
        ):
            return Disposition.BLOCKED
        if defect.attempt_count < defect.attempt_limit:
            return Disposition.RETRY_ELIGIBLE
        if defect.severity == Severity.P1:
            return (
                Disposition.QUARANTINED
                if not defect.hard_gate and defect.isolation
                else Disposition.BLOCKED
            )
        if defect.severity in {Severity.P2, Severity.P3} and not defect.hard_gate:
            return Disposition.DEFERRED
        return Disposition.BLOCKED

    def record_success(self, identity: str, evidence: AttemptEvidence) -> DefectRecord:
        if evidence.exit_code != 0 or revision(self.root) != evidence.revision:
            raise ValueError("Only a real passing command on the actual HEAD can verify")
        if git(self.root, "status", "--porcelain", "-z", "--untracked-files=all").stdout:
            raise PermissionError("Uncommitted or untracked code cannot certify a Git revision")

        def succeed(ledger: GovernanceLedger) -> None:
            defect = ledger.defects[identity]
            if defect.state != Disposition.ATTEMPTING:
                raise PermissionError("Only an active repair can be marked verified")
            defect.evidence.append(evidence)
            defect.last_verified_revision = evidence.revision
            defect.state = Disposition.VERIFIED

        return self._update(succeed).defects[identity]

    def _append_debt(self, defect: DefectRecord) -> None:
        """Append evidence only; never rewrite an unrelated large project document."""
        path = self.root / GOVERNANCE_TECH_DEBT_PATH
        if path.is_symlink() or (
            path.is_file() and path.stat().st_size > GOVERNANCE_MAX_DEBT_BYTES
        ):
            raise PermissionError("Unsafe TECH_DEBT.md destination")
        if defect.isolation is None:
            raise ValueError("Missing P1 isolation evidence")
        anchor = f"### Defect: {defect.identity}"
        if path.is_file() and anchor in path.read_text(encoding="utf-8"):
            return
        proof = defect.isolation
        heading = "# Verified, isolated technical debt\n\n" if not path.exists() else "\n"
        details = [
            anchor,
            "",
            f"- Priority: {defect.severity.value}",
            f"- Failed test: {proof.failing_test}",
            f"- Unaffected critical gate: {proof.unaffected_command}",
            f"- Verified revision: {proof.unaffected_revision}",
            f"- Issue: #{defect.issue_number}" if defect.issue_number else "- Issue: unlinked",
            "- Isolation evidence:",
            fill(proof.rationale, width=76),
            "",
        ]
        with path.open("a", encoding="utf-8") as stream:
            stream.write(heading + "\n".join(details) + "\n")
            stream.flush()
            os.fsync(stream.fileno())

    def summary(self) -> dict[str, object]:
        """Bounded read-only status for CLI, TUI and future owner dashboards."""
        ledger = self.load()
        defects = [
            {
                "identity": entry.identity,
                "severity": entry.severity.value,
                "state": entry.state.value,
                "attempts": entry.attempt_count,
                "limit": entry.attempt_limit,
                "remaining": entry.attempt_limit - entry.attempt_count,
                "issue_number": entry.issue_number,
            }
            for entry in ledger.defects.values()
        ]
        blocked = self.release_blockers()
        return {
            "configured": self.state_path.exists(),
            "contract_frozen": ledger.frozen is not None,
            "contract_revision": ledger.frozen.revision if ledger.frozen else None,
            "defects": defects,
            "blockers": blocked,
            "governance_gate": "blocked" if blocked else "pass",
            "scope": "registered governance defects only; not a release approval",
        }

    def release_blockers(self) -> list[str]:
        ledger = self.load()
        if ledger.frozen is None:
            return ["L1 contract has not been frozen"]
        allowed = {Disposition.VERIFIED, Disposition.QUARANTINED, Disposition.DEFERRED}
        blockers = [
            f"{item.identity}: {item.state}"
            for item in ledger.defects.values()
            if item.state not in allowed
            or (item.severity == Severity.P0 and item.state != Disposition.VERIFIED)
        ]
        debt_path = self.root / GOVERNANCE_TECH_DEBT_PATH
        if any(item.state == Disposition.QUARANTINED for item in ledger.defects.values()) and (
            not debt_path.is_file() or debt_path.is_symlink()
        ):
            blockers.append("Quarantined P1 evidence is missing from TECH_DEBT.md")
        return blockers
