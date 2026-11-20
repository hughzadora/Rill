"""Headless commands and the interactive console share the same FleetEngine."""

import hashlib
import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from rill_cli.cli import fleet as fleet_cli
from rill_cli.cli.app import app
from rill_cli.core.constants import FLEET_ASSET_MANIFEST
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.git_policy import git
from rill_cli.core.models import AgentAssetManifest, AssetFile


@pytest.fixture
def target(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> FleetEngine:
    engine = FleetEngine(data_root=tmp_path / "data", codex_root=tmp_path / "home/.codex")
    monkeypatch.setattr(fleet_cli, "_engine", lambda: engine)
    return engine


def bundle(tmp_path: Path) -> Path:
    source = tmp_path / "asset"
    source.mkdir()
    contents = b"# Native skill\n"
    (source / "SKILL.md").write_bytes(contents)
    manifest = AgentAssetManifest(
        id="sample",
        name="Sample skill",
        kind="skill",
        version="1.2.0",
        files=[
            AssetFile(
                source="SKILL.md",
                target="skills/sample/SKILL.md",
                sha256=hashlib.sha256(contents).hexdigest(),
            )
        ],
    )
    (source / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json(), encoding="utf-8")
    return source


def test_list_json_is_true_inventory_and_demo_is_labeled(target: FleetEngine) -> None:
    runner = CliRunner()
    result = runner.invoke(app, ["fleet", "list", "--json"])
    assert result.exit_code == 0
    assert json.loads(result.stdout)["assets"] == []
    demo = runner.invoke(app, ["fleet", "list", "--json", "--demo"])
    assert demo.exit_code == 0
    assert json.loads(demo.stdout)["demo"] is True
    assert len(json.loads(demo.stdout)["assets"]) == 3
    assert target.load().assets == []


def test_install_retire_and_rollback_require_explicit_confirmation(
    target: FleetEngine, tmp_path: Path
) -> None:
    runner = CliRunner()
    source = bundle(tmp_path)
    blocked = runner.invoke(app, ["fleet", "install", str(source)])
    assert blocked.exit_code != 0 and target.load().assets == []
    installed = runner.invoke(app, ["--json", "fleet", "install", str(source), "--yes"])
    assert installed.exit_code == 0
    assert json.loads(installed.stdout)["id"] == "sample"
    assert (target.codex_root / "skills/sample/SKILL.md").is_file()
    removed = runner.invoke(app, ["fleet", "retire", "sample", "--yes"])
    assert removed.exit_code == 0 and not target.load().assets
    backup = target.audit_records()[-1].backup_id
    assert backup is not None
    assert runner.invoke(app, ["fleet", "rollback", backup]).exit_code != 0
    restored = runner.invoke(app, ["--json", "fleet", "rollback", backup, "--yes"])
    assert restored.exit_code == 0
    assert json.loads(restored.stdout)["restored"] == backup
    assert target.load().assets[0].version == "1.2.0"


def test_project_registry_does_not_modify_business_worktree(
    target: FleetEngine, tmp_path: Path
) -> None:
    repository = tmp_path / "business"
    repository.mkdir()
    git(repository, "init", "-q", "-b", "main")
    runner = CliRunner()
    result = runner.invoke(
        app, ["--json", "fleet", "install", str(repository), "--project", "--yes"]
    )
    assert result.exit_code == 0
    identity = json.loads(result.stdout)["id"]
    assert git(repository, "status", "--porcelain").stdout == ""
    assert runner.invoke(app, ["fleet", "retire", identity, "--project", "--yes"]).exit_code == 0
    assert target.load().projects == []


def test_dashboard_and_backup_audit_are_headless(target: FleetEngine) -> None:
    runner = CliRunner()
    html = runner.invoke(app, ["--json", "fleet", "dashboard", "--no-open"])
    assert html.exit_code == 0
    page = Path(json.loads(html.stdout)["dashboard"])
    assert page.is_file()
    assert 'data-theme="dark"' in page.read_text(encoding="utf-8")
    assert json.loads(runner.invoke(app, ["fleet", "audit", "--json"]).stdout) == []
    assert json.loads(runner.invoke(app, ["fleet", "backups", "--json"]).stdout) == []


def test_no_implicit_registry_mutation_for_invalid_release(
    target: FleetEngine, tmp_path: Path
) -> None:
    spec = tmp_path / "release.json"
    spec.write_text('{"repository":"../invalid","tag":"-bad"}', encoding="utf-8")
    result = CliRunner().invoke(app, ["fleet", "install-release", str(spec), "--yes"])
    assert result.exit_code != 0
    assert not (target.data_root / "registry.json").exists()
