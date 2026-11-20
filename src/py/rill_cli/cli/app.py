"""Public command line interface."""

import json
import subprocess
import sys
import webbrowser
from pathlib import Path
from typing import cast

import typer
from rich.console import Console

from rill_cli import __version__
from rill_cli.assets import template_version
from rill_cli.cli.fleet import app as fleet_app
from rill_cli.cli.governance import app as governance_app
from rill_cli.cli.policy import app as policy_app
from rill_cli.core import dashboard, doctor, hooks, installer
from rill_cli.core.constants import COPIER_ANSWERS, HOOK_EVENTS
from rill_cli.core.git_policy import branch, changed_paths, head_summary

app = typer.Typer(no_args_is_help=False, help="Rill software-factory lifecycle CLI")
console = Console()
app.add_typer(policy_app, name="policy")
app.add_typer(fleet_app, name="fleet")
app.add_typer(governance_app, name="governance")


@app.callback(invoke_without_command=True)
def options(
    ctx: typer.Context,
    yes: bool = typer.Option(False, "--yes"),
    as_json: bool = typer.Option(False, "--json"),
    quiet: bool = typer.Option(False, "--quiet"),
) -> None:
    """Global lifecycle flags; Hook protocol responses always remain explicit."""
    ctx.obj = {"yes": yes, "json": as_json, "quiet": quiet}
    if ctx.invoked_subcommand is None:
        from rill_cli.tui.app import FleetApp  # noqa: PLC0415 - lazy Textual import  # noqa: PLC0415 - lazy Textual import

        FleetApp().run()


def flags(ctx: typer.Context) -> dict[str, bool]:
    value: object = ctx.obj
    return cast("dict[str, bool]", value) if isinstance(value, dict) else {}


def output(ctx: typer.Context, value: dict[str, object], human: str) -> None:
    options = flags(ctx)
    if options.get("quiet"):
        return
    if options.get("json"):
        typer.echo(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
    else:
        console.print(human)


@app.command()
def tui(demo: bool = typer.Option(False, "--demo")) -> None:
    """Open the keyboard-driven Textual fleet control console."""
    from rill_cli.tui.app import FleetApp  # noqa: PLC0415 - lazy Textual import

    FleetApp(demo=demo).run()


@app.command()
def version(ctx: typer.Context) -> None:
    """Show installed version, executable runtime and embedded template version."""
    mode = "Frozen Binary" if getattr(sys, "frozen", False) else "Source"
    template = template_version()
    output(
        ctx,
        {"version": __version__, "runtime": mode, "template": template},
        f"rill {__version__} ({mode}; template {template})",
    )


def _install_action(
    ctx: typer.Context,
    path: Path,
    confirmed: bool,
    *,
    upgrade: bool = False,
    data: list[str] | None = None,
) -> None:
    if not (confirmed or flags(ctx).get("yes")):
        raise typer.BadParameter("Explicit --yes is required")
    try:
        root = installer.install(path, upgrade=upgrade, data=data)
    except (ValueError, PermissionError) as exc:
        console.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc
    except (OSError, subprocess.SubprocessError) as exc:
        console.print(f"ENVIRONMENT ERROR: {exc}", style="red")
        raise typer.Exit(2) from exc
    if upgrade:
        output(ctx, {"path": str(root), "head": head_summary(root)}, f"Upgraded Rill at {root}")
    else:
        health = doctor.inspect(root)
        output(
            ctx,
            {"path": str(root), "doctor": health},
            f"Initialized {root}; doctor: {health['tools']}",
        )


@app.command()
def init(
    ctx: typer.Context,
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer declarative API
    yes: bool = typer.Option(False, "--yes"),
    data: list[str] | None = typer.Option(None, "--data", "-d"),  # noqa: B008 - Typer API
) -> None:
    """Initialize a clean Git repository, then commit the framework atomically."""
    _install_action(ctx, path, yes, data=data)


@app.command()
def upgrade(
    ctx: typer.Context,
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer declarative API
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Upgrade owned framework assets and create a replayable Git commit."""
    _install_action(ctx, path, yes, upgrade=True)


@app.command()
def status(ctx: typer.Context, path: Path = typer.Argument(Path("."))) -> None:  # noqa: B008
    """Compact view of the project state and the current Git atomic boundary."""
    root = path.resolve()
    health = doctor.inspect(root)
    state = cast("dict[str, object]", health["state"])
    compact: dict[str, object] = {
        "repository": str(root),
        "installed": health["installed"],
        "violations": health["violations"],
        "branch": branch(root),
        "head": head_summary(root),
        "dirty_files": len(changed_paths(root)),
        "state": {key: state.get(key) for key in ("mode", "phase", "task_goal", "version")},
    }
    output(ctx, compact, json.dumps(compact, ensure_ascii=False))


@app.command(name="doctor")
def doctor_command(ctx: typer.Context, path: Path = typer.Argument(Path("."))) -> None:  # noqa: B008
    """Inspect installed assets, required tools and ownership violations."""
    result = doctor.inspect(path.resolve())
    tools = result["tools"]
    output(ctx, result, json.dumps(result, ensure_ascii=False))
    if not result["installed"] or result["violations"] or result["missing_guardrails"]:
        raise typer.Exit(1)
    if not isinstance(tools, dict) or not all(
        value is True for value in cast("dict[str, object]", tools).values()
    ):
        raise typer.Exit(2)


@app.command()
def ui(
    ctx: typer.Context,
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer API
    no_open: bool = typer.Option(False, "--no-open"),
    serve: bool = typer.Option(False, "--serve"),
) -> None:
    """Generate a single-file HTML dashboard or wait for one local owner receipt."""
    root = path.expanduser().resolve()
    if not (root / COPIER_ANSWERS).is_file():
        raise typer.Exit(1)
    if serve:
        dashboard.serve(root, open_browser=not no_open)
        return
    page = dashboard.render(root)
    if not no_open:
        webbrowser.open(page.as_uri())
    output(ctx, {"dashboard": str(page)}, f"Dashboard: {page}")


@app.command(context_settings={"allow_extra_args": False})
def hook(
    event: str = typer.Argument(
        help="session-start, pre-compact, pre-tool-use, post-tool-use, stop"
    ),
) -> None:
    """Run one native lifecycle event."""
    if event not in HOOK_EVENTS:
        raise typer.BadParameter(f"Unknown hook event: {event}")
    raise typer.Exit(hooks.run(event, Path.cwd()))
