"""Native Git policy entrypoints for Just and actual Git commit hooks."""

from pathlib import Path

import typer
from rich.console import Console

from rill_cli.core.dashboard import record_ci
from rill_cli.core.git_policy import check_staged, validate_message

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


@app.command("commit-msg")
def commit_msg(message_file: Path) -> None:
    """Validate the candidate's Conventional Commit message."""
    try:
        validate_message(message_file.read_text(encoding="utf-8"))
    except ValueError as exc:
        console.print(str(exc))
        raise typer.Exit(1) from exc
    except OSError as exc:
        console.print(str(exc))
        raise typer.Exit(2) from exc


@app.command("ci-receipt")
def ci_receipt(tier: str, status: str) -> None:
    """Store a revision-bound local CI observation without treating it as approval."""
    try:
        record_ci(Path.cwd(), tier, status)
    except ValueError as exc:
        console.print(str(exc))
        raise typer.Exit(1) from exc
