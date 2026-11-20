"""Thin read-only Typer adapter over the independent governance domain."""

import json
import subprocess
from pathlib import Path
from typing import cast

import typer
from rich.console import Console
from rich.table import Table

from rill_cli.core.governance_engine import GovernanceEngine

app = typer.Typer(no_args_is_help=True, help="Inspect bounded repair budgets and L1 freezes")
errors = Console(stderr=True)
console = Console()


@app.command()
def status(
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer declarative API
    as_json: bool = typer.Option(False, "--json"),
) -> None:
    """Read persisted defect and freeze evidence; never mutate Git or state."""
    try:
        report = GovernanceEngine(path).summary()
    except (OSError, PermissionError, ValueError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc
    if as_json:
        typer.echo(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
        return
    table = Table(title=f"Governance · {report['governance_gate']}")
    table.add_column("Defect")
    table.add_column("Severity")
    table.add_column("State")
    table.add_column("Attempts")
    entries = report.get("defects")
    if isinstance(entries, list):
        for item in cast("list[object]", entries):
            if isinstance(item, dict):
                entry = cast("dict[str, object]", item)
                table.add_row(
                    str(entry["identity"]),
                    str(entry["severity"]),
                    str(entry["state"]),
                    f"{entry['attempts']}/{entry['limit']}",
                )
    console.print(table)
    console.print(f"L1 frozen: {report['contract_frozen']} · Scope: {report['scope']}")
    blockers = report.get("blockers")
    if isinstance(blockers, list):
        for blocker in cast("list[object]", blockers):
            errors.print(f"BLOCKED: {blocker}", style="yellow")
