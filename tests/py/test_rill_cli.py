"""Deterministic guardrail, recovery and CLI lifecycle regression tests."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from typer.testing import CliRunner

from rill_cli.cli.app import app
from rill_cli.core import hooks
from rill_cli.core.guardrails import patch_targets, symbols, validate
from rill_cli.core.installer import install, upgrade_values
from rill_cli.core.state import load, save


def test_version() -> None:
    result = CliRunner().invoke(app, ["version"])
    assert result.exit_code == 0
    assert "0.2.0" in result.stdout


def test_install_creates_native_assets(tmp_path: Path) -> None:
    destination = tmp_path / "product"
    root = install(destination)
    assert (root / ".codex/hooks.json").is_file()
    assert (root / ".agents/skills/rill-review/SKILL.md").is_file()
    assert (root / ".rill/state.json").is_file()
    assert (root / ".rill/copier-answers.yml").is_file()
    assert load(root)["mode"] == "normal"


def test_dirty_target_blocked(tmp_path: Path) -> None:
    subprocess.run(  # noqa: S603 - trusted Git binary; argv only
        [shutil.which("git") or "/usr/bin/git", "init", str(tmp_path)],
        check=True,
        capture_output=True,
    )
    (tmp_path / "existing.txt").write_text("Keep me", encoding="utf-8")
    with pytest.raises(ValueError, match="Dirty target"):
        install(tmp_path)
    assert (tmp_path / "existing.txt").read_text(encoding="utf-8") == "Keep me"


def test_atomic_state_self_heals(tmp_path: Path) -> None:
    location = tmp_path / ".rill/state.json"
    location.parent.mkdir()
    location.write_text("invalid", encoding="utf-8")
    assert load(tmp_path)["schema"] == 1
    save(tmp_path, {"schema": 1, "task_scope": ["src"], "mode": "normal"})
    assert json.loads(location.read_text(encoding="utf-8"))["task_scope"] == ["src"]


def test_framework_requires_upgrade(tmp_path: Path) -> None:
    with pytest.raises(PermissionError, match="upgrade mode"):
        validate(tmp_path, tmp_path / "justfile")
    save(tmp_path, {"schema": 1, "mode": "upgrade", "task_scope": []})
    validate(tmp_path, tmp_path / "justfile")


def test_scope_and_rewrite_limit(tmp_path: Path) -> None:
    save(tmp_path, {"schema": 1, "mode": "normal", "task_scope": ["src/app"]})
    validate(tmp_path, tmp_path / "src/app/main.py", changed_lines=60)
    with pytest.raises(PermissionError, match="Outside task_scope"):
        validate(tmp_path, tmp_path / "src/other.py")
    with pytest.raises(PermissionError, match="60 lines"):
        validate(tmp_path, tmp_path / "src/app/main.py", changed_lines=61)
    with pytest.raises(PermissionError, match="Outside repository"):
        validate(tmp_path, tmp_path.parent / "escape.py")


def test_ast_symbol_inventory(tmp_path: Path) -> None:
    (tmp_path / "service.py").write_text("class Client: pass\ndef run(): pass\n", encoding="utf-8")
    inventory = symbols(tmp_path)
    assert "ClassDef Client" in inventory
    assert "FunctionDef run" in inventory


def test_init_requires_explicit_yes(tmp_path: Path) -> None:
    result = CliRunner().invoke(app, ["init", str(tmp_path)])
    assert result.exit_code != 0
    assert not (tmp_path / ".rill").exists()


def test_upgrade_requires_installation(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="managed-file hashes"):
        upgrade_values(tmp_path, {"schema": 1}, {})


def test_upgrade_blocks_modified_managed_file(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Managed file changed"):
        upgrade_values(tmp_path, {"managed": {".codex/hooks.json": "original"}}, {})


def test_patch_inventory() -> None:
    patch = "*** Begin Patch\n*** Update File: .codex/config.toml\n+model = 'test'\n*** End Patch"
    assert patch_targets(patch) == [(".codex/config.toml", 1)]


def test_hook_denies_tier_zero(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        hooks,
        "_payload",
        lambda: {"tool_input": {"command": "*** Update File: .codex/config.toml\n+blocked"}},
    )
    assert hooks.run("pre-tool-use", tmp_path) == 0
    decision = json.loads(capsys.readouterr().out)
    assert decision["hookSpecificOutput"]["permissionDecision"] == "deny"


def test_hook_denies_quota(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    save(tmp_path, {"schema": 1, "mode": "normal", "budget_exhausted": True})
    monkeypatch.setattr(hooks, "_payload", lambda: {"tool_input": {"file_path": "src/app.py"}})
    hooks.run("pre-tool-use", tmp_path)
    decision = json.loads(capsys.readouterr().out)
    assert "budget" in decision["hookSpecificOutput"]["permissionDecisionReason"].lower()


def test_compact_writes_symbols(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "main.py").write_text("def service(): pass\n", encoding="utf-8")
    monkeypatch.setattr(hooks, "_payload", lambda: {"hook_event_name": "PreCompact"})
    assert hooks.run("pre-compact", tmp_path) == 0
    assert "service" in (tmp_path / ".rill/symbols.txt").read_text(encoding="utf-8")
