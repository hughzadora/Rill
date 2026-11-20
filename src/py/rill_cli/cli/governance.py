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


def _authorize(yes: bool) -> None:
    if not yes:
        raise typer.BadParameter("Explicit --yes is required for governance mutations")


@app.command()
def freeze(
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer API
    files: list[str] = typer.Option(..., "--file", help="Git-tracked L1 source"),  # noqa: B008
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Pin a clean Git revision and its native L1 source object IDs once."""
    from rill_cli.core.governance_git import freeze_contracts  # noqa: PLC0415

    _authorize(yes)
    try:
        frozen = freeze_contracts(GovernanceEngine(path), files)
        typer.echo(json.dumps(frozen.model_dump(mode="json"), ensure_ascii=False))
    except (OSError, ValueError, PermissionError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc


@app.command()
def register(
    identity: str,
    severity: str = typer.Option(..., "--severity"),
    cause: str = typer.Option(..., "--cause"),
    hard_gate: bool = typer.Option(True, "--hard-gate/--noncritical"),
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Register a durable repair budget for the current Git repository."""
    from rill_cli.core.git_policy import revision  # noqa: PLC0415
    from rill_cli.core.governance_contract import DefectRecord, Severity  # noqa: PLC0415

    _authorize(yes)
    try:
        engine = GovernanceEngine(Path.cwd())
        grade = Severity(severity)
        item = engine.register(
            DefectRecord(
                identity=identity,
                severity=grade,
                baseline_revision=revision(engine.root),
                root_cause=cause,
                hard_gate=hard_gate or grade == Severity.P0,
            )
        )
        typer.echo(item.model_dump_json())
    except (OSError, ValueError, PermissionError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc


@app.command(
    "baseline-check", context_settings={"allow_extra_args": True, "ignore_unknown_options": True}
)
def baseline_check(
    ctx: typer.Context,
    identity: str,
    path: Path = typer.Option(Path("."), "--repo"),  # noqa: B008 - Typer API
) -> None:
    """Witness a real failing regression in an isolated baseline checkout."""
    from rill_cli.core.governance_git import RepairWorkspace  # noqa: PLC0415

    command = list(ctx.args)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        raise typer.BadParameter("Provide the exact native regression command after --")
    try:
        receipt = RepairWorkspace(GovernanceEngine(path), identity).witness_baseline(command)
        typer.echo(receipt.model_dump_json())
    except (OSError, ValueError, PermissionError, KeyError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc


@app.command()
def begin(
    identity: str,
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer API
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Consume a repair attempt and create an isolated native Git worktree."""
    from rill_cli.core.governance_git import RepairWorkspace  # noqa: PLC0415

    _authorize(yes)
    try:
        checkout = RepairWorkspace(GovernanceEngine(path), identity).open()
        typer.echo(json.dumps({"checkout": str(checkout), "status": "ATTEMPTING"}))
    except (OSError, ValueError, PermissionError, KeyError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc


@app.command(context_settings={"allow_extra_args": True, "ignore_unknown_options": True})
def check(
    ctx: typer.Context,
    identity: str,
    path: Path = typer.Option(Path("."), "--repo"),  # noqa: B008 - Typer API
    isolate_test: str | None = typer.Option(None, "--isolate-test"),
    isolation_rationale: str | None = typer.Option(None, "--isolation-rationale"),
) -> None:
    """Run an argv-only test in the owned checkout; failure rolls it back."""
    from rill_cli.core.governance_git import RepairWorkspace  # noqa: PLC0415

    command = list(ctx.args)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        raise typer.BadParameter("Provide a native command after --")
    try:
        receipt = RepairWorkspace(GovernanceEngine(path), identity).run_check(
            command,
            isolate_test=isolate_test,
            isolation_rationale=isolation_rationale,
        )
        typer.echo(receipt.model_dump_json())
        if receipt.exit_code:
            raise typer.Exit(1)
        typer.echo("CHECK PASSED; Git revision and independent release gates remain required.")
    except (OSError, ValueError, PermissionError, KeyError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc


@app.command()
def abort(
    identity: str,
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer API
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Cancel an owned attempt, consume its budget, verify scratch cleanup."""
    from rill_cli.core.git_policy import revision  # noqa: PLC0415
    from rill_cli.core.governance_contract import AttemptEvidence  # noqa: PLC0415
    from rill_cli.core.governance_git import RepairWorkspace  # noqa: PLC0415

    _authorize(yes)
    try:
        worker = RepairWorkspace(GovernanceEngine(path), identity)
        selected = worker.engine.load().defects[identity]
        checkout = worker.path()
        receipt = AttemptEvidence(
            revision=revision(checkout),
            command="rill governance abort",
            exit_code=1,
            summary="Owner cancelled attempt; no test result claimed",
        )
        typer.echo(
            worker.abort(
                receipt,
                expected_checkout=checkout,
                expected_attempt=selected.attempt_count,
            ).model_dump_json()
        )
    except (OSError, ValueError, PermissionError, KeyError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc


@app.command()
def complete(
    identity: str,
    path: Path = typer.Argument(Path(".")),  # noqa: B008 - Typer API
    yes: bool = typer.Option(False, "--yes"),
) -> None:
    """Fast-forward a verified feature-branch repair; never merge into main."""
    from rill_cli.core.governance_git import RepairWorkspace  # noqa: PLC0415

    _authorize(yes)
    try:
        worker = RepairWorkspace(GovernanceEngine(path), identity)
        typer.echo(worker.complete().model_dump_json())
    except (OSError, ValueError, PermissionError, KeyError, subprocess.SubprocessError) as exc:
        errors.print(f"BLOCKED: {exc}", style="red")
        raise typer.Exit(1) from exc
