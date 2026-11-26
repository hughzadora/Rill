import json
import os
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from disposable import copy_project


def run_mutation(root: Path) -> None:
    if not hasattr(os, "fork"):
        raise SystemExit("mutmut requires a fork-capable environment")
    output = root / "reports" / "mutation"
    output.mkdir(parents=True, exist_ok=True)
    for name in ("stats.json", "results.txt", "run.txt"):
        (output / name).unlink(missing_ok=True)
    with TemporaryDirectory(prefix="rill-mutmut-") as temporary:
        workspace = Path(temporary)
        copy_project(root, workspace)
        environment = dict(os.environ)
        environment.pop("VIRTUAL_ENV", None)
        environment["UV_PROJECT_ENVIRONMENT"] = str(workspace / ".venv")
        subprocess.run(
            ["uv", "sync", "--locked"], cwd=workspace, env=environment, check=True
        )
        command = ["uv", "run", "--locked", "--no-sync", "mutmut"]
        with (output / "run.txt").open("w", encoding="utf-8") as log:
            subprocess.run(
                [*command, "run", "--max-children", "2"],
                cwd=workspace,
                env=environment,
                stdout=log,
                stderr=subprocess.STDOUT,
                check=True,
            )
        with (output / "results.txt").open("w", encoding="utf-8") as results:
            subprocess.run(
                [*command, "results", "--all", "true"],
                cwd=workspace,
                env=environment,
                stdout=results,
                check=True,
            )
        subprocess.run(
            [*command, "export-cicd-stats"], cwd=workspace, env=environment, check=True
        )
        shutil.copyfile(
            workspace / "mutants/mutmut-cicd-stats.json", output / "stats.json"
        )
    data = json.loads((output / "stats.json").read_text())
    print((output / "results.txt").read_text(), end="")
    counts = {
        "survived",
        "no_tests",
        "skipped",
        "suspicious",
        "timeout",
        "check_was_interrupted_by_user",
        "segfault",
    }
    if (
        type(data["total"]) is not int
        or data["total"] < 1
        or data["killed"] != data["total"]
        or any(data[name] != 0 for name in counts)
    ):
        raise SystemExit(f"Mutation gate rejected native results: {data}")
    print(f"Mutation gate passed for {data['total']} mutants")


if __name__ == "__main__":
    run_mutation(Path.cwd())
