"""Confirmations and input wizards; no fleet operations run in a modal."""

from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar, Literal

from textual import on
from textual.app import ComposeResult
from textual.binding import BindingType
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Static, Switch

WizardMode = Literal["install", "upgrade", "rollback"]


@dataclass(frozen=True)
class WizardRequest:
    value: str
    project: bool = False


class ConfirmModal(ModalScreen[bool]):
    """Destructive operations default to Cancel, never the approval button."""

    BINDINGS: ClassVar[list[BindingType]] = [("escape", "cancel", "Cancel")]

    def __init__(self, title: str, impacts: str, *, confirm_label: str = "Confirm") -> None:
        super().__init__()
        self.title_text = title
        self.impacts = impacts
        self.confirm_label = confirm_label

    def compose(self) -> ComposeResult:
        with Vertical(id="dialog"):
            yield Static(self.title_text, classes="modal-title")
            yield Static(self.impacts, classes="modal-body")
            with Horizontal(classes="modal-actions"):
                yield Button("Cancel", id="cancel", variant="default")
                yield Button(self.confirm_label, id="confirm", variant="error")

    def on_mount(self) -> None:
        self.query_one("#cancel", Button).focus()

    @on(Button.Pressed)
    def decide(self, event: Button.Pressed) -> None:
        self.dismiss(event.button.id == "confirm")

    def action_cancel(self) -> None:
        self.dismiss(False)


class PathWizard(ModalScreen[WizardRequest | None]):
    """A narrow installation / upgrade / snapshot selector."""

    BINDINGS: ClassVar[list[BindingType]] = [("escape", "cancel", "Cancel")]

    def __init__(self, mode: WizardMode) -> None:
        super().__init__()
        self.mode = mode

    def compose(self) -> ComposeResult:
        prompts = {
            "install": ("Install or register", "Local bundle or project directory"),
            "upgrade": ("Upgrade asset", "New verified bundle directory"),
            "rollback": ("Restore backup", "Timestamped backup identifier"),
        }
        heading, placeholder = prompts[self.mode]
        with Vertical(id="dialog"):
            yield Static(heading, classes="modal-title")
            yield Input(placeholder=placeholder, id="path")
            if self.mode == "install":
                with Horizontal(classes="switch-line"):
                    yield Static("Register Git project (no Codex files written)")
                    yield Switch(value=False, id="project")
            with Horizontal(classes="modal-actions"):
                yield Button("Cancel", id="cancel", variant="default")
                yield Button("Continue", id="continue", variant="primary")

    def on_mount(self) -> None:
        self.query_one("#path", Input).focus()

    @on(Input.Submitted)
    def submitted(self) -> None:
        self.action_complete()

    @on(Button.Pressed)
    def clicked(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel":
            self.action_cancel()
        else:
            self.action_complete()

    def action_complete(self) -> None:
        value = self.query_one("#path", Input).value.strip()
        if not value:
            self.notify("A path or snapshot is required", severity="warning")
            return
        project = self.mode == "install" and self.query_one("#project", Switch).value
        self.dismiss(
            WizardRequest(
                value=str(Path(value).expanduser()) if self.mode != "rollback" else value,
                project=project,
            )
        )

    def action_cancel(self) -> None:
        self.dismiss(None)


class HelpModal(ModalScreen[None]):
    BINDINGS: ClassVar[list[BindingType]] = [("escape", "close", "Close"), ("q", "close", "Close")]

    def compose(self) -> ComposeResult:
        with Vertical(id="dialog"):
            yield Static("Fleet keyboard reference", classes="modal-title")
            yield Static(
                "↑ / ↓ or j / k  Navigate tables\n"
                "/  Search   ·   i  Install/register   ·   u  Upgrade\n"
                "d  Doctor   ·   g  Governance   ·   x  Retire\n"
                "b  Rollback   ·   w  Offline dashboard\n"
                "r  Refresh\n"
                "?  Help   ·   q  Quit\n\n"
                "Protected actions always require explicit confirmation.",
                classes="modal-body",
            )
            yield Button("Close", id="close", variant="primary")

    def on_mount(self) -> None:
        self.query_one("#close", Button).focus()

    @on(Button.Pressed, "#close")
    def close_button(self) -> None:
        self.dismiss(None)

    def action_close(self) -> None:
        self.dismiss(None)
