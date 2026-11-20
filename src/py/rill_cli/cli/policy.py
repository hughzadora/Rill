"""Native Git policy entrypoints for Just and actual Git commit hooks."""

import subprocess
from pathlib import Path

import typer
from rich.console import Console

from rill_cli.core.dashboard import record_ci
from rill_cli.core.git_policy import check_staged
from rill_cli.core.governance_gate import check_pre_commit, release_gate

app = typer.Typer(help="Deterministic branch, atomic commit and message gates")
console = Console(stderr=True)


@app.command("pre-commit")
def pre_commit() -> None:
    """Check staged business file limits, branch and frontend/backend isolation."""
    try:
        check_staged(Path.cwd())
        check_pre_commit(Path.cwd())
    except (PermissionError, ValueError, subprocess.CalledProcessError) as exc:
        console.print(str(exc))
        raise typer.Exit(1) from exc


@app.command("governance-check")
def governance_check(release: bool = typer.Option(False, "--release")) -> None:
    """Native contract/test-deletion gate; release also verifies L3 CI and P0."""
    try:
        if release:
            blockers = release_gate(Path.cwd())
            if blockers:
                raise PermissionError("; ".join(blockers))
        else:
            check_pre_commit(Path.cwd())
    except (PermissionError, ValueError, OSError, subprocess.SubprocessError) as exc:
        console.print(f"BLOCKED: {exc}")
        raise typer.Exit(1) from exc


@app.command("ci-receipt")
def ci_receipt(tier: str, status: str, start_head: str) -> None:
    """Store a revision-bound local CI observation without treating it as approval."""
    try:
        record_ci(Path.cwd(), tier, status, start_head)
    except ValueError as exc:
        console.print(str(exc))
        raise typer.Exit(1) from exc
