"""Global fleet domain logic: native Git/Codex tools, no CLI or TUI imports."""

import fcntl
import json
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
    FLEET_CODEX_HOMES_DIR,
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
        configured = os.environ.get("CODEX_HOME")
        fallback = Path(configured) if configured else Path.home() / GLOBAL_CODEX_DIR
        self.codex_root = (codex_root if codex_root is not None else fallback).expanduser()
        default_codex = (Path.home() / GLOBAL_CODEX_DIR).resolve()
        storage = data_root or user_data_path(FLEET_APP_ID, appauthor=False)
        if data_root is None and self.codex_root != default_codex:
            storage = storage / FLEET_CODEX_HOMES_DIR / digest(str(self.codex_root).encode())
        self.data_root = storage.resolve()
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

    @staticmethod
    def _preview_token(registry: FleetSnapshot, details: object) -> str:
        """Bind a confirmation to the exact registry and checked mutation inputs."""
        encoded = json.dumps(
            {"registry": registry.model_dump(mode="json"), "impact": details},
            sort_keys=True,
            separators=(",", ":"),
        )
        return digest(encoded.encode())

    @staticmethod
    def _bundle_impact(
        manifest: AgentAssetManifest, payload: Mapping[str, bytes]
    ) -> dict[str, object]:
        return {
            "manifest": manifest.model_dump(mode="json"),
            "hashes": {path: digest(data) for path, data in payload.items()},
        }

    def _rollback_token(self, desired: Mapping[Path, bytes | None]) -> str:
        return self._preview_token(
            self.load(),
            {
                str(path): digest(data) if data is not None else None
                for path, data in desired.items()
            },
        )

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
        previous = self.load()
        all_owned = self._transaction_paths(previous, action, subject, updates)
        backup = self.files.backup(action, sorted(set(updates) | all_owned))
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

    def _transaction_paths(
        self,
        previous: FleetSnapshot,
        action: AuditAction,
        subject: str,
        updates: Mapping[str, bytes | None],
    ) -> set[str]:
        """Select snapshot paths and verify unchanged owned files before mutation."""
        all_owned: set[str] = set()
        for asset in previous.assets:
            if action == "repair" and asset.id != subject:
                continue
            all_owned.update(asset.file_hashes)
            for name, expected in asset.file_hashes.items():
                if name in updates:
                    continue  # Explicit repair can restore a drifted target.
                target = self.files.file("codex", name)
                if not target.is_file() or digest(target.read_bytes()) != expected:
                    raise PermissionError(f"Cannot snapshot a drifted registered asset: {name}")
        return all_owned

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

    def unregister_project(self, project_id: str, *, preview_token: str | None = None) -> None:
        with self._locked():
            registry = self.load()
            if preview_token is not None and preview_token != self._preview_token(
                registry, {"retire_project": project_id}
            ):
                raise PermissionError("Project registry changed after approval")
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
        cache.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="rill-bundle-", dir=cache.parent) as temporary:
            staging = Path(temporary)
            atomic_write(
                staging / FLEET_ASSET_MANIFEST, manifest.model_dump_json(indent=2).encode()
            )
            for item in manifest.files:
                atomic_write(staging / item.source, payload[item.target])
            read_bundle(staging)
            os.replace(staging, cache)
        return cache

    def _verify_owned(
        self,
        asset: InstalledAsset,
        paths: set[str] | None = None,
        known_drift: Mapping[str, bytes | None] | None = None,
    ) -> None:
        for relative, expected in asset.file_hashes.items():
            if paths is not None and relative not in paths:
                continue
            target = self.files.file("codex", relative)
            contents = target.read_bytes() if target.is_file() else None
            if contents is None or digest(contents) != expected:
                if (
                    known_drift is not None
                    and relative in known_drift
                    and known_drift[relative] == contents
                ):
                    continue
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

    def _install(
        self, bundle: Path, *, action: AuditAction, preview_token: str | None = None
    ) -> InstalledAsset:
        manifest, payload = read_bundle(bundle)
        with self._locked():
            registry = self.load()
            if preview_token is not None and preview_token != self._preview_token(
                registry, self._bundle_impact(manifest, payload)
            ):
                raise PermissionError("Asset bundle or inventory changed after approval")
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

    def install_bundle(self, bundle: Path, *, preview_token: str | None = None) -> InstalledAsset:
        return self._install(bundle, action="install", preview_token=preview_token)

    def upgrade_bundle(self, bundle: Path, *, preview_token: str | None = None) -> InstalledAsset:
        return self._install(bundle, action="upgrade", preview_token=preview_token)

    def preview_bundle(self, bundle: Path, *, upgrade: bool = False) -> dict[str, object]:
        """Owner preview protected by a cryptographic input+registry token."""
        manifest, payload = read_bundle(bundle)
        with self._locked():
            registry = self.load()
            old = next((item for item in registry.assets if item.id == manifest.id), None)
            if upgrade != (old is not None):
                raise ValueError("Asset operation does not match registration")
            if old is not None:
                self._verify_owned(old)
            self._check_destinations(registry, payload, old)
            paths = sorted(set(payload) | (set(old.file_hashes) if old else set[str]()))
            return {
                "id": manifest.id,
                "version": manifest.version,
                "kind": manifest.kind,
                "paths": paths,
                "backup": True,
                "token": self._preview_token(registry, self._bundle_impact(manifest, payload)),
            }

    def preview_backup(self, backup_id: str) -> dict[str, object]:
        """Validate every historical restore effect before owner approval."""
        with self._locked():
            desired, paths = self._rollback_plan(backup_id)
            return {
                "id": backup_id,
                "paths": paths,
                "backup": True,
                "token": self._rollback_token(desired),
            }

    def preview_retire(self, identity: str, *, project: bool = False) -> dict[str, object]:
        """Bind a retire decision to a registered project or verified asset."""
        with self._locked():
            registry = self.load()
            if project:
                if not any(item.id == identity for item in registry.projects):
                    raise KeyError(f"Unknown project: {identity}")
                paths: list[str] = []
            else:
                asset = next((item for item in registry.assets if item.id == identity), None)
                if asset is None:
                    raise KeyError(f"Unknown asset: {identity}")
                self._verify_owned(asset)
                paths = sorted(asset.file_hashes)
            token = self._preview_token(
                registry, {"retire_project" if project else "retire_asset": identity}
            )
            return {"id": identity, "paths": paths, "backup": True, "token": token}

    def install_archive(self, archive: Path, *, upgrade: bool = False) -> InstalledAsset:
        with tempfile.TemporaryDirectory(prefix="rill-asset-") as temporary:
            extracted = unpack_archive(archive, Path(temporary))
            return self.upgrade_bundle(extracted) if upgrade else self.install_bundle(extracted)

    def install_release(self, spec: GitHubReleaseAsset, *, upgrade: bool = False) -> InstalledAsset:
        with tempfile.TemporaryDirectory(prefix="rill-release-") as temporary:
            root = Path(temporary)
            package = download_release(spec, root)
            return self.install_archive(package, upgrade=upgrade)

    def retire_asset(self, asset_id: str, *, preview_token: str | None = None) -> None:
        with self._locked():
            registry = self.load()
            if preview_token is not None and preview_token != self._preview_token(
                registry, {"retire_asset": asset_id}
            ):
                raise PermissionError("Asset inventory changed after retire approval")
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
            if {target: digest(data) for target, data in payload.items()} != asset.file_hashes:
                raise PermissionError("Cached repair payload differs from registered file hashes")
            self._check_destinations(registry, payload, asset)
            self._transact(registry, "repair", asset.id, payload)
            return asset

    def _repair_history(self, backup_id: str) -> list[str]:
        """Trace audited undo snapshots to their original repair transaction."""
        history = self.audit_records(limit=0)
        candidate = backup_id
        visited: set[str] = set()
        lineage: list[str] = []
        while candidate not in visited:
            visited.add(candidate)
            lineage.append(candidate)
            snapshot = self.files.inspect_backup(candidate)
            if snapshot.operation == "repair":
                recorded = any(
                    entry.operation == "repair" and entry.backup_id == candidate
                    for entry in history
                )
                return lineage if recorded else []
            receipt = next(
                (
                    entry
                    for entry in history
                    if entry.operation == "rollback" and entry.backup_id == candidate
                ),
                None,
            )
            if receipt is None:
                return []
            candidate = receipt.subject
        return []

    def _repair_source(self, backup_id: str) -> str | None:
        """Find the repair snapshot whose exact pre-repair bytes an undo restores."""
        lineage = self._repair_history(backup_id)
        return lineage[-1] if lineage else None

    def _repair_asset(self, backup_id: str) -> InstalledAsset | None:
        """Load the asset identity and file scope from the recorded repair world."""
        source_id = self._repair_source(backup_id)
        if source_id is None:
            return None
        snapshot = self.files.inspect_backup(source_id)
        verified = dict(self.files.verify_backup(snapshot))
        registry_path = self.data_root / FLEET_REGISTRY_FILE
        contents = verified.get(registry_path)
        if contents is None:
            raise PermissionError("Repair snapshot does not contain the original registry")
        original = FleetSnapshot.model_validate_json(contents)
        receipt = next(
            entry
            for entry in self.audit_records(limit=0)
            if entry.operation == "repair" and entry.backup_id == source_id
        )
        return next((item for item in original.assets if item.id == receipt.subject), None)

    def _repair_drift_bytes(self, backup_id: str) -> dict[str, bytes | None]:
        """Return only byte states recorded by an audited repair snapshot."""
        asset = self._repair_asset(backup_id)
        if asset is None:
            return {}
        source_id = self._repair_source(backup_id)
        if source_id is None:
            raise ValueError("Repair snapshot provenance disappeared")
        snapshot = self.files.inspect_backup(source_id)
        contents = dict(self.files.verify_backup(snapshot))
        return {
            entry.path: contents[self.files.file("codex", entry.path)]
            for entry in snapshot.entries
            if entry.namespace == "codex" and entry.path in asset.file_hashes
        }

    def _reconcile_historical_asset(
        self,
        asset: InstalledAsset,
        included: set[str],
        verified: dict[Path, bytes | None],
        drift_targets: Mapping[str, bytes | None],
    ) -> None:
        for name, expected in asset.file_hashes.items():
            target = self.files.file("codex", name)
            if name in included:
                contents = verified.get(target)
            else:
                contents = target.read_bytes() if target.is_file() else None
                verified[target] = contents
                included.add(name)
            matches_hash = contents is not None and digest(contents) == expected
            matches_repair_snapshot = name in drift_targets and contents == drift_targets[name]
            if not matches_hash and not matches_repair_snapshot:
                raise PermissionError(
                    f"Historical backup cannot prove registered asset bytes: {name}"
                )

    def _scope_repair_backup(
        self,
        backup_id: str,
        verified: dict[Path, bytes | None],
        included: set[str],
    ) -> tuple[InstalledAsset | None, dict[Path, bytes | None], set[str]]:
        """Restrict repair history to the asset named by its durable audit receipt."""
        asset = self._repair_asset(backup_id)
        if asset is None:
            return None, verified, included
        registry_path = self.data_root / FLEET_REGISTRY_FILE
        saved_paths: set[str] = set()
        for identity in self._repair_history(backup_id):
            if identity == backup_id:
                contents = verified.get(registry_path)
            else:
                snapshot = self.files.inspect_backup(identity)
                contents = dict(self.files.verify_backup(snapshot)).get(registry_path)
            if contents is None:
                continue
            registry = FleetSnapshot.model_validate_json(contents)
            saved = next((item for item in registry.assets if item.id == asset.id), None)
            if saved is not None:
                saved_paths.update(saved.file_hashes)
        saved_paths.update(asset.file_hashes)
        included.intersection_update(saved_paths)
        selected_paths = {self.files.file("codex", name) for name in included}
        filtered = {
            path: value
            for path, value in verified.items()
            if path == registry_path or path in selected_paths
        }
        return asset, filtered, included

    def _checked_historical_backup(
        self, backup_id: str
    ) -> tuple[dict[Path, bytes | None], set[str], InstalledAsset | None]:
        """Prove owned bytes against old hashes, reconstructing safe legacy backups."""
        snapshot = self.files.inspect_backup(backup_id)
        verified = dict(self.files.verify_backup(snapshot))
        registry_path = self.data_root / FLEET_REGISTRY_FILE
        if registry_path not in verified:
            raise PermissionError("Snapshot does not contain the original registry")
        original_bytes = verified[registry_path]
        original = (
            FleetSnapshot.model_validate_json(original_bytes) if original_bytes else FleetSnapshot()
        )
        included = {entry.path for entry in snapshot.entries if entry.namespace == "codex"}
        repair_asset, verified, included = self._scope_repair_backup(backup_id, verified, included)
        original_drift = self._repair_drift_bytes(backup_id) if repair_asset else {}
        for asset in original.assets:
            if repair_asset is not None:
                if asset.id == repair_asset.id:
                    self._verify_repair_snapshot_asset(asset, included, verified, original_drift)
                continue
            self._reconcile_historical_asset(asset, included, verified, original_drift)
        return verified, included, repair_asset

    def _verify_repair_snapshot_asset(
        self,
        asset: InstalledAsset,
        included: set[str],
        verified: Mapping[Path, bytes | None],
        drift_targets: Mapping[str, bytes | None],
    ) -> None:
        """Verify captured repair paths without requiring untouched files in the snapshot."""
        for name, expected in asset.file_hashes.items():
            if name not in included:
                continue
            contents = verified.get(self.files.file("codex", name))
            matches_hash = contents is not None and digest(contents) == expected
            matches_repair_snapshot = name in drift_targets and contents == drift_targets[name]
            if not matches_hash and not matches_repair_snapshot:
                raise PermissionError(
                    f"Historical backup cannot prove registered asset bytes: {name}"
                )

    def _rollback_effects(
        self,
        repair_scope: bool,
        current_paths: set[str],
        included: set[str],
    ) -> tuple[set[str], set[str]]:
        """Limit repair undo to the selected asset and preserve unrelated inventory."""
        removals = set[str]() if repair_scope else current_paths - included
        affected = included if repair_scope else included | removals
        return removals, affected

    def _repair_rollback_paths(
        self,
        current: FleetSnapshot,
        repair_asset: InstalledAsset,
        included: set[str],
        require_registered: bool,
    ) -> None:
        """Validate repair ownership and retain later paths for exact undo snapshots."""
        current_asset = self._repair_current_asset(current, repair_asset, require_registered)
        self._reject_paths_owned_by_other_assets(current, repair_asset, included)
        current_paths: set[str] = (
            set(current_asset.file_hashes) if current_asset is not None else set()
        )
        self._reject_unowned_repair_targets(included, current_paths)

    @staticmethod
    def _repair_current_asset(
        current: FleetSnapshot,
        repair_asset: InstalledAsset,
        require_registered: bool,
    ) -> InstalledAsset | None:
        """Require the repaired asset's original registration when directly undoing repair."""
        current_asset = next((item for item in current.assets if item.id == repair_asset.id), None)
        if current_asset is None and require_registered:
            raise PermissionError("Repair asset is no longer registered")
        if (
            require_registered
            and current_asset is not None
            and any(
                current_asset.file_hashes.get(name) != expected
                for name, expected in repair_asset.file_hashes.items()
            )
        ):
            raise PermissionError("Repair asset's original targets changed after repair")
        return current_asset

    @staticmethod
    def _reject_paths_owned_by_other_assets(
        current: FleetSnapshot, repair_asset: InstalledAsset, included: set[str]
    ) -> None:
        """Reject any historical restore path now claimed by another asset."""
        other_paths = {
            name
            for item in current.assets
            if item.id != repair_asset.id
            for name in item.file_hashes
        }
        if included & other_paths:
            raise PermissionError("Restore path is owned by another registered asset")

    def _reject_unowned_repair_targets(self, included: set[str], current_paths: set[str]) -> None:
        """Reject writing a repair history path that no current asset owns."""
        for name in included - current_paths:
            if self.files.file("codex", name).exists():
                raise PermissionError(f"Repair rollback would overwrite unowned file: {name}")

    def _verify_rollback_targets(
        self, current: FleetSnapshot, affected: set[str], known_drift: Mapping[str, bytes | None]
    ) -> None:
        for asset in current.assets:
            self._verify_owned(asset, affected, known_drift)

    def _check_unowned_restore_targets(self, included: set[str], current_paths: set[str]) -> None:
        for name in included - current_paths:
            path = self.files.file("codex", name)
            if path.exists():
                raise PermissionError(f"Historical restore would overwrite unowned file: {name}")

    def _rollback_plan(self, backup_id: str) -> tuple[dict[Path, bytes | None], list[str]]:
        """Build an exact old-world image, including files added after that snapshot."""
        snapshot = self.files.inspect_backup(backup_id)
        verified, included, repair_asset = self._checked_historical_backup(backup_id)
        registry_path = self.data_root / FLEET_REGISTRY_FILE
        current = self.load()
        current_paths = {name for asset in current.assets for name in asset.file_hashes}
        repair_scope = repair_asset is not None
        repair_removals: set[str] = set()
        if repair_asset is not None:
            saved_bytes = verified.get(registry_path)
            saved = (
                FleetSnapshot.model_validate_json(saved_bytes) if saved_bytes else FleetSnapshot()
            )
            if snapshot.operation == "repair":
                desired_registry = current
            else:
                desired_registry = self._merge_repair_registration(current, saved, repair_asset.id)
            desired_asset = next(
                (item for item in desired_registry.assets if item.id == repair_asset.id), None
            )
            self._repair_rollback_paths(
                current, repair_asset, included, snapshot.operation == "repair"
            )
            self._verify_untouched_repair_paths(current, repair_asset, desired_asset, included)
            repair_removals = self._repair_paths_to_remove(current, desired_registry, repair_asset)
            verified[registry_path] = self._registry_bytes(desired_registry)
        removals, affected = self._rollback_effects(repair_scope, current_paths, included)
        removals.update(repair_removals)
        affected.update(repair_removals)
        known_drift = self._repair_drift_bytes(backup_id) if repair_scope else {}
        self._verify_rollback_targets(current, affected, known_drift)
        self._check_unowned_restore_targets(included, current_paths)
        for name in removals:
            verified[self.files.file("codex", name)] = None
        return verified, sorted(affected)

    def _verify_untouched_repair_paths(
        self,
        current: FleetSnapshot,
        repair_asset: InstalledAsset,
        desired_asset: InstalledAsset | None,
        included: set[str],
    ) -> None:
        """Prove desired paths omitted from this backup remain safe and registered."""
        if desired_asset is None:
            return
        current_asset = next((item for item in current.assets if item.id == desired_asset.id), None)
        current_paths: set[str] = (
            set(current_asset.file_hashes) if current_asset is not None else set()
        )
        self._reject_paths_owned_by_other_assets(
            current, repair_asset, set(desired_asset.file_hashes) - included
        )
        for name in set(desired_asset.file_hashes) - included:
            expected = desired_asset.file_hashes[name]
            if name in current_paths:
                if current_asset is not None and current_asset.file_hashes.get(name) != expected:
                    raise PermissionError(f"Repair rollback registration changed: {name}")
                continue
            target = self.files.file("codex", name)
            if not target.is_file() or digest(target.read_bytes()) != expected:
                raise PermissionError(f"Repair rollback cannot prove untouched target: {name}")

    @staticmethod
    def _merge_repair_registration(
        current: FleetSnapshot, saved: FleetSnapshot, asset_id: str
    ) -> FleetSnapshot:
        """Restore one selected asset version while preserving the remaining fleet."""
        registered = next((item for item in saved.assets if item.id == asset_id), None)
        merged = current.model_copy(deep=True)
        merged.assets = [item for item in merged.assets if item.id != asset_id]
        if registered is not None:
            merged.assets.append(registered)
        return merged

    def _repair_paths_to_remove(
        self,
        current: FleetSnapshot,
        desired: FleetSnapshot,
        repair_asset: InstalledAsset,
    ) -> set[str]:
        """Find later selected-asset paths absent from the exact target registration."""
        current_asset = next((item for item in current.assets if item.id == repair_asset.id), None)
        if current_asset is None:
            return set()
        desired_asset = next((item for item in desired.assets if item.id == repair_asset.id), None)
        desired_paths: set[str] = (
            set(desired_asset.file_hashes) if desired_asset is not None else set()
        )
        removals = set(current_asset.file_hashes) - desired_paths
        self._reject_paths_owned_by_other_assets(current, repair_asset, removals)
        self._verify_repair_removal_bytes(current_asset, removals)
        return removals

    def _verify_repair_removal_bytes(self, asset: InstalledAsset, removals: set[str]) -> None:
        """Require current managed bytes before deleting paths during repair undo."""
        for name in removals:
            target = self.files.file("codex", name)
            expected = asset.file_hashes[name]
            if not target.is_file() or digest(target.read_bytes()) != expected:
                raise PermissionError(f"Repair rollback target has drifted: {name}")

    def rollback(self, backup_id: str, *, preview_token: str | None = None) -> str:
        """All-or-nothing historical restore with a byte-exact undo snapshot."""
        with self._locked():
            desired, paths = self._rollback_plan(backup_id)
            if preview_token is not None and preview_token != self._rollback_token(desired):
                raise PermissionError("Backup or installed files changed after approval")
            undo = self.files.backup("rollback", paths)
            original_bytes = self.files.verify_backup(undo)
            try:
                self.files.restore(list(desired.items()))
                self._record("rollback", backup_id, undo.id)
            except Exception:
                try:
                    self.files.restore_written(original_bytes, desired)
                except Exception as exc:
                    raise RuntimeError(
                        f"Rollback failed and undo restoration is blocked; snapshot: {undo.id}"
                    ) from exc
                raise
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
