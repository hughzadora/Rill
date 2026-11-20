"""Global fleet domain logic: native Git/Codex tools, no CLI or TUI imports."""

import fcntl
import os
import shutil
import subprocess
import tempfile
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from pathlib import Path

from platformdirs import user_data_path

from . import doctor
from .assets_mgr import (
    AssetManager,
    atomic_write,
    digest,
    download_release,
    read_bundle,
    unpack_archive,
)
from .constants import (
    FLEET_APP_ID,
    FLEET_ASSET_MANIFEST,
    FLEET_AUDIT_FILE,
    FLEET_BACKUPS_DIR,
    FLEET_BUNDLES_DIR,
    FLEET_LOCK_FILE,
    FLEET_RECENT_AUDIT_LIMIT,
    FLEET_REGISTRY_FILE,
    GLOBAL_CODEX_DIR,
)
from .models import (
    AgentAssetManifest,
    AuditAction,
    AuditRecord,
    FleetSnapshot,
    GitHubReleaseAsset,
    InstalledAsset,
    RegisteredProject,
)


class FleetEngine:
    """Persistent registry and guarded lifecycle for multiple local projects."""

    def __init__(self, *, data_root: Path | None = None, codex_root: Path | None = None) -> None:
        self.data_root = (data_root or user_data_path(FLEET_APP_ID, appauthor=False)).resolve()
        self.codex_root = codex_root or Path.home() / GLOBAL_CODEX_DIR
        self.files = AssetManager(self.data_root, self.codex_root)

    @contextmanager
    def _locked(self) -> Generator[None]:
        """Native POSIX lock serializes Rill writers across CLI and TUI processes."""
        self.data_root.mkdir(parents=True, exist_ok=True)
        with (self.data_root / FLEET_LOCK_FILE).open("a+b") as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(stream, fcntl.LOCK_UN)

    def load(self) -> FleetSnapshot:
        path = self.data_root / FLEET_REGISTRY_FILE
        if not path.exists():
            return FleetSnapshot()
        return FleetSnapshot.model_validate_json(path.read_bytes())

    def _registry_bytes(self, registry: FleetSnapshot) -> bytes:
        if registry.demo:
            raise ValueError("Demo assets must never be persisted")
        return (registry.model_dump_json(indent=2) + "\n").encode()

    def _save(self, registry: FleetSnapshot) -> None:
        atomic_write(self.data_root / FLEET_REGISTRY_FILE, self._registry_bytes(registry))

    def audit_records(self, *, limit: int = FLEET_RECENT_AUDIT_LIMIT) -> list[AuditRecord]:
        path = self.data_root / FLEET_AUDIT_FILE
        if not path.is_file():
            return []
        entries = [AuditRecord.model_validate_json(row) for row in path.read_text().splitlines()]
        return entries[-limit:]

    def _record(self, action: AuditAction, subject: str, backup_id: str) -> None:
        entry = AuditRecord(operation=action, subject=subject, backup_id=backup_id)
        path = self.data_root / FLEET_AUDIT_FILE
        with path.open("ab") as stream:
            stream.write((entry.model_dump_json() + "\n").encode())
            stream.flush()
            os.fsync(stream.fileno())

    def _transact(
        self,
        registry: FleetSnapshot,
        action: AuditAction,
        subject: str,
        updates: Mapping[str, bytes | None],
    ) -> None:
        """Backup before writes and revert only files still matching our own output."""
        backup = self.files.backup(action, list(updates))
        original = self.files.verify_backup(backup)
        changed: dict[Path, bytes | None] = {}
        try:
            for relative, contents in updates.items():
                target = self.files.file("codex", relative)
                changed[target] = contents
                if contents is None:
                    target.unlink()
                else:
                    atomic_write(target, contents)
            registry_path = self.data_root / FLEET_REGISTRY_FILE
            changed[registry_path] = self._registry_bytes(registry)
            self._save(registry)
            self._record(action, subject, backup.id)
        except Exception:
            self.files.restore_written(original, changed)
            raise

    def register_project(self, path: Path, *, name: str | None = None) -> RegisteredProject:
        root = path.expanduser().resolve(strict=True)
        if not root.is_dir():
            raise ValueError("Project must be an existing directory")
        result = subprocess.run(  # noqa: S603 - Git argv only
            [shutil.which("git") or "git", "-C", str(root), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        if Path(result.stdout.strip()).resolve() != root:
            raise ValueError("Project must be a Git repository root")
        with self._locked():
            registry = self.load()
            if any(project.path == root for project in registry.projects):
                raise ValueError("Project already registered")
            project = RegisteredProject(name=name or root.name, path=root)
            registry.projects.append(project)
            self._transact(registry, "register", project.id, {})
        return project

    def unregister_project(self, project_id: str) -> None:
        with self._locked():
            registry = self.load()
            selected = [item for item in registry.projects if item.id == project_id]
            if not selected:
                raise KeyError(f"Unknown project: {project_id}")
            registry.projects = [item for item in registry.projects if item.id != project_id]
            self._transact(registry, "retire", project_id, {})

    def _cached_bundle(self, manifest: AgentAssetManifest, payload: dict[str, bytes]) -> Path:
        cache = self.data_root / FLEET_BUNDLES_DIR / manifest.id / manifest.version
        if cache.exists():
            stored, stored_files = read_bundle(cache)
            if stored != manifest or stored_files != payload:
                raise ValueError("Immutable cached asset version has changed")
            return cache
        atomic_write(cache / FLEET_ASSET_MANIFEST, manifest.model_dump_json(indent=2).encode())
        for item in manifest.files:
            atomic_write(cache / item.source, payload[item.target])
        return cache

    def _verify_owned(self, asset: InstalledAsset) -> None:
        for relative, expected in asset.file_hashes.items():
            target = self.files.file("codex", relative)
            if not target.is_file() or digest(target.read_bytes()) != expected:
                raise PermissionError(f"Installed asset has drifted: {relative}")

    def _check_destinations(
        self, registry: FleetSnapshot, incoming: dict[str, bytes], owned: InstalledAsset | None
    ) -> None:
        foreign = {
            name
            for asset in registry.assets
            if asset.id != (owned.id if owned else None)
            for name in asset.file_hashes
        }
        if set(incoming) & foreign:
            raise PermissionError("Asset destination is owned by another installed asset")
        own_files: set[str] = set(owned.file_hashes) if owned else set[str]()
        for relative in incoming:
            target = self.files.file("codex", relative)
            if relative not in own_files and target.exists():
                raise PermissionError(f"Refusing to replace unowned Codex file: {relative}")

    def _install(self, bundle: Path, *, action: AuditAction) -> InstalledAsset:
        manifest, payload = read_bundle(bundle)
        with self._locked():
            registry = self.load()
            old = next((asset for asset in registry.assets if asset.id == manifest.id), None)
            if (action == "install") != (old is None):
                raise ValueError("Use install for new assets, upgrade for registered assets")
            if old is not None:
                self._verify_owned(old)
                if old.version == manifest.version:
                    raise ValueError("Asset is already at the requested version")
            self._check_destinations(registry, payload, old)
            obsolete: set[str] = set(old.file_hashes) - set(payload) if old else set[str]()
            cached = self._cached_bundle(manifest, payload)
            asset = InstalledAsset(
                id=manifest.id,
                name=manifest.name,
                kind=manifest.kind,
                version=manifest.version,
                file_hashes={k: digest(v) for k, v in payload.items()},
                source=str(cached),
                required_env=manifest.required_env,
                mcp_servers=manifest.mcp_servers,
            )
            registry.assets = [item for item in registry.assets if item.id != manifest.id]
            registry.assets.append(asset)
            self._transact(
                registry,
                action,
                manifest.id,
                {**payload, **dict.fromkeys(obsolete)},
            )
            return asset

    def install_bundle(self, bundle: Path) -> InstalledAsset:
        return self._install(bundle, action="install")

    def upgrade_bundle(self, bundle: Path) -> InstalledAsset:
        return self._install(bundle, action="upgrade")

    def preview_bundle(self, bundle: Path, *, upgrade: bool = False) -> dict[str, object]:
        """Read-only impact description for a terminal confirmation screen."""
        manifest, payload = read_bundle(bundle)
        registry = self.load()
        old = next((item for item in registry.assets if item.id == manifest.id), None)
        if upgrade != (old is not None):
            raise ValueError("Asset operation does not match registration")
        self._check_destinations(registry, payload, old)
        paths = sorted(set(payload) | (set(old.file_hashes) if old else set[str]()))
        return {
            "id": manifest.id,
            "version": manifest.version,
            "kind": manifest.kind,
            "paths": paths,
            "backup": True,
        }

    def preview_backup(self, backup_id: str) -> dict[str, object]:
        """Validate saved bytes before presenting the owner a rollback impact."""
        snapshot = self.files.inspect_backup(backup_id)
        self.files.verify_backup(snapshot)
        return {
            "id": backup_id,
            "paths": [f"{entry.namespace}/{entry.path}" for entry in snapshot.entries],
            "backup": True,
        }

    def install_archive(self, archive: Path, *, upgrade: bool = False) -> InstalledAsset:
        with tempfile.TemporaryDirectory(prefix="rill-asset-") as temporary:
            extracted = unpack_archive(archive, Path(temporary))
            return self.upgrade_bundle(extracted) if upgrade else self.install_bundle(extracted)

    def install_release(self, spec: GitHubReleaseAsset, *, upgrade: bool = False) -> InstalledAsset:
        with tempfile.TemporaryDirectory(prefix="rill-release-") as temporary:
            root = Path(temporary)
            package = download_release(spec, root)
            return self.install_archive(package, upgrade=upgrade)

    def retire_asset(self, asset_id: str) -> None:
        with self._locked():
            registry = self.load()
            old = next((asset for asset in registry.assets if asset.id == asset_id), None)
            if old is None:
                raise KeyError(f"Unknown asset: {asset_id}")
            self._verify_owned(old)
            registry.assets = [asset for asset in registry.assets if asset.id != asset_id]
            self._transact(registry, "retire", asset_id, dict.fromkeys(old.file_hashes))

    def repair_asset(self, asset_id: str) -> InstalledAsset:
        """Explicit owner action; restore only previously registered target paths."""
        with self._locked():
            registry = self.load()
            asset = next((item for item in registry.assets if item.id == asset_id), None)
            if asset is None:
                raise KeyError(f"Unknown asset: {asset_id}")
            manifest, payload = read_bundle(Path(asset.source))
            if manifest.id != asset.id or manifest.version != asset.version:
                raise ValueError("Cached asset manifest does not match registered version")
            self._check_destinations(registry, payload, asset)
            self._transact(registry, "repair", asset.id, payload)
            return asset

    def rollback(self, backup_id: str) -> str:
        """Restore original file bytes; capture current bytes as an undo snapshot."""
        with self._locked():
            original = self.files.inspect_backup(backup_id)
            contents = self.files.verify_backup(original)
            paths = [item.path for item in original.entries if item.namespace == "codex"]
            undo = self.files.backup("rollback", paths)
            self.files.restore(contents)
            self._record("rollback", backup_id, undo.id)
            return undo.id

    def backups(self) -> list[str]:
        root = self.data_root / FLEET_BACKUPS_DIR
        return (
            sorted((entry.name for entry in root.iterdir() if entry.is_dir()), reverse=True)
            if root.is_dir()
            else []
        )

    def inspect(self) -> dict[str, object]:
        registry = self.load()
        projects: list[dict[str, object]] = []
        for project in registry.projects:
            try:
                health = doctor.inspect(project.path)
                okay = bool(health["installed"]) and not health["violations"]
                projects.append({"id": project.id, "name": project.name, "healthy": okay})
            except (OSError, ValueError, subprocess.CalledProcessError) as exc:
                projects.append({"id": project.id, "name": project.name, "error": str(exc)})
        assets = [
            {"id": asset.id, "version": asset.version, "healthy": self._asset_health(asset)}
            for asset in registry.assets
        ]
        tools = {
            name: shutil.which(name) is not None
            for name in ("mise", "git", "uv", "pnpm", "just", "codex")
        }
        requested = {server for asset in registry.assets for server in asset.mcp_servers}
        try:
            mcp = (
                doctor.codex_mcp_status(requested) if requested else {"connectivity": "unverified"}
            )
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            mcp = {"error": str(exc), "connectivity": "unverified"}
        try:
            versions = doctor.mise_versions()
        except OSError, ValueError, subprocess.SubprocessError:
            versions = {}
        return {
            "projects": projects,
            "assets": assets,
            "tools": tools,
            "tool_versions": versions,
            "mcp": mcp,
        }

    def _asset_health(self, asset: InstalledAsset) -> bool:
        try:
            self._verify_owned(asset)
        except OSError, PermissionError:
            return False
        return all(key in os.environ for key in asset.required_env)
