"""Headless owner authorizations route through the real Git repair engine."""

import json
import sys
from pathlib import Path

import pytest
from typer.testing import CliRunner

from rill_cli.cli.app import app
from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import Disposition
from rill_cli.core.governance_engine import GovernanceEngine


@pytest.fixture
def repository(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "product"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/governance")
    (root / "api.json").write_text('{"schema":true}\n', encoding="utf-8")
    (root / "justfile").write_text("ci-full:\n    @test -f fixed.txt\n", encoding="utf-8")
    git(root, "add", "api.json", "justfile")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: baseline",
    )
    monkeypatch.chdir(root)
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "xdg"))
    return root


def test_owner_cli_creates_freeze_and_budget_then_aborts_cleanly(repository: Path) -> None:
    runner = CliRunner()
    assert runner.invoke(app, ["governance", "freeze", "--file", "api.json"]).exit_code != 0
    first = runner.invoke(app, ["governance", "freeze", "--file", "api.json", "--yes"])
    assert first.exit_code == 0, first.output
    assert json.loads(first.stdout)["revision"] == revision(repository)
    assert (
        runner.invoke(
            app,
            [
                "governance",
                "register",
                "bug42",
                "--severity",
                "P2",
                "--cause",
                "static warning",
                "--noncritical",
            ],
        ).exit_code
        != 0
    )
    added = runner.invoke(
        app,
        [
            "governance",
            "register",
            "bug42",
            "--severity",
            "P2",
            "--cause",
            "static warning",
            "--noncritical",
            "--yes",
        ],
    )
    assert added.exit_code == 0, added.output
    assert json.loads(added.stdout)["attempt_count"] == 0
    begin = runner.invoke(app, ["governance", "begin", "bug42", "--yes"])
    assert begin.exit_code == 0, begin.output
    checkout = Path(json.loads(begin.stdout)["checkout"])
    assert checkout.is_dir()
    assert runner.invoke(app, ["governance", "abort", "bug42"]).exit_code != 0
    result = runner.invoke(app, ["governance", "abort", "bug42", "--yes"])
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout)["state"] == Disposition.DEFERRED
    assert not checkout.exists()
    assert runner.invoke(app, ["governance", "begin", "bug42", "--yes"]).exit_code != 0
    assert git(repository, "status", "--porcelain").stdout == ""


def test_owner_cli_native_failed_check_removes_only_task_worktree(repository: Path) -> None:
    runner = CliRunner()
    runner.invoke(app, ["governance", "freeze", "--file", "api.json", "--yes"])
    runner.invoke(
        app,
        [
            "governance",
            "register",
            "bug43",
            "--severity",
            "P0",
            "--cause",
            "critical path failure",
            "--yes",
        ],
    )
    start = runner.invoke(app, ["governance", "begin", "bug43", "--yes"])
    assert start.exit_code == 0, start.output
    checkout = Path(json.loads(start.stdout)["checkout"])
    attempt = runner.invoke(
        app, ["governance", "check", "bug43", "--", sys.executable, "-c", "raise SystemExit(7)"]
    )
    assert attempt.exit_code != 0
    assert not checkout.exists(), attempt.output
    report = GovernanceEngine(repository).load().defects["bug43"]
    assert report.state == Disposition.RETRY_ELIGIBLE
    assert report.attempt_count == 1
    assert git(repository, "status", "--porcelain").stdout == ""


def test_native_cli_preserves_child_git_argument_separator(repository: Path) -> None:
    runner = CliRunner()
    assert (
        runner.invoke(app, ["governance", "freeze", "--file", "api.json", "--yes"]).exit_code == 0
    )
    assert (
        runner.invoke(
            app,
            [
                "governance",
                "register",
                "separator",
                "--severity",
                "P2",
                "--cause",
                "argv contract",
                "--yes",
            ],
        ).exit_code
        == 0
    )
    assert runner.invoke(app, ["governance", "begin", "separator", "--yes"]).exit_code == 0
    result = runner.invoke(
        app,
        [
            "governance",
            "check",
            "separator",
            "--",
            "git",
            "diff",
            "--exit-code",
            "--",
            "api.json",
        ],
    )
    assert result.exit_code == 0, result.output
    observed = GovernanceEngine(repository).load().defects["separator"].evidence[-1]
    assert observed.command.endswith("git diff --exit-code -- api.json")
    assert runner.invoke(app, ["governance", "abort", "separator", "--yes"]).exit_code == 0


def test_native_cli_completes_only_a_committed_tested_feature_revision(
    repository: Path,
) -> None:
    runner = CliRunner()
    assert (
        runner.invoke(app, ["governance", "freeze", "--file", "api.json", "--yes"]).exit_code == 0
    )
    assert (
        runner.invoke(
            app,
            [
                "governance",
                "register",
                "repair",
                "--severity",
                "P0",
                "--cause",
                "critical behavior",
                "--yes",
            ],
        ).exit_code
        == 0
    )
    baseline = runner.invoke(
        app, ["governance", "baseline-check", "repair", "--", "just", "ci-full"]
    )
    assert baseline.exit_code == 0, baseline.output
    assert json.loads(baseline.stdout)["exit_code"] != 0
    started = runner.invoke(app, ["governance", "begin", "repair", "--yes"])
    assert started.exit_code == 0, started.output
    checkout = Path(json.loads(started.stdout)["checkout"])
    original_head = revision(repository)
    (checkout / "fixed.txt").write_text("Tested repair\n", encoding="utf-8")
    git(checkout, "add", "fixed.txt")
    git(
        checkout,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fix: verified repair",
    )
    candidate = revision(checkout)
    assert candidate != original_head
    assert runner.invoke(app, ["governance", "complete", "repair", "--yes"]).exit_code != 0
    checked = runner.invoke(
        app,
        [
            "governance",
            "check",
            "repair",
            "--",
            "just",
            "ci-full",
        ],
    )
    assert checked.exit_code == 0, checked.output
    result = runner.invoke(app, ["governance", "complete", "repair", "--yes"])
    assert result.exit_code == 0, result.output
    record = json.loads(result.stdout)
    assert record["state"] == Disposition.VERIFIED
    assert record["last_verified_revision"] == candidate
    assert revision(repository) == candidate
    assert not checkout.exists()
    assert (repository / "fixed.txt").read_text(encoding="utf-8") == "Tested repair\n"
    assert git(repository, "status", "--porcelain").stdout == ""
