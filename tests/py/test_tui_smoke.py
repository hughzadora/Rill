"""Exercise actual Textual navigation, filtering, confirmations and workers."""

import asyncio
from pathlib import Path
from typing import cast

from textual.widgets import Button, DataTable, Input, RichLog

from rill_cli.core.fleet import FleetEngine
from rill_cli.core.git_policy import git
from rill_cli.tui.app import FleetApp
from rill_cli.tui.modals import ConfirmModal, HelpModal, PathWizard


def engine_at(tmp_path: Path) -> FleetEngine:
    return FleetEngine(data_root=tmp_path / "data", codex_root=tmp_path / "global/.codex")


def test_headless_tui_keyboard_navigation_filter_and_help(tmp_path: Path) -> None:
    async def scenario() -> None:
        app = FleetApp(engine=engine_at(tmp_path), demo=True)
        async with app.run_test(size=(120, 42)) as pilot:
            await pilot.pause(0.25)
            assets = cast("DataTable[str]", app.query_one("#assets"))
            assert assets.row_count == 3
            await pilot.press("/")
            assert app.query_one("#search", Input).has_focus
            await pilot.press("e", "x", "p", "l", "o", "r", "e", "r")
            await pilot.pause()
            assert assets.row_count == 1
            await pilot.press("enter")
            await pilot.press("j")
            await pilot.press("k")
            await pilot.press("?")
            await pilot.pause()
            assert isinstance(app.screen, HelpModal)
            await pilot.press("escape")
            assert not isinstance(app.screen, HelpModal)
            assert app.snapshot.demo
            assert not (app.engine.data_root / "registry.json").exists()

    asyncio.run(scenario())


def test_cancel_and_confirm_retirement_with_async_log(tmp_path: Path) -> None:
    engine = engine_at(tmp_path)
    repository = tmp_path / "project"
    repository.mkdir()
    git(repository, "init", "-q", "-b", "main")
    project = engine.register_project(repository)

    async def scenario() -> None:
        app = FleetApp(engine=engine)
        async with app.run_test(size=(120, 42)) as pilot:
            await pilot.pause(0.3)
            assert app.query_one("#projects", DataTable).row_count == 1
            app.selected = ("project", project.id)
            await pilot.press("x")
            await pilot.pause()
            assert isinstance(app.screen, ConfirmModal)
            assert app.screen.query_one("#cancel", Button).has_focus
            await pilot.press("enter")
            await pilot.pause()
            assert len(engine.load().projects) == 1
            app.selected = ("project", project.id)
            await pilot.press("x")
            await pilot.pause()
            assert isinstance(app.screen, ConfirmModal)
            app.screen.query_one("#confirm", Button).press()
            await pilot.pause(0.3)
            assert engine.load().projects == []
            assert len(engine.backups()) >= 2
            assert app.query_one("#events", RichLog).lines
            assert git(repository, "status", "--porcelain").stdout == ""

    asyncio.run(scenario())


def test_install_wizard_can_cancel_without_global_write(tmp_path: Path) -> None:
    async def scenario() -> None:
        engine = engine_at(tmp_path)
        app = FleetApp(engine=engine)
        async with app.run_test(size=(120, 42)) as pilot:
            await pilot.pause(0.2)
            await pilot.press("i")
            await pilot.pause()
            assert isinstance(app.screen, PathWizard)
            await pilot.press("escape")
            assert not isinstance(app.screen, PathWizard)
            assert engine.load().projects == []
            assert engine.load().assets == []

    asyncio.run(scenario())
