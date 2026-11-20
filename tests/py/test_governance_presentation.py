"""Real read-only CLI and Textual governance views share native domain state."""

import asyncio
import json
from pathlib import Path

import pytest
from textual.widgets import Static
from typer.testing import CliRunner

from rill_cli.cli import governance as governance_cli
from rill_cli.cli.app import app
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import DefectRecord, Severity
from rill_cli.core.governance_engine import GovernanceEngine
from rill_cli.tui.app import FleetApp


@pytest.fixture
def project(tmp_path: Path) -> tuple[Path, GovernanceEngine]:
    root = tmp_path / "product"
    root.mkdir()
    git(root, "init", "-b", "feat/status", "-q")
    (root / "README.md").write_text("# Tested project\n", encoding="utf-8")
    git(root, "add", "README.md")
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
        "test: base",
    )
    engine = GovernanceEngine(root, data_root=tmp_path / "private-data")
    engine.register(
        DefectRecord(
            identity="issue-45",
            severity=Severity.P0,
            baseline_revision=revision(root),
            root_cause="known critical issue",
            issue_number=45,
        )
    )
    return root, engine


def test_governance_status_json_is_real_and_read_only(
    project: tuple[Path, GovernanceEngine],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, engine = project
    before = engine.state_path.read_bytes()

    def isolated_engine(path: Path) -> GovernanceEngine:
        return GovernanceEngine(path, data_root=engine.data_root.parent.parent)

    monkeypatch.setattr(governance_cli, "GovernanceEngine", isolated_engine)
    result = CliRunner().invoke(app, ["governance", "status", str(root), "--json"])
    assert result.exit_code == 0, result.output
    state = json.loads(result.output)
    assert state["governance_gate"] == "blocked"
    assert state["contract_frozen"] is False
    assert state["defects"][0]["remaining"] == 3
    assert "known critical issue" not in result.output
    assert engine.state_path.read_bytes() == before
    assert git(root, "status", "--porcelain").stdout == ""


def test_textual_governance_key_does_not_authorize_mutation(
    project: tuple[Path, GovernanceEngine],
    tmp_path: Path,
) -> None:
    root, engine = project
    before = engine.state_path.read_bytes()

    async def scenario() -> None:
        app = FleetApp(
            engine=FleetEngine(data_root=tmp_path / "fleet", codex_root=tmp_path / "codex"),
            governance_root=root,
            governance_data_root=engine.data_root.parent.parent,
        )
        async with app.run_test(size=(125, 45)) as pilot:
            await pilot.pause(0.2)
            await pilot.press("g")
            await pilot.pause(0.25)
            assert app.governance_report is not None
            assert app.governance_report["governance_gate"] == "blocked"
            assert "GOVERNANCE" in str(app.query_one("#details", Static).render())
            assert engine.state_path.read_bytes() == before
            assert git(root, "status", "--porcelain").stdout == ""

    asyncio.run(scenario())
