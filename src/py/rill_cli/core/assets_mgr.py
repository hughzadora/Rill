"""Transactional byte snapshots and verified Codex asset file operations."""

import hashlib
import os
import shutil
import subprocess
import tarfile
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from .constants import (
    FLEET_ASSET_MANIFEST,
    FLEET_BACKUP_MANIFEST,
    FLEET_BACKUP_TIME_FORMAT,
    FLEET_BACKUPS_DIR,
    FLEET_COMMAND_TIMEOUT_SECONDS,
    FLEET_MAX_ASSET_FILE_BYTES,
    FLEET_MAX_BUNDLE_BYTES,
    FLEET_REGISTRY_FILE,
)
from .models import (
    AgentAssetManifest,
    AssetFile,
    AuditAction,
    BackupEntry,
    BackupNamespace,
    BackupSnapshot,
    GitHubReleaseAsset,
)


def digest(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def atomic_write(path: Path, contents: bytes) -> None:
    """Write using the destination filesystem, preserving existing file mode."""
    path.parent.mkdir(parents=True, exist_ok=True)
    previous_mode = path.stat().st_mode if path.exists() else None
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(contents)
            stream.flush()
            os.fsync(stream.fileno())
        if previous_mode is not None:
            os.chmod(temporary, previous_mode)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def safe_relative(root: Path, relative: str) -> Path:
    """Deny traversal and symlink-based writes outside any owner root."""
    entry = AssetFile.relative_path(relative)
    if root.is_symlink():
        raise PermissionError(f"Managed root is a symlink: {root}")
    candidate = root / entry
    if not candidate.resolve().is_relative_to(root.resolve()):
        raise PermissionError(f"Unsafe asset path: {relative}")
    if candidate.is_symlink():
        raise PermissionError(f"Asset is a symlink: {relative}")
    return candidate


def read_bundle(bundle: Path) -> tuple[AgentAssetManifest, dict[str, bytes]]:
    """Validate a complete local bundle before writing any global file."""
    root = bundle.expanduser().resolve(strict=True)
    manifest = AgentAssetManifest.model_validate_json((root / FLEET_ASSET_MANIFEST).read_bytes())
    payload: dict[str, bytes] = {}
    for item in manifest.files:
        file = safe_relative(root, item.source)
        if not file.is_file() or file.stat().st_size > FLEET_MAX_ASSET_FILE_BYTES:
            raise ValueError(f"Missing or oversized asset file: {item.source}")
        contents = file.read_bytes()
        if digest(contents) != item.sha256:
            raise ValueError(f"Asset digest mismatch: {item.source}")
        payload[item.target] = contents
    return manifest, payload


class AssetManager:
    """Owns global byte snapshots, never guesses which existing files to remove."""

    def __init__(self, data_root: Path, codex_root: Path) -> None:
        self.data_root = data_root
        self.codex_root = codex_root

    def file(self, namespace: BackupNamespace, relative: str) -> Path:
        root = self.codex_root if namespace == "codex" else self.data_root
        return safe_relative(root, relative)

    def backup(self, operation: AuditAction, targets: list[str]) -> BackupSnapshot:
        """Record original bytes before any registry or ~/.codex modification."""
        parent = self.data_root / FLEET_BACKUPS_DIR
        parent.mkdir(parents=True, exist_ok=True)
        backup_id = datetime.now(UTC).strftime(FLEET_BACKUP_TIME_FORMAT)
        destination = parent / backup_id
        if destination.exists():
            raise FileExistsError("Snapshot timestamp collision; retry operation")
        with tempfile.TemporaryDirectory(dir=parent) as temporary:
            folder = Path(temporary)
            entries = [self._backed_up(folder, "data", FLEET_REGISTRY_FILE.as_posix())]
            for relative in sorted(set(targets)):
                entries.append(self._backed_up(folder, "codex", relative))
            snapshot = BackupSnapshot(id=backup_id, operation=operation, entries=entries)
            (folder / FLEET_BACKUP_MANIFEST).write_text(
                snapshot.model_dump_json(indent=2), encoding="utf-8"
            )
            os.replace(folder, destination)
        return snapshot

    def _backed_up(self, folder: Path, namespace: BackupNamespace, relative: str) -> BackupEntry:
        original = self.file(namespace, relative)
        if not original.exists():
            return BackupEntry(namespace=namespace, path=relative, existed=False)
        if not original.is_file():
            raise PermissionError(f"Refusing non-regular managed file: {original}")
        location = folder / namespace / relative
        location.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, location)
        return BackupEntry(
            namespace=namespace,
            path=relative,
            existed=True,
            sha256=digest(location.read_bytes()),
        )

    def inspect_backup(self, backup_id: str) -> BackupSnapshot:
        if not backup_id or Path(backup_id).name != backup_id:
            raise ValueError("Invalid backup identifier")
        location = self.data_root / FLEET_BACKUPS_DIR / backup_id
        snapshot = BackupSnapshot.model_validate_json(
            (location / FLEET_BACKUP_MANIFEST).read_bytes()
        )
        if snapshot.id != backup_id:
            raise ValueError("Backup identity mismatch")
        return snapshot

    def verify_backup(self, snapshot: BackupSnapshot) -> list[tuple[Path, bytes | None]]:
        location = self.data_root / FLEET_BACKUPS_DIR / snapshot.id
        verified: list[tuple[Path, bytes | None]] = []
        for item in snapshot.entries:
            destination = self.file(item.namespace, item.path)
            if not item.existed:
                verified.append((destination, None))
                continue
            original = safe_relative(location / item.namespace, item.path).read_bytes()
            if digest(original) != item.sha256:
                raise ValueError(f"Corrupted backup: {item.path}")
            verified.append((destination, original))
        return verified

    def restore(self, verified: list[tuple[Path, bytes | None]]) -> None:
        for destination, contents in verified:
            if contents is None:
                if destination.is_file() and not destination.is_symlink():
                    destination.unlink()
            else:
                atomic_write(destination, contents)

    def restore_written(
        self,
        previous: list[tuple[Path, bytes | None]],
        written: dict[Path, bytes | None],
    ) -> None:
        """Undo only our bytes, never discard a concurrent external write."""
        original = dict(previous)
        for target, expected in written.items():
            current = target.read_bytes() if target.is_file() and not target.is_symlink() else None
            if current not in (expected, original[target]):
                raise RuntimeError(f"Concurrent file change; preserved snapshot: {target}")
        undo = [
            (path, contents)
            for path, contents in previous
            if path in written and written[path] != contents
        ]
        self.restore(undo)


def unpack_archive(archive: Path, destination: Path) -> Path:
    """Read a release archive without accepting links, devices or traversal."""
    total = 0
    names: set[str] = set()
    with tarfile.open(archive, mode="r:gz") as source:
        for member in source:
            if member.isdir():
                continue
            if not member.isfile() or member.name in names:
                raise ValueError(f"Unsafe or duplicate release archive entry: {member.name}")
            output = safe_relative(destination, member.name)
            total += member.size
            if member.size > FLEET_MAX_ASSET_FILE_BYTES or total > FLEET_MAX_BUNDLE_BYTES:
                raise ValueError("Release asset exceeds configured size limits")
            stream = source.extractfile(member)
            if stream is None:
                raise ValueError(f"Unreadable release asset: {member.name}")
            contents = stream.read(FLEET_MAX_ASSET_FILE_BYTES + 1)
            if len(contents) != member.size:
                raise ValueError(f"Incomplete release archive member: {member.name}")
            atomic_write(output, contents)
            names.add(member.name)
    return destination


def download_release(spec: GitHubReleaseAsset, destination: Path) -> Path:
    """Delegate GitHub authentication and downloads to the upstream gh CLI."""
    command = [
        shutil.which("gh") or "gh",
        "release",
        "download",
        spec.tag,
        "--repo",
        spec.repository,
        "--pattern",
        spec.asset,
        "--dir",
        str(destination),
    ]
    subprocess.run(  # noqa: S603 - Pydantic-validated native gh argv, no shell
        command, check=True, capture_output=True, timeout=FLEET_COMMAND_TIMEOUT_SECONDS
    )
    package = destination / spec.asset
    if digest(package.read_bytes()) != spec.sha256:
        raise ValueError("Downloaded GitHub Release SHA-256 mismatch")
    return package
