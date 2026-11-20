"""L3: native Git contract freeze and owned repair worktree recovery."""

import hashlib
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path

from .constants import (
    GOVERNANCE_ATTEMPT_DIR,
    GOVERNANCE_MAX_EVIDENCE_CHARS,
    GOVERNANCE_REPAIR_BRANCH,
    GOVERNANCE_TEST_TIMEOUT_SECONDS,
    MAX_ERROR_LINES,
)
from .git_policy import branch, git, protect_branch, revision
from .governance_contract import (
    AttemptEvidence,
    DefectRecord,
    Disposition,
    FrozenContract,
    IsolationEvidence,
    Severity,
    schema_digest,
)
from .governance_engine import GovernanceEngine, RecoveryOutcome


def _safe_source(root: Path, relative: str) -> Path:
    path = Path(relative.rstrip("/"))
    if path.is_absolute() or ".." in path.parts or not relative or path == Path("."):
        raise PermissionError(f"Unsafe L1 contract path: {relative}")
    selected = root / path
    if not selected.resolve().is_relative_to(root.resolve()) or selected.is_symlink():
        raise PermissionError(f"L1 contract path escapes repository: {relative}")
    return selected


def _contract_oid(root: Path, relative: str, *, index: bool = False) -> str:
    target = _safe_source(root, relative)
    if relative.endswith("/") or target.is_dir():
        mode = ("--cached",) if index else ("--cached", "--others", "--exclude-standard")
        paths = git(root, "ls-files", *mode, "-z", "--", relative)
        names = sorted(filter(None, paths.stdout.split("\0")))
        if not names:
            raise ValueError(f"Empty L1 contract directory: {relative}")
        entries = [(name, _contract_oid(root, name, index=index)) for name in names]
        payload = "\0".join(f"{name}\0{oid}" for name, oid in entries)
        return hashlib.sha256(payload.encode()).hexdigest()
    if index:
        return _staged_file_identity(root, relative)
    return _working_file_identity(root, target, relative)


def _file_identity(mode: str, oid: str) -> str:
    return hashlib.sha256(f"{mode}:{oid}".encode()).hexdigest()


def _staged_file_identity(root: Path, relative: str) -> str:
    staged = git(root, "ls-files", "--stage", "--", relative).stdout.splitlines()
    if len(staged) != 1 or "\t" not in staged[0]:
        raise PermissionError(f"Untracked or unmerged L1 contract: {relative}")
    head, staged_path = staged[0].split("\t", maxsplit=1)
    mode, oid, stage = head.split()
    if staged_path != relative or stage != "0":
        raise PermissionError(f"Ambiguous staged L1 contract: {relative}")
    return _file_identity(mode, oid)


def _working_file_identity(root: Path, target: Path, relative: str) -> str:
    if not target.is_file():
        raise PermissionError(f"Missing L1 contract file: {relative}")
    oid = git(root, "hash-object", "--", relative).stdout.strip()
    mode = "100755" if target.stat().st_mode & 0o111 else "100644"
    return _file_identity(mode, oid)


def freeze_contracts(engine: GovernanceEngine, paths: list[str]) -> FrozenContract:
    """Pin real committed contract files, never an untested dirty source tree."""
    if not paths or _dirty(engine.root):
        raise PermissionError("L1 freeze requires selected paths and a clean Git repository")
    baseline = revision(engine.root)
    entries: dict[str, str] = {}
    for path in paths:
        _safe_source(engine.root, path)
        entries[path] = _contract_oid(engine.root, path)
        if entries[path] != _contract_oid(engine.root, path, index=True):
            raise PermissionError(f"L1 contract is not identical to Git index: {path}")
    frozen = FrozenContract(revision=baseline, schema_digest=schema_digest(), file_oids=entries)

    return engine.freeze(frozen)


def check_frozen(engine: GovernanceEngine, *, target: Path | None = None) -> None:
    """Compare both working files and Git index against frozen native Git OIDs."""
    frozen = engine.load().frozen
    if frozen is None:
        raise PermissionError("No frozen L1 contract; complete S1 before repair")
    root = target or engine.root
    for relative, expected in frozen.file_oids.items():
        if _contract_oid(root, relative) != expected:
            raise PermissionError(f"Frozen L1 contract changed: {relative}")
        if _contract_oid(root, relative, index=True) != expected:
            raise PermissionError(f"Staged L1 contract changed: {relative}")


def _dirty(root: Path) -> bool:
    return bool(git(root, "status", "--porcelain", "-z", "--untracked-files=all").stdout)


class RepairWorkspace:
    """A worktree belongs exclusively to one defect attempt, never the owner."""

    def __init__(self, engine: GovernanceEngine, identity: str) -> None:
        self.engine = engine
        self.identity = identity

    def _branch_name(self, record: DefectRecord) -> str:
        return f"{GOVERNANCE_REPAIR_BRANCH}{record.identity}-{record.attempt_count}"

    def _remove_owned(self, record: DefectRecord, checkout: Path) -> None:
        if checkout.is_symlink() or branch(checkout) != self._branch_name(record):
            raise PermissionError("Cannot delete an unowned repair branch")
        git(self.engine.root, "worktree", "remove", "--force", str(checkout))
        git(self.engine.root, "branch", "-D", self._branch_name(record))

    def _path(self, record: DefectRecord) -> Path:
        return (
            self.engine.data_root
            / GOVERNANCE_ATTEMPT_DIR
            / f"{record.identity}-{record.attempt_count}"
        )

    def witness_baseline(self, argv: list[str]) -> AttemptEvidence:
        """Reproduce the defect against a pristine native Git baseline without consuming a retry."""
        if not argv:
            raise ValueError("Regression command is required")
        record = self.engine.load().defects[self.identity]
        if record.state != Disposition.OPEN or _dirty(self.engine.root):
            raise PermissionError("Baseline witness requires a clean, unopened repair")
        if revision(self.engine.root) != record.baseline_revision:
            raise PermissionError("Baseline HEAD changed")
        self.engine.data_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix="rill-regression-", dir=self.engine.data_root
        ) as temp:
            checkout = Path(temp) / "source"
            git(
                self.engine.root,
                "worktree",
                "add",
                "--detach",
                str(checkout),
                record.baseline_revision,
            )
            try:
                result = subprocess.run(  # noqa: S603 - exact explicit native argv, no shell
                    argv,
                    cwd=checkout,
                    capture_output=True,
                    text=True,
                    check=False,
                    timeout=GOVERNANCE_TEST_TIMEOUT_SECONDS,
                )
                if revision(checkout) != record.baseline_revision or _dirty(checkout):
                    raise PermissionError("Baseline regression modified its Git checkout")
                lines = (result.stderr + "\n" + result.stdout).splitlines()
                receipt = AttemptEvidence(
                    revision=record.baseline_revision,
                    command=shlex.join(argv),
                    exit_code=result.returncode,
                    summary=("\n".join(lines[-MAX_ERROR_LINES:]).strip() or "No output")[
                        :GOVERNANCE_MAX_EVIDENCE_CHARS
                    ],
                )
            finally:
                git(self.engine.root, "worktree", "remove", "--force", str(checkout))
        if revision(self.engine.root) != record.baseline_revision or _dirty(self.engine.root):
            raise PermissionError("Owner checkout changed during baseline observation")
        self.engine.observe_baseline_failure(self.identity, receipt)
        return receipt

    def open(self) -> Path:
        check_frozen(self.engine)
        if _dirty(self.engine.root):
            raise PermissionError("Dirty owner worktree; preserve changes before repair")
        record = self.engine.load().defects[self.identity]
        target = self._path(record.model_copy(update={"attempt_count": record.attempt_count + 1}))
        if target.exists():
            raise PermissionError("Existing repair checkout cannot be overwritten")
        current = self.engine.begin(self.identity)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            git(
                self.engine.root,
                "worktree",
                "add",
                "-b",
                self._branch_name(current),
                str(target),
                current.baseline_revision,
            )
        except subprocess.CalledProcessError as exc:
            self.engine.record_failure(
                self.identity,
                AttemptEvidence(
                    revision=current.baseline_revision,
                    command="git worktree add",
                    exit_code=exc.returncode,
                    summary="Native Git worktree creation failed",
                ),
                recovered=False,
            )
            raise
        return target

    def path(self) -> Path:
        record = self.engine.load().defects[self.identity]
        if record.state != Disposition.ATTEMPTING:
            raise PermissionError("No active repair attempt")
        checkout = self._path(record)
        if not checkout.is_dir() or checkout.is_symlink():
            raise PermissionError("Active repair checkout is missing or unsafe")
        registrations = git(self.engine.root, "worktree", "list", "--porcelain").stdout
        if f"worktree {checkout}\n" not in registrations or (
            branch(checkout) != self._branch_name(record)
        ):
            raise PermissionError("Checkout is not a registered task-owned branch")
        return checkout

    def abort(
        self,
        evidence: AttemptEvidence,
        *,
        expected_checkout: Path | None = None,
        expected_attempt: int | None = None,
        isolation: IsolationEvidence | None = None,
    ) -> DefectRecord:
        if evidence.exit_code == 0:
            raise ValueError("Only a failed check may discard a repair worktree")
        record = self.engine.load().defects[self.identity]
        checkout = self.path()
        if (expected_checkout is not None and checkout != expected_checkout) or (
            expected_attempt is not None and record.attempt_count != expected_attempt
        ):
            raise PermissionError("Stale check cannot rollback another repair attempt")
        try:
            self._remove_owned(record, checkout)
            restored = (
                not checkout.exists()
                and revision(self.engine.root) == record.baseline_revision
                and not _dirty(self.engine.root)
            )
            if restored:
                check_frozen(self.engine)
        except OSError, ValueError, PermissionError, subprocess.CalledProcessError:
            restored = False
        result = (
            self.engine.record_failure_for_attempt(
                self.identity,
                evidence,
                expected_attempt,
                RecoveryOutcome(recovered=restored, isolation=isolation),
            )
            if expected_attempt is not None
            else self.engine.record_failure(self.identity, evidence, recovered=restored)
        )
        if not restored:
            raise PermissionError("Repair rollback unverified; further attempts blocked")
        return result

    def run_check(
        self,
        argv: list[str],
        *,
        isolate_test: str | None = None,
        isolation_rationale: str | None = None,
    ) -> AttemptEvidence:
        """Run native check without a shell; failure automatically rolls back."""
        self._validate_check_intent(argv, isolate_test, isolation_rationale)
        checkout = self.path()
        attempt = self.engine.load().defects[self.identity].attempt_count
        original_revision = revision(checkout)
        if _dirty(checkout):
            raise PermissionError("Commit repair changes before checking a Git revision")
        result = self._execute_check(argv, checkout, attempt)
        if revision(checkout) != original_revision or _dirty(checkout):
            self.engine.record_failure_for_attempt(
                self.identity,
                AttemptEvidence(
                    revision=original_revision,
                    command=shlex.join(argv),
                    exit_code=1,
                    summary="Repair checkout HEAD or files changed while native check ran",
                ),
                attempt,
                RecoveryOutcome(recovered=False),
            )
            raise PermissionError("Repair changed during verification; worktree preserved")
        lines = (result.stderr + "\n" + result.stdout).splitlines()
        summary = "\n".join(lines[-MAX_ERROR_LINES:]).strip() or "No command output"
        evidence = AttemptEvidence(
            revision=original_revision,
            command=shlex.join(argv),
            exit_code=result.returncode,
            summary=summary[:GOVERNANCE_MAX_EVIDENCE_CHARS],
        )
        if result.returncode:
            isolation = (
                self._isolation_proof(
                    checkout, original_revision, isolate_test, isolation_rationale
                )
                if isolate_test is not None and isolation_rationale is not None
                else None
            )
            self.abort(
                evidence,
                expected_checkout=checkout,
                expected_attempt=attempt,
                isolation=isolation,
            )
        else:
            self.engine.record_checked_candidate(self.identity, evidence, expected_attempt=attempt)
        return evidence

    def _validate_check_intent(
        self, argv: list[str], isolate_test: str | None, rationale: str | None
    ) -> None:
        if not argv:
            raise ValueError("A verification command is required")
        if (isolate_test is None) != (rationale is None):
            raise ValueError("P1 isolation needs both a failing-test identity and rationale")
        if isolate_test is not None:
            record = self.engine.load().defects[self.identity]
            if record.severity != Severity.P1 or record.hard_gate:
                raise PermissionError("Only noncritical P1 failures may request isolation")

    def _execute_check(
        self, argv: list[str], checkout: Path, attempt: int
    ) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(  # noqa: S603 - explicit native argv; no shell
                argv,
                cwd=checkout,
                capture_output=True,
                text=True,
                check=False,
                timeout=GOVERNANCE_TEST_TIMEOUT_SECONDS,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            evidence = AttemptEvidence(
                revision=revision(checkout),
                command=shlex.join(argv),
                exit_code=1,
                summary=f"Native command failed or timed out: {type(exc).__name__}",
            )
            self.abort(evidence, expected_checkout=checkout, expected_attempt=attempt)
            raise

    def _isolation_proof(
        self, checkout: Path, start_head: str, failing_test: str, rationale: str
    ) -> IsolationEvidence | None:
        """An actual native full check, not a self-reported zero-exit assertion."""
        command = [shutil.which("just") or "just", "ci-full"]
        try:
            result = subprocess.run(  # noqa: S603 - pinned native Just command
                command,
                cwd=checkout,
                capture_output=True,
                text=True,
                check=False,
                timeout=GOVERNANCE_TEST_TIMEOUT_SECONDS,
            )
        except OSError, subprocess.TimeoutExpired:
            return None
        if result.returncode or revision(checkout) != start_head or _dirty(checkout):
            return None
        return IsolationEvidence(
            failing_test=failing_test,
            unaffected_command="just ci-full",
            unaffected_revision=start_head,
            unaffected_exit_code=result.returncode,
            rationale=rationale,
        )

    @staticmethod
    def _require_defect_proof(record: DefectRecord, candidate: str) -> None:
        baseline_failures = [
            item
            for item in record.evidence
            if item.exit_code != 0 and item.revision == record.baseline_revision
        ]
        if not baseline_failures:
            raise PermissionError("Missing observed defect-specific failing baseline regression")
        if not any(
            item.exit_code == 0
            and item.revision == candidate
            and item.command == baseline_failures[0].command
            for item in record.evidence
        ):
            raise PermissionError("Candidate has no passing observation of the original regression")

    def _require_full_regression(
        self, record: DefectRecord, checkout: Path, candidate: str
    ) -> AttemptEvidence:
        if (
            candidate == record.baseline_revision
            or git(
                checkout,
                "merge-base",
                "--is-ancestor",
                record.baseline_revision,
                candidate,
                check=False,
            ).returncode
        ):
            raise PermissionError("A repair must contain a new descendant commit")
        self._require_defect_proof(record, candidate)
        regression = self.run_check(["just", "ci-full"])
        if regression.exit_code != 0:
            raise PermissionError("Full regression gate failed; repair remains unverified")
        if revision(checkout) != candidate or regression.revision != candidate:
            raise PermissionError("Regression gate ran on a different Git revision")
        return regression

    def complete(self) -> DefectRecord:
        """Native feature-branch fast forward after a witnessed passing check."""
        from .governance_gate import committed_test_deletions  # noqa: PLC0415 - shared native Git check

        record = self.engine.load().defects[self.identity]
        checkout = self.path()
        if _dirty(checkout) or _dirty(self.engine.root):
            raise PermissionError("Only clean committed worktrees can complete a repair")
        check_frozen(self.engine, target=checkout)
        check_frozen(self.engine)
        if revision(self.engine.root) != record.baseline_revision:
            raise PermissionError("Owner HEAD changed; concurrent Git work must be preserved")
        owner_branch = branch(self.engine.root)
        candidate = revision(checkout)
        if committed_test_deletions(checkout, record.baseline_revision):
            raise PermissionError("Committed test deletion cannot certify a repaired defect")
        regression = self._require_full_regression(record, checkout, candidate)
        if (
            branch(self.engine.root) != owner_branch
            or revision(self.engine.root) != record.baseline_revision
            or _dirty(self.engine.root)
        ):
            raise PermissionError("Owner branch or worktree changed during regression")
        check_frozen(self.engine)
        protect_branch(self.engine.root)
        git(self.engine.root, "merge", "--ff-only", "--no-overwrite-ignore", candidate)
        try:
            final = self.engine.record_success(self.identity, regression)
        except Exception:
            if revision(self.engine.root) == candidate and not _dirty(self.engine.root):
                git(self.engine.root, "reset", "--keep", record.baseline_revision)
            raise
        self._remove_owned(record, checkout)
        return final
