"""Thin Typer adapter around the UI-independent FleetEngine lifecycle."""

import json
import subprocess
import webbrowser
from collections.abc import Callable
from pathlib import Path
from typing import cast

import typer
from rich.console import Console
from rich.table import Table

from rill_cli.core import dashboard
from rill_cli.core.fixtures import demo_fleet
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.models import GitHubReleaseAsset

app = typer.Typer(no_args_is_help=True, help="Manage registered projects and Codex assets")
console = Console()
errors = Console(stderr=True)


def _engine() -> FleetEngine:
    return FleetEngine()


def _options(ctx: typer.Context) -> dict[str, bool]:
    value: object = ctx.find_root().obj
    return cast("dict[str, bool]", value) if isinstance(value, dict) else {}


def _confirm(ctx: typer.Context, yes: bool) -> None:
    if not (yes or _options(ctx).get("yes", False)):
        raise typer.BadParameter("Explicit --yes is required for fleet mutations")


def _run[T](action: Callable[[], T]) -> T:
    try:
        return action()
    except (ValueError, PermissionError, KeyError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc
    except (OSError, subprocess.SubprocessError) as exc:
        errors.print(f"ENVIRONMENT ERROR: {exc}", style="red")
        raise typer.Exit(2) from exc


def _emit(ctx: typer.Context, payload: object, human: str, *, as_json: bool = False) -> None:
    if _options(ctx).get("quiet"):
        return
    if as_json or _options(ctx).get("json"):
        typer.echo(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    else:
        console.print(human)


@app.command(name="list")
def list_fleet(
    ctx: typer.Context,
    as_json: bool = typer.Option(False, "--json"),
    demo: bool = typer.Option(False, "--demo"),
) -> None:
    """List only real registered assets, or explicitly show demo fixtures."""
    snapshot = demo_fleet() if demo else _run(_engine().load)
    payload = snapshot.model_dump(mode="json")
    if as_json or _options(ctx).get("json"):
        _emit(ctx, payload, "", as_json=True)
        return
    table = Table(title="Rill fleet" + (" [DEMO]" if demo else ""))
    table.add_column("Type")
    table.add_column("Name")
    table.add_column("Version / Path")
    for asset in snapshot.assets:
        table.add_row(asset.kind, asset.name, asset.version)
    for project in snapshot.projects:
        table.add_row("project", project.name, str(project.path))
    console.print(table)


@app.command()
def install(
    ctx: typer.Context,
    path: Path = typer.Argument(..., help="Verified asset bundle or Git repository root"),  # noqa: B008
    project: bool = typer.Option(False, "--project"),
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Register a Git project or deploy a checksum-verified local asset bundle."""
    _confirm(ctx, yes)
    engine = _engine()
    result = _run(lambda: engine.register_project(path) if project else engine.install_bundle(path))
    _emit(ctx, result.model_dump(mode="json"), f"Installed: {result.name}")


@app.command()
def install_release(
    ctx: typer.Context,
    spec: Path = typer.Argument(..., help="JSON GitHub release, asset and checksum contract"),  # noqa: B008
    yes: bool = typer.Option(False, "--yes"),
    upgrade: bool = typer.Option(False, "--upgrade"),
) -> None:
    """Use native gh release download with an expected SHA-256 digest."""
    _confirm(ctx, yes)
    release = _run(lambda: GitHubReleaseAsset.model_validate_json(spec.read_bytes()))
    item = _run(lambda: _engine().install_release(release, upgrade=upgrade))
    _emit(ctx, item.model_dump(mode="json"), f"Installed release asset: {item.name}")


@app.command()
def upgrade(
    ctx: typer.Context,
    bundle: Path = typer.Argument(..., help="New version of an installed asset bundle"),  # noqa: B008
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Upgrade a registered asset after backing up its exact original bytes."""
    _confirm(ctx, yes)
    item = _run(lambda: _engine().upgrade_bundle(bundle))
    _emit(ctx, item.model_dump(mode="json"), f"Upgraded: {item.name} {item.version}")


@app.command()
def retire(
    ctx: typer.Context,
    identity: str = typer.Argument(..., help="Registered asset or project ID"),
    project: bool = typer.Option(False, "--project"),
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Unregister a project or remove only bytes owned by the selected asset."""
    _confirm(ctx, yes)
    engine = _engine()
    _run(lambda: engine.unregister_project(identity) if project else engine.retire_asset(identity))
    _emit(ctx, {"retired": identity, "project": project}, f"Retired: {identity}")


@app.command()
def repair(
    ctx: typer.Context,
    asset_id: str = typer.Argument(...),
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Explicitly repair drift from a pinned cached asset (with backup)."""
    _confirm(ctx, yes)
    item = _run(lambda: _engine().repair_asset(asset_id))
    _emit(ctx, item.model_dump(mode="json"), f"Repaired: {asset_id}")


@app.command()
def rollback(
    ctx: typer.Context,
    backup_id: str = typer.Argument(...),
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Restore exact bytes from a selected snapshot, first backing up current state."""
    _confirm(ctx, yes)
    undo_id = _run(lambda: _engine().rollback(backup_id))
    _emit(ctx, {"restored": backup_id, "undo_backup": undo_id}, "Rollback complete")


@app.command(name="doctor")
def doctor_fleet(ctx: typer.Context, as_json: bool = typer.Option(False, "--json")) -> None:
    """Inspect project health, local tools and registered MCP declarations."""
    report = _run(_engine().inspect)
    _emit(ctx, report, json.dumps(report, indent=2), as_json=as_json)


@app.command()
def audit(ctx: typer.Context, as_json: bool = typer.Option(False, "--json")) -> None:
    """Read append-only lifecycle audit records."""
    records = _run(_engine().audit_records)
    payload = [record.model_dump(mode="json") for record in records]
    _emit(ctx, payload, json.dumps(payload, indent=2), as_json=as_json)


@app.command()
def backups(ctx: typer.Context, as_json: bool = typer.Option(False, "--json")) -> None:
    """List timestamped byte snapshots available for one-click rollback."""
    snapshots = _run(_engine().backups)
    _emit(ctx, snapshots, "\n".join(snapshots) or "No snapshots", as_json=as_json)


@app.command(name="dashboard")
def dashboard_fleet(
    ctx: typer.Context,
    no_open: bool = typer.Option(False, "--no-open"),
    demo: bool = typer.Option(False, "--demo"),
    data_root: Path | None = typer.Option(None, "--data-root"),  # noqa: B008 - Typer API
    output: Path | None = typer.Option(None, "--output"),  # noqa: B008 - Typer API
) -> None:
    """Generate an offline HTML fleet dashboard without executing any action."""
    engine = FleetEngine(data_root=data_root) if data_root is not None else _engine()
    page = _run(lambda: dashboard.render_fleet(engine, demo=demo, output_path=output))
    if not no_open:
        webbrowser.open(page.as_uri())
    _emit(ctx, {"dashboard": str(page)}, f"Fleet dashboard: {page}")
