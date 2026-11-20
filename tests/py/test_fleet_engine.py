"""Isolated real filesystem and Git regression tests for the global fleet."""

import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

import pytest
from pydantic import ValidationError

from rill_cli.core import assets_mgr, fleet
from rill_cli.core.constants import FLEET_ASSET_MANIFEST, FLEET_REGISTRY_FILE
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.git_policy import git
from rill_cli.core.models import AgentAssetManifest, AssetFile, GitHubReleaseAsset


@pytest.fixture
def engine(tmp_path: Path) -> FleetEngine:
    return FleetEngine(data_root=tmp_path / "xdg-data", codex_root=tmp_path / "home/.codex")


def bundle(
    tmp_path: Path,
    *,
    version: str = "1.0.0",
    payload: bytes = b"# Skill\n",
    extra_file: bool = False,
    extra_payload: bytes = b"# Added in v2\n",
) -> Path:
    root = tmp_path / f"asset-{version}"
    root.mkdir()
    source = root / "contents/SKILL.md"
    source.parent.mkdir()
    source.write_bytes(payload)
    files = [
        AssetFile(
            source="contents/SKILL.md",
            target="skills/demo/SKILL.md",
            sha256=hashlib.sha256(payload).hexdigest(),
        )
    ]
    if extra_file:
        (root / "contents/EXTRA.md").write_bytes(extra_payload)
        files.append(
            AssetFile(
                source="contents/EXTRA.md",
                target="skills/demo/EXTRA.md",
                sha256=hashlib.sha256(extra_payload).hexdigest(),
            )
        )
    manifest = AgentAssetManifest(
        id="demo-skill",
        name="Demo skill",
        kind="skill",
        version=version,
        files=files,
    )
    (root / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json(), encoding="utf-8")
    return root


def test_registry_and_audit_are_isolated_and_backed_up(engine: FleetEngine, tmp_path: Path) -> None:
    repository = tmp_path / "project"
    repository.mkdir()
    git(repository, "init", "-q", "-b", "main")
    project = engine.register_project(repository, name="real project")
    assert engine.load().projects[0].id == project.id
    first = engine.audit_records()[0]
    assert first.operation == "register" and first.backup_id is not None
    assert engine.files.inspect_backup(first.backup_id).entries[0].existed is False
    registry_before = (engine.data_root / FLEET_REGISTRY_FILE).read_bytes()
    engine.unregister_project(project.id)
    assert engine.load().projects == []
    previous = engine.audit_records()[-1]
    assert previous.backup_id is not None
    undo = engine.rollback(previous.backup_id)
    assert undo != previous.backup_id
    assert (engine.data_root / FLEET_REGISTRY_FILE).read_bytes() == registry_before
    assert engine.load().projects[0].path == repository
    assert engine.audit_records()[-1].operation == "rollback"


def test_bundle_install_upgrade_retire_and_byte_exact_rollback(
    engine: FleetEngine, tmp_path: Path
) -> None:
    initial = bundle(tmp_path)
    installed = engine.install_bundle(initial)
    target = engine.codex_root / "skills/demo/SKILL.md"
    assert installed.version == "1.0.0" and target.read_bytes() == b"# Skill\n"
    original_registry = (engine.data_root / FLEET_REGISTRY_FILE).read_bytes()
    newer = bundle(tmp_path, version="1.1.0", payload=b"# New skill\n")
    upgraded = engine.upgrade_bundle(newer)
    assert upgraded.version == "1.1.0" and target.read_bytes() == b"# New skill\n"
    record = engine.audit_records()[-1]
    assert record.operation == "upgrade" and record.backup_id is not None
    engine.rollback(record.backup_id)
    assert target.read_bytes() == b"# Skill\n"
    assert (engine.data_root / FLEET_REGISTRY_FILE).read_bytes() == original_registry
    engine.retire_asset(installed.id)
    assert not target.exists() and not engine.load().assets
    removed = engine.audit_records()[-1]
    assert removed.backup_id is not None
    engine.rollback(removed.backup_id)
    assert target.read_bytes() == b"# Skill\n"


def test_asset_integrity_precedes_global_mutation(engine: FleetEngine, tmp_path: Path) -> None:
    root = bundle(tmp_path)
    (root / "contents/SKILL.md").write_text("Tampered\n", encoding="utf-8")
    with pytest.raises(ValueError, match="digest mismatch"):
        engine.install_bundle(root)
    assert not engine.codex_root.exists()
    assert not (engine.data_root / FLEET_REGISTRY_FILE).exists()


def test_existing_unowned_codex_file_is_preserved(engine: FleetEngine, tmp_path: Path) -> None:
    destination = engine.codex_root / "skills/demo/SKILL.md"
    destination.parent.mkdir(parents=True)
    original = b"Owner-managed global skill\n"
    destination.write_bytes(original)
    with pytest.raises(PermissionError, match="unowned"):
        engine.install_bundle(bundle(tmp_path))
    assert destination.read_bytes() == original
    assert engine.load().assets == []


def test_drift_refuses_upgrade_retire_but_explicit_repair_can_restore(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"Human modification\n")
    with pytest.raises(PermissionError, match="drift"):
        engine.retire_asset(installed.id)
    with pytest.raises(PermissionError, match="drift"):
        engine.upgrade_bundle(bundle(tmp_path, version="1.1.0", payload=b"new"))
    assert target.read_bytes() == b"Human modification\n"
    engine.repair_asset(installed.id)
    assert target.read_bytes() == b"# Skill\n"
    backup_id = engine.audit_records()[-1].backup_id
    assert backup_id is not None
    engine.rollback(backup_id)
    assert target.read_bytes() == b"Human modification\n"


def test_corrupt_backup_fails_without_touching_assets(engine: FleetEngine, tmp_path: Path) -> None:
    engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    engine.retire_asset("demo-skill")
    backup_id = engine.audit_records()[-1].backup_id
    assert backup_id is not None
    snapshot = engine.files.inspect_backup(backup_id)
    codex_entry = next(entry for entry in snapshot.entries if entry.namespace == "codex")
    (engine.data_root / "backups" / backup_id / "codex" / codex_entry.path).write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="Corrupted backup"):
        engine.rollback(backup_id)
    assert not target.exists()


def test_registry_never_loads_demo_assets(engine: FleetEngine) -> None:
    assert engine.load().assets == []
    assert engine.audit_records() == []
    assert engine.backups() == []
    assert json.loads(engine.load().model_dump_json())["demo"] is False


def test_partial_install_failure_restores_original_files(
    engine: FleetEngine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = bundle(tmp_path)
    actual_write = fleet.atomic_write
    target = engine.codex_root / "skills/demo/SKILL.md"

    def fail_after_first_write(path: Path, contents: bytes) -> None:
        actual_write(path, contents)
        if path == target:
            raise OSError("Injected failure after global file replacement")

    monkeypatch.setattr(fleet, "atomic_write", fail_after_first_write)
    with pytest.raises(OSError, match="Injected failure"):
        engine.install_bundle(root)
    assert not target.exists()
    assert not (engine.data_root / FLEET_REGISTRY_FILE).exists()
    assert len(engine.backups()) == 1


def test_concurrent_external_write_is_never_deleted_on_failed_install(
    engine: FleetEngine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = bundle(tmp_path)
    actual_write = fleet.atomic_write
    target = engine.codex_root / "skills/demo/SKILL.md"

    def concurrent_write(path: Path, contents: bytes) -> None:
        actual_write(path, contents)
        if path == target:
            path.write_bytes(b"Concurrent owner change\n")
            raise OSError("Concurrent interruption")

    monkeypatch.setattr(fleet, "atomic_write", concurrent_write)
    with pytest.raises(RuntimeError, match="Concurrent file change"):
        engine.install_bundle(source)
    assert target.read_bytes() == b"Concurrent owner change\n"
    assert not (engine.data_root / FLEET_REGISTRY_FILE).exists()


def test_repaired_global_config_has_byte_exact_backup(engine: FleetEngine, tmp_path: Path) -> None:
    root = tmp_path / "mcp-bundle"
    root.mkdir()
    (root / "config.toml").write_bytes(b"[mcp_servers.example]\nurl = 'http://localhost'\n")
    original = (root / "config.toml").read_bytes()
    manifest = AgentAssetManifest(
        id="example-mcp",
        name="Example MCP",
        kind="mcp",
        version="1.0.0",
        files=[
            AssetFile(
                source="config.toml",
                target="config.toml",
                sha256=hashlib.sha256(original).hexdigest(),
            )
        ],
    )
    (root / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json(), encoding="utf-8")
    engine.install_bundle(root)
    target = engine.codex_root / "config.toml"
    target.write_bytes(b"External configuration drift\n")
    engine.repair_asset("example-mcp")
    assert target.read_bytes() == original
    backup = engine.audit_records()[-1].backup_id
    assert backup is not None
    undo = engine.rollback(backup)
    assert target.read_bytes() == b"External configuration drift\n"
    engine.rollback(undo)
    assert target.read_bytes() == original
    assert (
        engine.load().assets[0].file_hashes["config.toml"] == hashlib.sha256(original).hexdigest()
    )


def test_repair_of_one_asset_is_not_blocked_by_unrelated_drift(
    engine: FleetEngine, tmp_path: Path
) -> None:
    selected = engine.install_bundle(bundle(tmp_path))
    engine.install_bundle(secondary_bundle(tmp_path))
    selected_path = engine.codex_root / "skills/demo/SKILL.md"
    independent_path = engine.codex_root / "skills/independent/SKILL.md"
    independent_path.write_bytes(b"Unrelated external drift\n")

    repaired = engine.repair_asset(selected.id)

    assert repaired.id == selected.id
    assert selected_path.read_bytes() == b"# Skill\n"
    assert independent_path.read_bytes() == b"Unrelated external drift\n"


def test_repair_rollback_restores_originally_absent_target(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.unlink()

    engine.repair_asset(installed.id)
    backup = engine.audit_records()[-1].backup_id
    assert backup is not None

    engine.rollback(backup)

    assert not target.exists()


def test_repair_rollback_preserves_later_changes_to_unrelated_assets(
    engine: FleetEngine, tmp_path: Path
) -> None:
    selected = engine.install_bundle(bundle(tmp_path))
    engine.install_bundle(secondary_bundle(tmp_path))
    selected_path = engine.codex_root / "skills/demo/SKILL.md"
    selected_path.write_bytes(b"External drift before repair\n")
    engine.repair_asset(selected.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    later = secondary_bundle(tmp_path, version="2.0.0", payload=b"# Independent v2\n")
    engine.upgrade_bundle(later)

    engine.rollback(repair_backup)

    independent = next(asset for asset in engine.load().assets if asset.id == "independent-skill")
    independent_path = engine.codex_root / "skills/independent/SKILL.md"
    assert independent.version == "2.0.0"
    assert independent_path.read_bytes() == b"# Independent v2\n"
    assert selected_path.read_bytes() == b"External drift before repair\n"


def test_repair_snapshot_provenance_survives_multiple_undo_generations(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None

    undo_repair = engine.rollback(repair_backup)
    undo_undo = engine.rollback(undo_repair)
    undo_repair_again = engine.rollback(undo_undo)

    assert target.read_bytes() == b"External drift before repair\n"
    engine.rollback(undo_repair_again)
    assert target.read_bytes() == b"# Skill\n"


def test_repair_rollback_rejects_path_reowned_after_asset_retirement(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    engine.retire_asset(installed.id)
    engine.install_bundle(replacement_bundle(tmp_path))
    replacement = target.read_bytes()
    registry = engine.load()

    with pytest.raises(PermissionError, match="no longer registered"):
        engine.rollback(repair_backup)

    assert target.read_bytes() == replacement
    assert engine.load() == registry


def test_repair_rollback_and_undo_preserve_files_added_by_upgrade(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    engine.upgrade_bundle(bundle(tmp_path, version="2.0.0", extra_file=True))
    extra = engine.codex_root / "skills/demo/EXTRA.md"

    undo = engine.rollback(repair_backup)

    assert target.read_bytes() == b"External drift before repair\n"
    assert extra.read_bytes() == b"# Added in v2\n"
    assert engine.load().assets[0].version == "2.0.0"
    engine.rollback(undo)
    assert target.read_bytes() == b"# Skill\n"
    assert extra.read_bytes() == b"# Added in v2\n"
    assert engine.load().assets[0].version == "2.0.0"


def test_repair_undo_rejects_new_owner_of_later_upgrade_path(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    engine.upgrade_bundle(bundle(tmp_path, version="2.0.0", extra_file=True))
    undo = engine.rollback(repair_backup)
    redo = engine.rollback(undo)
    engine.upgrade_bundle(bundle(tmp_path, version="3.0.0"))
    engine.install_bundle(replacement_bundle(tmp_path, target="skills/demo/EXTRA.md"))
    extra = engine.codex_root / "skills/demo/EXTRA.md"
    replacement = extra.read_bytes()
    registry = engine.load()

    with pytest.raises(PermissionError, match="owned by another registered asset"):
        engine.rollback(redo)

    assert extra.read_bytes() == replacement
    assert engine.load() == registry


def test_repair_undo_removes_files_added_after_undo_snapshot(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    undo = engine.rollback(repair_backup)
    redo = engine.rollback(undo)
    engine.upgrade_bundle(bundle(tmp_path, version="2.0.0", extra_file=True))
    extra = engine.codex_root / "skills/demo/EXTRA.md"

    engine.rollback(redo)

    assert target.read_bytes() == b"External drift before repair\n"
    assert not extra.exists()
    assert engine.load().assets[0].version == "1.0.0"


def test_repair_undo_preserves_drifted_file_added_after_snapshot(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    undo = engine.rollback(repair_backup)
    redo = engine.rollback(undo)
    engine.upgrade_bundle(bundle(tmp_path, version="2.0.0", extra_file=True))
    extra = engine.codex_root / "skills/demo/EXTRA.md"
    extra.write_bytes(b"Concurrent edit\n")
    registry = engine.load()

    with pytest.raises(PermissionError, match="target has drifted"):
        engine.rollback(redo)

    assert extra.read_bytes() == b"Concurrent edit\n"
    assert engine.load() == registry


def test_repair_rollback_undo_preserves_drifted_later_file(
    engine: FleetEngine, tmp_path: Path
) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    engine.upgrade_bundle(bundle(tmp_path, version="2.0.0", extra_file=True))
    extra = engine.codex_root / "skills/demo/EXTRA.md"
    extra.write_bytes(b"Concurrent edit\n")

    undo = engine.rollback(repair_backup)

    assert target.read_bytes() == b"External drift before repair\n"
    assert extra.read_bytes() == b"Concurrent edit\n"
    engine.rollback(undo)
    assert target.read_bytes() == b"# Skill\n"
    assert extra.read_bytes() == b"Concurrent edit\n"
    assert engine.load().assets[0].version == "2.0.0"


def test_repair_undo_rejects_later_managed_hash_change(engine: FleetEngine, tmp_path: Path) -> None:
    installed = engine.install_bundle(bundle(tmp_path))
    target = engine.codex_root / "skills/demo/SKILL.md"
    target.write_bytes(b"External drift before repair\n")
    engine.repair_asset(installed.id)
    repair_backup = engine.audit_records()[-1].backup_id
    assert repair_backup is not None
    engine.upgrade_bundle(bundle(tmp_path, version="2.0.0", extra_file=True))
    undo = engine.rollback(repair_backup)
    redo = engine.rollback(undo)
    engine.upgrade_bundle(
        bundle(
            tmp_path,
            version="3.0.0",
            extra_file=True,
            extra_payload=b"# Changed in v3\n",
        )
    )
    extra = engine.codex_root / "skills/demo/EXTRA.md"
    upgraded_bytes = extra.read_bytes()
    registry = engine.load()

    with pytest.raises(PermissionError, match="registration changed"):
        engine.rollback(redo)

    assert extra.read_bytes() == upgraded_bytes
    assert engine.load() == registry


def test_symlinked_codex_home_is_rejected_before_root_resolution(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    actual = tmp_path / "actual-codex"
    actual.mkdir()
    alias = tmp_path / "codex-alias"
    alias.symlink_to(actual, target_is_directory=True)
    monkeypatch.setenv("CODEX_HOME", str(alias))
    engine = FleetEngine(data_root=tmp_path / "data")

    with pytest.raises(PermissionError, match="root is a symlink"):
        engine.install_bundle(bundle(tmp_path))


def test_release_archive_rejects_path_traversal(engine: FleetEngine, tmp_path: Path) -> None:
    archive = tmp_path / "malicious.tar.gz"
    with tarfile.open(archive, "w:gz") as handle:
        dangerous = tarfile.TarInfo("../../escape.txt")
        dangerous.size = len(b"escape")
        handle.addfile(dangerous, io.BytesIO(b"escape"))
    with pytest.raises(ValueError, match="relative"):
        engine.install_archive(archive)
    assert not (tmp_path / "escape.txt").exists()


def test_valid_tarball_installs_via_native_archive_reader(
    engine: FleetEngine, tmp_path: Path
) -> None:
    source = bundle(tmp_path)
    archive = tmp_path / "asset.tar.gz"
    with tarfile.open(archive, "w:gz") as handle:
        for file in source.rglob("*"):
            if file.is_file():
                handle.add(file, arcname=file.relative_to(source).as_posix())
    result = engine.install_archive(archive)
    assert result.id == "demo-skill"
    assert (engine.codex_root / "skills/demo/SKILL.md").read_bytes() == b"# Skill\n"


def test_native_mcp_probe_never_exposes_secret_environment(
    engine: FleetEngine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = bundle(tmp_path)
    manifest_file = source / FLEET_ASSET_MANIFEST
    raw: dict[str, object] = json.loads(manifest_file.read_text(encoding="utf-8"))
    raw["mcp_servers"] = ["test-server", "missing-server"]
    manifest_file.write_text(json.dumps(raw), encoding="utf-8")
    engine.install_bundle(source)
    expected = json.dumps(
        [
            {
                "name": "test-server",
                "enabled": True,
                "transport": {"env": {"API_KEY": "TOP_SECRET_TEST"}},
            },
        ]
    )

    def fake_which(name: str) -> str | None:
        return "/usr/bin/codex" if name == "codex" else None

    def fake_run(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args=[], returncode=0, stdout=expected)

    monkeypatch.setattr(fleet.shutil, "which", fake_which)
    monkeypatch.setattr(fleet.subprocess, "run", fake_run)
    report = engine.inspect()
    result = report["mcp"]
    assert isinstance(result, dict)
    assert result["configured"] == ["test-server"]
    assert result["missing"] == ["missing-server"]
    assert result["connectivity"] == "unverified"
    assert "TOP_SECRET_TEST" not in json.dumps(result)


def test_git_release_asset_schema_rejects_unsafe_references() -> None:
    for repo, tag, asset in (
        ("../bad", "v1", "asset.tar.gz"),
        ("owner/repo", "--help", "asset.tar.gz"),
        ("owner/repo", "v1", "../../payload.tar.gz"),
        ("owner/repo", "v1", "payload.zip"),
    ):
        with pytest.raises(ValidationError):
            GitHubReleaseAsset(repository=repo, tag=tag, asset=asset, sha256="a" * 64)


def test_symlink_bundle_is_rejected(engine: FleetEngine, tmp_path: Path) -> None:
    root = bundle(tmp_path)
    original = root / "contents/SKILL.md"
    original.rename(root / "replacement.md")
    original.symlink_to(root / "replacement.md")
    with pytest.raises(PermissionError, match=r"Unsafe asset|symlink"):
        engine.install_bundle(root)
    assert engine.load().assets == []


def test_old_snapshot_rollback_removes_later_asset_without_orphaning(
    engine: FleetEngine, tmp_path: Path
) -> None:
    engine.install_bundle(bundle(tmp_path))
    original = (engine.data_root / FLEET_REGISTRY_FILE).read_bytes()
    first_target = engine.codex_root / "skills/demo/SKILL.md"
    other = tmp_path / "other-asset"
    other.mkdir()
    (other / "SKILL.md").write_bytes(b"# Later asset\n")
    manifest = AgentAssetManifest(
        id="other-skill",
        name="Other skill",
        kind="skill",
        version="1.0.0",
        files=[
            AssetFile(
                source="SKILL.md",
                target="skills/other/SKILL.md",
                sha256=hashlib.sha256(b"# Later asset\n").hexdigest(),
            )
        ],
    )
    (other / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json())
    engine.install_bundle(other)
    later_target = engine.codex_root / "skills/other/SKILL.md"
    assert later_target.exists()
    backup = engine.audit_records()[-1].backup_id
    assert backup is not None
    engine.rollback(backup)
    assert (engine.data_root / FLEET_REGISTRY_FILE).read_bytes() == original
    assert first_target.read_bytes() == b"# Skill\n"
    assert not later_target.exists()
    assert [asset.id for asset in engine.load().assets] == ["demo-skill"]


def test_partial_rollback_failure_undoes_registry_and_all_written_assets(
    engine: FleetEngine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine.install_bundle(bundle(tmp_path))
    engine.upgrade_bundle(bundle(tmp_path, version="1.1.0", payload=b"# Updated\n"))
    previous = engine.audit_records()[-1].backup_id
    assert previous is not None
    registry = (engine.data_root / FLEET_REGISTRY_FILE).read_bytes()
    target = engine.codex_root / "skills/demo/SKILL.md"
    current = target.read_bytes()
    real_write = assets_mgr.atomic_write
    failed = False

    def fail_once_after_write(path: Path, contents: bytes) -> None:
        nonlocal failed
        real_write(path, contents)
        if path == target and not failed:
            failed = True
            raise OSError("simulated power loss mid-rollback")

    monkeypatch.setattr(assets_mgr, "atomic_write", fail_once_after_write)
    with pytest.raises(OSError, match="power loss"):
        engine.rollback(previous)
    assert failed
    assert target.read_bytes() == current
    assert (engine.data_root / FLEET_REGISTRY_FILE).read_bytes() == registry
    assert engine.load().assets[0].version == "1.1.0"
    assert engine.audit_records()[-1].operation == "upgrade"
    assert engine.backups()


def test_repair_rejects_valid_but_replaced_cached_bundle(
    engine: FleetEngine, tmp_path: Path
) -> None:
    asset = engine.install_bundle(bundle(tmp_path))
    cache = Path(asset.source)
    changed = b"# Different approved version's bytes\n"
    (cache / "contents/SKILL.md").write_bytes(changed)
    manifest_path = cache / FLEET_ASSET_MANIFEST
    manifest = AgentAssetManifest.model_validate_json(manifest_path.read_bytes())
    changed_manifest = manifest.model_copy(
        update={
            "files": [
                manifest.files[0].model_copy(update={"sha256": hashlib.sha256(changed).hexdigest()})
            ]
        }
    )
    manifest_path.write_text(changed_manifest.model_dump_json())
    with pytest.raises(PermissionError, match="registered file hashes"):
        engine.repair_asset(asset.id)
    assert (engine.codex_root / "skills/demo/SKILL.md").read_bytes() == b"# Skill\n"


def test_codex_home_uses_native_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    location = tmp_path / "alternate-codex"
    monkeypatch.setenv("CODEX_HOME", str(location))
    instance = FleetEngine(data_root=tmp_path / "data")
    assert instance.codex_root == location
    assert not location.exists()


def test_alias_within_codex_root_is_denied(engine: FleetEngine, tmp_path: Path) -> None:
    engine.codex_root.mkdir(parents=True)
    (engine.codex_root / "real-skills").mkdir()
    (engine.codex_root / "skills").symlink_to(engine.codex_root / "real-skills")
    with pytest.raises(PermissionError, match="symlink"):
        engine.install_bundle(bundle(tmp_path))
    assert engine.load().assets == []


def test_incomplete_cache_write_can_retry_without_poisoned_version(
    engine: FleetEngine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = bundle(tmp_path)
    actual_write = fleet.atomic_write
    failed = False

    def transient(path: Path, contents: bytes) -> None:
        nonlocal failed
        if path.name == "SKILL.md" and "rill-bundle-" in str(path) and not failed:
            failed = True
            raise OSError("simulated interrupted cache publish")
        actual_write(path, contents)

    monkeypatch.setattr(fleet, "atomic_write", transient)
    with pytest.raises(OSError, match="interrupted cache"):
        engine.install_bundle(source)
    cache = engine.data_root / "bundles/demo-skill/1.0.0"
    assert failed and not cache.exists()
    assert not (engine.codex_root / "skills/demo/SKILL.md").exists()
    installed = engine.install_bundle(source)
    assert Path(installed.source) == cache
    assert (cache / "contents/SKILL.md").read_bytes() == b"# Skill\n"


def test_tui_bundle_approval_refuses_valid_payload_changed_after_preview(
    engine: FleetEngine, tmp_path: Path
) -> None:
    source = bundle(tmp_path)
    preview = engine.preview_bundle(source)
    token = preview["token"]
    assert isinstance(token, str)
    replacement = b"# Replaced after approval\n"
    (source / "contents/SKILL.md").write_bytes(replacement)
    manifest_path = source / FLEET_ASSET_MANIFEST
    manifest = AgentAssetManifest.model_validate_json(manifest_path.read_bytes())
    manifest_path.write_text(
        manifest.model_copy(
            update={
                "files": [
                    manifest.files[0].model_copy(
                        update={"sha256": hashlib.sha256(replacement).hexdigest()}
                    )
                ]
            }
        ).model_dump_json()
    )
    with pytest.raises(PermissionError, match="changed after approval"):
        engine.install_bundle(source, preview_token=token)
    assert not (engine.codex_root / "skills/demo/SKILL.md").exists()
    assert engine.load().assets == []


def test_registry_change_after_bundle_approval_requires_new_preview(
    engine: FleetEngine, tmp_path: Path
) -> None:
    source = bundle(tmp_path)
    token = engine.preview_bundle(source)["token"]
    assert isinstance(token, str)
    repository = tmp_path / "another-project"
    repository.mkdir()
    git(repository, "init", "-q", "-b", "main")
    engine.register_project(repository)
    with pytest.raises(PermissionError, match="changed after approval"):
        engine.install_bundle(source, preview_token=token)
    assert engine.load().assets == []
    assert engine.load().projects[0].path == repository


def test_rollback_and_retire_approval_invalidates_after_new_registration(
    engine: FleetEngine, tmp_path: Path
) -> None:
    asset = engine.install_bundle(bundle(tmp_path))
    retire = engine.preview_retire(asset.id)
    retire_token = retire["token"]
    assert isinstance(retire_token, str)
    repository = tmp_path / "newer-project"
    repository.mkdir()
    git(repository, "init", "-q", "-b", "main")
    engine.register_project(repository)
    with pytest.raises(PermissionError, match="changed after retire approval"):
        engine.retire_asset(asset.id, preview_token=retire_token)
    assert engine.load().assets[0].id == asset.id
    previous = engine.audit_records()[-1].backup_id
    assert previous is not None
    token = engine.preview_backup(previous)["token"]
    assert isinstance(token, str)
    engine.unregister_project(engine.load().projects[0].id)
    with pytest.raises(PermissionError, match="changed after approval"):
        engine.rollback(previous, preview_token=token)
    assert engine.load().assets[0].id == asset.id
    assert not engine.load().projects


def secondary_bundle(
    tmp_path: Path,
    *,
    version: str = "1.0.0",
    payload: bytes = b"# Independent skill\n",
) -> Path:
    """A separate installed owner, to test whole-fleet snapshot coverage."""
    root = tmp_path / "separate-owner"
    root.mkdir(exist_ok=True)
    (root / "SKILL.md").write_bytes(payload)
    manifest = AgentAssetManifest(
        id="independent-skill",
        name="Independent skill",
        kind="skill",
        version=version,
        files=[
            AssetFile(
                source="SKILL.md",
                target="skills/independent/SKILL.md",
                sha256=hashlib.sha256(payload).hexdigest(),
            )
        ],
    )
    (root / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json())
    return root


def replacement_bundle(tmp_path: Path, *, target: str = "skills/demo/SKILL.md") -> Path:
    root = tmp_path / "replacement-owner"
    root.mkdir()
    contents = b"# Replacement skill\n"
    (root / "SKILL.md").write_bytes(contents)
    manifest = AgentAssetManifest(
        id="replacement-skill",
        name="Replacement skill",
        kind="skill",
        version="1.0.0",
        files=[
            AssetFile(
                source="SKILL.md",
                target=target,
                sha256=hashlib.sha256(contents).hexdigest(),
            )
        ],
    )
    (root / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json())
    return root


def test_alternate_codex_homes_get_separate_native_registry_namespaces(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_user_data_path(*_args: object, **_kwargs: object) -> Path:
        return tmp_path / "native"

    monkeypatch.setattr(fleet, "user_data_path", fake_user_data_path)
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / "first-codex"))
    first = FleetEngine()
    repository = tmp_path / "worktree"
    repository.mkdir()
    git(repository, "init", "-q", "-b", "main")
    first.register_project(repository)
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / "second-codex"))
    second = FleetEngine()
    assert first.data_root != second.data_root
    assert first.load().projects[0].path == repository
    assert second.load().projects == []
    assert second.backups() == []
    assert not second.codex_root.exists()


def test_legacy_partial_snapshot_restores_if_omitted_owner_is_provably_unchanged(
    engine: FleetEngine,
    tmp_path: Path,
) -> None:
    engine.install_bundle(bundle(tmp_path))
    engine.install_bundle(secondary_bundle(tmp_path))
    earlier_registry = (engine.data_root / FLEET_REGISTRY_FILE).read_bytes()
    partial = engine.files.backup("upgrade", ["skills/demo/SKILL.md"])
    engine.upgrade_bundle(bundle(tmp_path, version="1.1.0", payload=b"# Upgraded\n"))
    engine.rollback(partial.id)
    assert (engine.data_root / FLEET_REGISTRY_FILE).read_bytes() == earlier_registry
    assert (engine.codex_root / "skills/demo/SKILL.md").read_bytes() == b"# Skill\n"
    assert (engine.codex_root / "skills/independent/SKILL.md").read_bytes() == (
        b"# Independent skill\n"
    )
    assert len(engine.load().assets) == 2


def test_missing_other_owned_file_blocks_new_backup_before_registration_is_changed(
    engine: FleetEngine,
    tmp_path: Path,
) -> None:
    engine.install_bundle(bundle(tmp_path))
    engine.install_bundle(secondary_bundle(tmp_path))
    prior = (engine.data_root / FLEET_REGISTRY_FILE).read_bytes()
    backup_count = len(engine.backups())
    (engine.codex_root / "skills/independent/SKILL.md").unlink()
    with pytest.raises(PermissionError, match="drifted registered asset"):
        engine.upgrade_bundle(bundle(tmp_path, version="1.1.0", payload=b"# Upgraded\n"))
    assert (engine.data_root / FLEET_REGISTRY_FILE).read_bytes() == prior
    assert len(engine.backups()) == backup_count


def test_corrupted_historical_owner_bytes_cannot_be_restored_as_registered(
    engine: FleetEngine,
    tmp_path: Path,
) -> None:
    engine.install_bundle(bundle(tmp_path))
    engine.install_bundle(secondary_bundle(tmp_path))
    second = engine.codex_root / "skills/independent/SKILL.md"
    second.unlink()
    invalid = engine.files.backup(
        "upgrade", ["skills/demo/SKILL.md", "skills/independent/SKILL.md"]
    )
    second.write_bytes(b"# Independent skill\n")
    with pytest.raises(PermissionError, match="cannot prove registered asset bytes"):
        engine.rollback(invalid.id)
    assert second.read_bytes() == b"# Independent skill\n"
    assert len(engine.load().assets) == 2
