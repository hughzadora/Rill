"""Responsive Textual console; all lifecycle work stays in the fleet domain."""

import subprocess
import webbrowser
from pathlib import Path
from typing import ClassVar, Literal, cast

from textual import on, work
from textual.app import App, ComposeResult
from textual.binding import BindingType
from textual.containers import Horizontal, Vertical
from textual.widgets import Button, DataTable, Footer, Header, Input, RichLog, Static

from rill_cli.assets import base
from rill_cli.core import dashboard
from rill_cli.core.constants import FLEET_TUI_STYLESHEET
from rill_cli.core.fixtures import demo_fleet
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.models import AuditRecord, FleetSnapshot
from rill_cli.tui.modals import ConfirmModal, HelpModal, PathWizard, WizardMode, WizardRequest

Selected = tuple[Literal["asset", "project"], str]


class FleetApp(App[None]):
    """Non-blocking terminal dashboard; irreversible actions need two clicks."""

    TITLE = "Rill | Fleet"
    CSS_PATH: ClassVar[str] = str(base() / FLEET_TUI_STYLESHEET)  # pyright: ignore[reportIncompatibleVariableOverride]
    BINDINGS: ClassVar[list[BindingType]] = [
        ("q", "quit", "Quit"),
        ("r", "refresh", "Refresh"),
        ("/", "search", "Search"),
        ("j", "down", "Down"),
        ("k", "up", "Up"),
        ("i", "install", "Install"),
        ("u", "upgrade", "Upgrade"),
        ("d", "doctor", "Doctor"),
        ("x", "retire", "Retire"),
        ("b", "rollback", "Rollback"),
        ("w", "dashboard", "HTML"),
        ("?", "help", "Help"),
    ]

    def __init__(self, engine: FleetEngine | None = None, *, demo: bool = False) -> None:
        super().__init__()
        self.engine = engine or FleetEngine()
        self.demo = demo
        self.snapshot = FleetSnapshot()
        self.health: dict[str, object] = {}
        self.selected: Selected | None = None

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        with Horizontal(id="topbar"):
            yield Static("RILL / FLEET     PROJECTS · ASSETS · AUDIT")
            yield Input(placeholder="/  Search projects and assets", id="search")
        with Horizontal(id="main"):
            with Vertical(id="left"):
                yield Static("PROJECTS", classes="section-title")
                yield DataTable[str](id="projects")
                yield Static("CODEX ASSETS", classes="section-title")
                yield DataTable[str](id="assets")
            with Vertical(id="right"):
                yield Static("DETAILS", classes="section-title")
                yield Static("Choose a project or asset", id="details")
                yield Static("LIFECYCLE LOG", classes="section-title")
                yield RichLog(id="events", wrap=True, highlight=False, markup=False)
        with Horizontal(id="actions"):
            for title, identity in (
                ("Install", "install"),
                ("Upgrade", "upgrade"),
                ("Doctor", "doctor"),
                ("Retire", "retire"),
                ("Rollback", "rollback"),
                ("HTML", "dashboard"),
            ):
                yield Button(title, id=f"action-{identity}", variant="default")
        yield Static("Reading local fleet…", id="status")
        yield Footer()

    def on_mount(self) -> None:
        projects = cast("DataTable[str]", self.query_one("#projects"))
        projects.add_columns("Repository", "Health")
        assets = cast("DataTable[str]", self.query_one("#assets"))
        assets.add_columns("Asset", "Kind", "Version", "Health")
        for table in (projects, assets):
            table.cursor_type = "row"
            table.zebra_stripes = True
        assets.focus()
        self.action_refresh()

    def _health_of(self, category: str, identity: str) -> str:
        records = self.health.get(category)
        if isinstance(records, list):
            for record in cast("list[object]", records):
                if isinstance(record, dict):
                    data = cast("dict[str, object]", record)
                    if data.get("id") == identity:
                        return "OK" if data.get("healthy") is True else "REVIEW"
        return "DEMO" if self.snapshot.demo else "UNKNOWN"

    def _rebuild(self) -> None:
        query = self.query_one("#search", Input).value.casefold().strip()
        self.selected = None
        projects = cast("DataTable[str]", self.query_one("#projects")).clear()
        assets = cast("DataTable[str]", self.query_one("#assets")).clear()
        for item in self.snapshot.projects:
            if query in f"{item.name} {item.path}".casefold():
                projects.add_row(item.name, self._health_of("projects", item.id), key=item.id)
        for item in self.snapshot.assets:
            if query in f"{item.name} {item.id} {item.version}".casefold():
                assets.add_row(
                    item.name,
                    item.kind,
                    item.version,
                    self._health_of("assets", item.id),
                    key=item.id,
                )
        self.query_one("#status", Static).update(
            f"{'DEMO · ' if self.snapshot.demo else ''}"
            f"{len(self.snapshot.projects)} projects · {len(self.snapshot.assets)} assets · "
            "i install · u upgrade · x retire · b rollback · ? help"
        )

    def _show_fleet(
        self, snapshot: FleetSnapshot, health: dict[str, object], audit: list[AuditRecord]
    ) -> None:
        self.snapshot = snapshot
        self.health = health
        self._rebuild()
        log = self.query_one("#events", RichLog)
        log.clear()
        for record in audit:
            log.write(f"{record.happened_at:%m-%d %H:%M}  {record.operation}: {record.subject}")
        if snapshot.demo:
            log.write("DEMO / examples are not installed or registered")
        self.notify("Fleet refreshed", timeout=2)

    def _log(self, message: str) -> None:
        self.query_one("#events", RichLog).write(message)

    def _error(self, message: str) -> None:
        self._log(f"BLOCKED: {message}")
        self.notify(message, severity="error", timeout=6)

    @work(thread=True, exclusive=True, group="fleet-refresh")
    def _refresh_worker(self) -> None:
        try:
            snapshot = self.engine.load()
            if self.demo or not (snapshot.projects or snapshot.assets):
                snapshot = demo_fleet()
            health = self.engine.inspect() if not snapshot.demo else {}
            records = self.engine.audit_records()
            self.call_from_thread(self._show_fleet, snapshot, health, records)
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            self.call_from_thread(self._error, str(exc))

    @on(Input.Changed, "#search")
    def filter_changed(self) -> None:
        self._rebuild()

    @on(Input.Submitted, "#search")
    def finish_search(self) -> None:
        cast("DataTable[str]", self.query_one("#assets")).focus()

    @on(DataTable.RowHighlighted)
    def table_selected(self, event: DataTable.RowHighlighted) -> None:
        if event.row_key is None:  # pyright: ignore[reportUnnecessaryComparison]
            return
        if event.row_key.value is None:
            return
        table = cast("DataTable[str]", event.data_table)  # pyright: ignore[reportUnknownMemberType]
        category = "asset" if table.id == "assets" else "project"
        self.selected = (category, event.row_key.value)
        if category == "asset":
            item = next(
                (asset for asset in self.snapshot.assets if asset.id == event.row_key.value), None
            )
            text = (
                f"{item.name}\n{item.kind} / {item.version}\n{item.id}" if item else "Unknown asset"
            )
        else:
            item = next((p for p in self.snapshot.projects if p.id == event.row_key.value), None)
            text = f"{item.name}\n{item.path}" if item else "Unknown project"
        self.query_one("#details", Static).update(text)

    @on(Button.Pressed)
    def toolbar_pressed(self, event: Button.Pressed) -> None:
        actions = {
            "action-install": self.action_install,
            "action-upgrade": self.action_upgrade,
            "action-doctor": self.action_doctor,
            "action-retire": self.action_retire,
            "action-rollback": self.action_rollback,
            "action-dashboard": self.action_dashboard,
        }
        action = actions.get(event.button.id or "")
        if action is not None:
            action()

    def action_refresh(self) -> None:
        self._refresh_worker()

    def action_search(self) -> None:
        self.query_one("#search", Input).focus()

    def _move(self, direction: Literal["up", "down"]) -> None:
        focused = self.focused
        table = (
            cast("DataTable[str]", focused)
            if isinstance(focused, DataTable)
            else cast("DataTable[str]", self.query_one("#assets"))
        )
        if direction == "down":
            table.action_cursor_down()
        else:
            table.action_cursor_up()
        table.focus()

    def action_down(self) -> None:
        self._move("down")

    def action_up(self) -> None:
        self._move("up")

    def _wizard(self, mode: WizardMode) -> None:
        def received(value: WizardRequest | None) -> None:
            if value is not None:
                self._preview_worker(mode, value)

        self.push_screen(PathWizard(mode), callback=received)

    def action_install(self) -> None:
        self._wizard("install")

    def action_upgrade(self) -> None:
        self._wizard("upgrade")

    def action_rollback(self) -> None:
        self._wizard("rollback")

    @work(thread=True, group="fleet-previews")
    def _preview_worker(self, mode: WizardMode, request: WizardRequest) -> None:
        try:
            if mode == "install" and request.project:
                impact = f"Register local Git project: {request.value}\nNo Codex files modified."
                token = None
            else:
                preview = (
                    self.engine.preview_backup(request.value)
                    if mode == "rollback"
                    else self.engine.preview_bundle(Path(request.value), upgrade=mode == "upgrade")
                )
                paths = preview["paths"]
                if not isinstance(paths, list) or not all(
                    isinstance(p, str) for p in cast("list[object]", paths)
                ):
                    raise ValueError("Invalid impact paths")
                impact = "Global backup first. Affected files:\n" + "\n".join(
                    cast("list[str]", paths)
                )
                token = preview.get("token")
                if not isinstance(token, str):
                    raise ValueError("Fleet preview is missing its immutable approval token")
            self.call_from_thread(self._confirm, mode, request, impact, token)
        except (OSError, ValueError, PermissionError, KeyError) as exc:
            self.call_from_thread(self._error, str(exc))

    def _confirm(
        self, operation: str, request: WizardRequest, impacts: str, token: str | None
    ) -> None:
        def decided(approved: bool | None) -> None:
            if approved is True:
                self._mutate_worker(operation, request.value, request.project, token)
            else:
                self._log("Cancelled, no changes made")

        self.push_screen(
            ConfirmModal(f"Confirm {operation}", impacts, confirm_label="Apply changes"),
            callback=decided,
        )

    def action_retire(self) -> None:
        if self.selected is None or self.snapshot.demo:
            self.notify("Select a real registered asset or project", severity="warning")
            return
        kind, identity = self.selected
        self._retire_preview_worker(identity, project=kind == "project")

    @work(thread=True, group="fleet-previews")
    def _retire_preview_worker(self, identity: str, *, project: bool) -> None:
        try:
            preview = self.engine.preview_retire(identity, project=project)
            paths = preview["paths"]
            token = preview["token"]
            if not isinstance(paths, list) or not isinstance(token, str):
                raise ValueError("Invalid Fleet retire preview")
            impact = "\n".join(cast("list[str]", paths)) or "Project registration only"
            self.call_from_thread(
                self._confirm,
                "retire",
                WizardRequest(identity, project=project),
                f"Target: {identity}\n{impact}\nBackup before removal.",
                token,
            )
        except (OSError, ValueError, PermissionError, KeyError) as exc:
            self.call_from_thread(self._error, str(exc))

    @work(thread=True, group="fleet-mutations")
    def _mutate_worker(self, operation: str, value: str, project: bool, token: str | None) -> None:
        try:
            self.call_from_thread(self._log, f"Running {operation} on {value}…")
            if operation == "install":
                self.engine.register_project(
                    Path(value)
                ) if project else self.engine.install_bundle(Path(value), preview_token=token)
            elif operation == "upgrade":
                self.engine.upgrade_bundle(Path(value), preview_token=token)
            elif operation == "retire":
                self.engine.unregister_project(
                    value, preview_token=token
                ) if project else self.engine.retire_asset(value, preview_token=token)
            elif operation == "rollback":
                self.engine.rollback(value, preview_token=token)
            self.call_from_thread(self._log, f"Complete: {operation}")
            self.call_from_thread(self.action_refresh)
            self.call_from_thread(self.notify, f"{operation.title()} completed", timeout=3)
        except (OSError, ValueError, PermissionError, KeyError, subprocess.SubprocessError) as exc:
            self.call_from_thread(self._error, str(exc))

    def action_doctor(self) -> None:
        self._doctor_worker()

    @work(thread=True, group="fleet-doctor")
    def _doctor_worker(self) -> None:
        try:
            report = self.engine.inspect()
            projects, assets = report.get("projects"), report.get("assets")
            if not isinstance(projects, list) or not isinstance(assets, list):
                raise ValueError("Unexpected fleet doctor response")
            self.call_from_thread(
                self._log,
                f"Doctor: {len(cast('list[object]', projects))} projects; "
                f"{len(cast('list[object]', assets))} assets",
            )
            self.call_from_thread(self.notify, "Doctor completed", timeout=3)
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            self.call_from_thread(self._error, str(exc))

    def action_dashboard(self) -> None:
        self._open_dashboard()

    @work(thread=True, group="fleet-dashboard")
    def _open_dashboard(self) -> None:
        try:
            page = dashboard.render_fleet(self.engine, demo=self.snapshot.demo)
            webbrowser.open(page.as_uri())
            self.call_from_thread(self._log, f"HTML dashboard: {page}")
            self.call_from_thread(self.notify, "Offline dashboard opened", timeout=3)
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            self.call_from_thread(self._error, str(exc))

    def action_help(self) -> None:
        self.push_screen(HelpModal())
