"""Deterministic guardrail, recovery and CLI lifecycle regression tests."""

import importlib
import json
import runpy
import shutil
import subprocess
import sys
from importlib.metadata import version as package_version
from pathlib import Path

import pytest
from typer.testing import CliRunner

from rill_cli import __version__
from rill_cli.cli.app import app
from rill_cli.core import hooks
from rill_cli.core.constants import (
    DISTRIBUTION,
    MAX_REWRITE_LINES,
    RUNTIME_ANCHORS,
    SCHEMA_VERSION,
    SYMBOLS_PATH,
)
from rill_cli.core.git_policy import git
from rill_cli.core.guardrails import patch_targets, symbols, validate
from rill_cli.core.installer import install, upgrade_values
from rill_cli.core.state import load, save


def test_version() -> None:
    result = CliRunner().invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.stdout
    assert package_version(DISTRIBUTION) == __version__
    assert (
        json.loads(CliRunner().invoke(app, ["--json", "version"]).stdout)["version"] == __version__
    )
    assert Path("VERSION").read_text(encoding="utf-8").strip() == __version__


def test_install_creates_native_assets(tmp_path: Path) -> None:
    destination = tmp_path / "product"
    root = install(destination)
    assert (root / ".codex/hooks.json").is_file()
    assert (root / "REVIEW.md").is_file()
    status = CliRunner().invoke(app, ["--json", "status", str(root)])
    assert status.exit_code == 0
    assert json.loads(status.stdout)["dirty_files"] == 0
    assert git(root, "ls-files", "--error-unmatch", "REVIEW.md", check=False).returncode == 0
    assert git(root, "status", "--porcelain").stdout == ""
    assert (root / ".agents/skills/rill-review/SKILL.md").is_file()
    assert (root / ".rill/state.json").is_file()
    assert (root / ".rill/.gitignore").is_file()
    assert not (root / ".gitignore").exists()
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
    assert load(tmp_path)["schema"] == SCHEMA_VERSION
    save(tmp_path, {"schema": 1, "task_scope": ["src"], "mode": "normal"})
    assert json.loads(location.read_text(encoding="utf-8"))["task_scope"] == ["src"]


def test_framework_requires_upgrade(tmp_path: Path) -> None:
    with pytest.raises(PermissionError, match="authorized rill upgrade"):
        validate(tmp_path, tmp_path / "justfile")
    # A forgeable runtime state field must never grant framework authority.
    save(tmp_path, {"schema": SCHEMA_VERSION, "mode": "upgrade", "task_scope": []})
    with pytest.raises(PermissionError, match="authorized rill upgrade"):
        validate(tmp_path, tmp_path / "justfile")


def test_runtime_anchors_are_cli_owned(tmp_path: Path) -> None:
    for anchor in RUNTIME_ANCHORS:
        with pytest.raises(PermissionError, match="CLI-owned"):
            validate(tmp_path, tmp_path / anchor)


def test_scope_and_rewrite_limit(tmp_path: Path) -> None:
    save(tmp_path, {"schema": 1, "mode": "normal", "task_scope": ["src/app"]})
    validate(tmp_path, tmp_path / "src/app/main.py", changed_lines=MAX_REWRITE_LINES)
    with pytest.raises(PermissionError, match="Outside task_scope"):
        validate(tmp_path, tmp_path / "src/other.py")
    with pytest.raises(PermissionError, match="60 lines"):
        validate(tmp_path, tmp_path / "src/app/main.py", changed_lines=MAX_REWRITE_LINES + 1)
    with pytest.raises(PermissionError, match="Outside repository"):
        validate(tmp_path, tmp_path.parent / "escape.py")


def test_ast_symbol_inventory(tmp_path: Path) -> None:
    (tmp_path / "service.py").write_text("class Client: pass\ndef run(): pass\n", encoding="utf-8")
    inventory = symbols(tmp_path)
    assert "ClassDef Client" in inventory
    assert "FunctionDef run" in inventory


def test_hook_without_stdin_data_does_not_block(tmp_path: Path) -> None:
    process = subprocess.Popen(
        [sys.executable, "-m", "rill_cli", "hook", "session-start"],
        cwd=tmp_path,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        assert process.wait(timeout=3) == 0
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=3)
        if process.stdin:
            process.stdin.close()
        if process.stdout:
            process.stdout.close()
        if process.stderr:
            process.stderr.close()


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
    assert patch_targets("*** Delete File: src/old.py")[0][1] > MAX_REWRITE_LINES
    moved = "*** Update File: src/old.py\n*** Move to: .codex/hooks.json\n"
    assert any(name == ".codex/hooks.json" for name, _count in patch_targets(moved))
    assert patch_targets("*** Update File: src/main.py\n-x\n+y") == [("src/main.py", 2)]


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
    git(tmp_path, "init", "-b", "feat/rill-test")
    save(tmp_path, {"schema": SCHEMA_VERSION, "mode": "normal", "budget_exhausted": True})
    monkeypatch.setattr(hooks, "_payload", lambda: {"tool_input": {"file_path": "src/app.py"}})
    hooks.run("pre-tool-use", tmp_path)
    decision = json.loads(capsys.readouterr().out)
    assert "budget" in decision["hookSpecificOutput"]["permissionDecisionReason"].lower()


def test_compact_writes_symbols(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "main.py").write_text("def service(): pass\n", encoding="utf-8")
    monkeypatch.setattr(hooks, "_payload", lambda: {"hook_event_name": "PreCompact"})
    assert hooks.run("pre-compact", tmp_path) == 0
    assert "service" in (tmp_path / SYMBOLS_PATH).read_text(encoding="utf-8")


def test_entrypoint_executes_cli(monkeypatch: pytest.MonkeyPatch) -> None:
    called: list[bool] = []
    cli_module = importlib.import_module("rill_cli.cli.app")
    monkeypatch.setattr(cli_module, "app", lambda: called.append(True))
    runpy.run_module("rill_cli.__main__", run_name="__main__")
    assert called == [True]


def test_cli_commands_and_invalid_arguments(tmp_path: Path) -> None:
    runner = CliRunner()
    assert runner.invoke(app, ["doctor", str(tmp_path)]).exit_code == 1
    assert runner.invoke(app, ["upgrade", str(tmp_path)]).exit_code != 0
    missing = tmp_path / "missing-project"
    assert runner.invoke(app, ["upgrade", str(missing), "--yes"]).exit_code == 1
    assert not missing.exists()
    assert runner.invoke(app, ["hook", "unknown"]).exit_code != 0
    product = tmp_path / "candidate"
    assert runner.invoke(app, ["init", str(product), "--yes"]).exit_code == 0
    assert '"installed": true' in runner.invoke(app, ["status", str(product)]).stdout
    assert runner.invoke(app, ["init", str(product), "--yes"]).exit_code == 1


def test_cli_hooks_parse_input_and_emit_native_denial(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    runner = CliRunner()
    started = runner.invoke(app, ["hook", "session-start"])
    assert started.exit_code == 0
    assert json.loads(started.stdout)["state"]["mode"] == "normal"
    denied = runner.invoke(
        app,
        ["hook", "pre-tool-use"],
        input=json.dumps({"tool_input": {"file_path": ".rill/state.json"}}),
    )
    assert denied.exit_code == 0
    assert json.loads(denied.stdout)["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert runner.invoke(app, ["hook", "pre-compact"]).exit_code == 0
    assert runner.invoke(app, ["hook", "stop"]).stdout.strip() == "{}"


def test_post_tool_hook_reports_boundary_violation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def violation(_root: Path) -> list[str]:
        return ["Tier 0 blocked"]

    monkeypatch.setattr(hooks, "audit", violation)
    monkeypatch.setattr(hooks, "_payload", lambda: {"tool_input": {"file_path": "src/app.py"}})
    assert hooks.run("post-tool-use", tmp_path) == 1
    assert "Tier 0 blocked" in capsys.readouterr().err
    assert "Tier 0 blocked" in (tmp_path / ".rill/last-error.log").read_text(encoding="utf-8")


def test_hook_stop_records_exhausted_quota(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    save(tmp_path, {"schema": SCHEMA_VERSION, "budget_exhausted": True})
    monkeypatch.setattr(hooks, "_payload", lambda: {"hook_event_name": "Stop"})
    assert hooks.run("stop", tmp_path) == 1
    assert "QUOTA GUARD" in capsys.readouterr().err
    assert "QUOTA GUARD" in (tmp_path / ".rill/last-error.log").read_text(encoding="utf-8")


def test_hook_formats_python_after_tool_use(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "src/source.py"
    source.parent.mkdir()
    source.write_text("value=1\n", encoding="utf-8")
    monkeypatch.setattr(hooks, "_payload", lambda: {"tool_input": {"file_path": "src/source.py"}})

    def no_violations(_root: Path) -> list[str]:
        return []

    monkeypatch.setattr(hooks, "audit", no_violations)
    assert hooks.run("post-tool-use", tmp_path) == 0
    assert source.read_text(encoding="utf-8") == "value = 1\n"


def test_invalid_symbol_file_is_skipped(tmp_path: Path) -> None:
    (tmp_path / "valid.py").write_text("def valid(): pass\n", encoding="utf-8")
    (tmp_path / "broken.py").write_text("def broken(\n", encoding="utf-8")
    assert "FunctionDef valid" in symbols(tmp_path)
    assert "broken" not in symbols(tmp_path)
