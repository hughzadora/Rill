"""Native Git policy entrypoints for Just and actual Git commit hooks."""

from pathlib import Path

import typer
from rich.console import Console

from rill_cli.core.dashboard import record_ci
from rill_cli.core.git_policy import check_staged

app = typer.Typer(help="Deterministic branch, atomic commit and message gates")
console = Console(stderr=True)


@app.command("pre-commit")
def pre_commit() -> None:
    """Check staged business file limits, branch and frontend/backend isolation."""
    try:
        check_staged(Path.cwd())
    except PermissionError as exc:
        console.print(str(exc))
        raise typer.Exit(1) from exc


@app.command("ci-receipt")
def ci_receipt(tier: str, status: str, start_head: str) -> None:
    """Store a revision-bound local CI observation without treating it as approval."""
    try:
        record_ci(Path.cwd(), tier, status, start_head)
    except ValueError as exc:
        console.print(str(exc))
        raise typer.Exit(1) from exc
