"""L3: native Git contract freeze and owned repair worktree recovery."""

import hashlib
import shlex
import subprocess
from pathlib import Path

from .constants import (
    GOVERNANCE_ATTEMPT_DIR,
    GOVERNANCE_MAX_EVIDENCE_CHARS,
    GOVERNANCE_TEST_TIMEOUT_SECONDS,
    MAX_ERROR_LINES,
)
from .git_policy import git, protect_branch, revision
from .governance_contract import (
    AttemptEvidence,
    DefectRecord,
    Disposition,
    FrozenContract,
    schema_digest,
)
from .governance_engine import GovernanceEngine


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
        indexed = git(root, "rev-parse", f":{relative}", check=False)
        if indexed.returncode:
            raise PermissionError(f"Untracked or removed L1 contract: {relative}")
        return indexed.stdout.strip()
    if not target.is_file():
        raise PermissionError(f"Missing L1 contract file: {relative}")
    oid = git(root, "hash-object", "--", relative).stdout.strip()
    if not oid:
        raise ValueError(f"Could not hash L1 contract: {relative}")
    return oid


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

    def _path(self, record: DefectRecord) -> Path:
        return (
            self.engine.data_root
            / GOVERNANCE_ATTEMPT_DIR
            / f"{record.identity}-{record.attempt_count}"
        )

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
                "--detach",
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
        if f"worktree {checkout}\n" not in registrations:
            raise PermissionError("Checkout is not registered in native Git")
        return checkout

    def abort(
        self,
        evidence: AttemptEvidence,
        *,
        expected_checkout: Path | None = None,
        expected_attempt: int | None = None,
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
            git(self.engine.root, "worktree", "remove", "--force", str(checkout))
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
                self.identity, evidence, expected_attempt, recovered=restored
            )
            if expected_attempt is not None
            else self.engine.record_failure(self.identity, evidence, recovered=restored)
        )
        if not restored:
            raise PermissionError("Repair rollback unverified; further attempts blocked")
        return result

    def run_check(self, argv: list[str]) -> AttemptEvidence:
        """Run native check without a shell; failure automatically rolls back."""
        if not argv:
            raise ValueError("A verification command is required")
        checkout = self.path()
        attempt = self.engine.load().defects[self.identity].attempt_count
        original_revision = revision(checkout)
        if _dirty(checkout):
            raise PermissionError("Commit repair changes before checking a Git revision")
        try:
            result = subprocess.run(  # noqa: S603 - exact argv, never shell=True
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
                recovered=False,
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
            self.abort(evidence, expected_checkout=checkout, expected_attempt=attempt)
        else:
            self.engine.record_checked_candidate(self.identity, evidence, expected_attempt=attempt)
        return evidence

    def complete(self) -> DefectRecord:
        """Native feature-branch fast forward after a witnessed passing check."""
        record = self.engine.load().defects[self.identity]
        checkout = self.path()
        if _dirty(checkout) or _dirty(self.engine.root):
            raise PermissionError("Only clean committed worktrees can complete a repair")
        check_frozen(self.engine, target=checkout)
        check_frozen(self.engine)
        if revision(self.engine.root) != record.baseline_revision:
            raise PermissionError("Owner HEAD changed; concurrent Git work must be preserved")
        candidate = revision(checkout)
        passed = next(
            (
                receipt
                for receipt in record.evidence
                if receipt.exit_code == 0 and receipt.revision == candidate
            ),
            None,
        )
        if passed is None:
            raise PermissionError("No witnessed passing native check for candidate HEAD")
        protect_branch(self.engine.root)
        git(self.engine.root, "merge", "--ff-only", "--no-overwrite-ignore", candidate)
        try:
            final = self.engine.record_success(self.identity, passed)
        except Exception:
            if revision(self.engine.root) == candidate and not _dirty(self.engine.root):
                git(self.engine.root, "reset", "--keep", record.baseline_revision)
            raise
        git(self.engine.root, "worktree", "remove", "--force", str(checkout))
        return final
