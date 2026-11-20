"""Isolated real filesystem and Git regression tests for the global fleet."""

import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

import pytest
from pydantic import ValidationError

from rill_cli.core import fleet
from rill_cli.core.constants import FLEET_ASSET_MANIFEST, FLEET_REGISTRY_FILE
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.git_policy import git
from rill_cli.core.models import AgentAssetManifest, AssetFile, GitHubReleaseAsset


@pytest.fixture
def engine(tmp_path: Path) -> FleetEngine:
    return FleetEngine(data_root=tmp_path / "xdg-data", codex_root=tmp_path / "home/.codex")


def bundle(tmp_path: Path, *, version: str = "1.0.0", payload: bytes = b"# Skill\n") -> Path:
    root = tmp_path / f"asset-{version}"
    root.mkdir()
    source = root / "contents/SKILL.md"
    source.parent.mkdir()
    source.write_bytes(payload)
    manifest = AgentAssetManifest(
        id="demo-skill",
        name="Demo skill",
        kind="skill",
        version=version,
        files=[
            AssetFile(
                source="contents/SKILL.md",
                target="skills/demo/SKILL.md",
                sha256=hashlib.sha256(payload).hexdigest(),
            )
        ],
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
    engine.rollback(backup)
    assert target.read_bytes() == b"External configuration drift\n"


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
