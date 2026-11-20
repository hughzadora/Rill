"""Public command line interface."""

import json
from pathlib import Path
from typing import cast

import typer
from rich.console import Console

from rill_cli import __version__
from rill_cli.core import doctor, hooks, installer

app = typer.Typer(no_args_is_help=True, help="Rill software-factory lifecycle CLI")
console = Console()


@app.command()
def version() -> None:
    """Show the installed Rill version."""
    console.print(__version__)


@app.command()
def init(
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer declarative API
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Initialize an independent Git repository with Rill's factory assets."""
    if not yes:
        raise typer.BadParameter("Explicit --yes is required")
    try:
        console.print(f"Installed Rill at {installer.install(path)}")
    except (ValueError, OSError) as exc:
        console.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(2) from exc


@app.command()
def upgrade(
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer declarative API
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Upgrade a clean existing Rill project with native Copier merge protection."""
    if not yes:
        raise typer.BadParameter("Explicit --yes is required")
    try:
        console.print(f"Upgraded Rill at {installer.install(path, upgrade=True)}")
    except (ValueError, OSError) as exc:
        console.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(2) from exc


@app.command()
def status(path: Path = typer.Argument(Path("."))) -> None:  # noqa: B008
    """Inspect installed product state."""
    console.print_json(json.dumps(doctor.inspect(path.resolve())))


@app.command(name="doctor")
def doctor_command(path: Path = typer.Argument(Path("."))) -> None:  # noqa: B008
    """Check tools, installation and boundary violations."""
    result = doctor.inspect(path.resolve())
    console.print_json(json.dumps(result))
    tools = result["tools"]
    if (
        not result["installed"]
        or result["violations"]
        or not (
            isinstance(tools, dict)
            and all(value is True for value in cast("dict[str, object]", tools).values())
        )
    ):
        raise typer.Exit(1)


@app.command(context_settings={"allow_extra_args": False})
def hook(
    event: str = typer.Argument(
        help="session-start, pre-compact, pre-tool-use, post-tool-use, stop"
    ),
) -> None:
    """Run one native lifecycle event."""
    allowed = {"session-start", "pre-compact", "pre-tool-use", "post-tool-use", "stop"}
    if event not in allowed:
        raise typer.BadParameter(f"Unknown hook event: {event}")
    raise typer.Exit(hooks.run(event, Path.cwd()))
