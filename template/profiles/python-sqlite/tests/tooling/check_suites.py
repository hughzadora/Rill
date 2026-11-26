import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree

SUITES = {
    "behavior": {
        "test_cli.py",
        "test_failure.py",
        "test_model.py",
        "test_requests.py",
        "test_store.py",
    },
    "qualification": {"test_qualification.py"},
}


def run_suite(suite: str) -> None:
    directory = Path("tests") / suite
    pytest = [
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "hypothesispytest",
        "-o",
        "junit_family=xunit1",
        str(directory),
    ]
    if suite == "qualification":
        pytest += ["-o", "junit_logging=all"]
    discovery = subprocess.run(
        [*pytest, "--collect-only", "-q"], capture_output=True, text=True, check=False
    )
    print(discovery.stdout, end="", flush=True)
    print(discovery.stderr, end="", file=sys.stderr, flush=True)
    if discovery.returncode:
        raise SystemExit(discovery.returncode)
    expected = {
        (file, name)
        for file, name in re.findall(
            r"^(tests/.+?\.py)::(.+)$", discovery.stdout, re.MULTILINE
        )
    }
    discovered_files = {file for file, _ in expected}
    required_files = {str(directory / name) for name in SUITES[suite]}
    if discovered_files != required_files:
        raise SystemExit(
            f"Unexpected {suite} suite inventory: {sorted(discovered_files)}"
        )

    report = Path("reports") / f"pytest-{suite}.xml"
    report.parent.mkdir(exist_ok=True)
    report.unlink(missing_ok=True)
    run = subprocess.run([*pytest, f"--junitxml={report}"], check=False)
    if run.returncode:
        raise SystemExit(run.returncode)
    results = ElementTree.parse(report).findall(".//testcase")
    actual = {(result.get("file"), result.get("name")) for result in results}
    if (
        actual != expected
        or len(results) != len(expected)
        or any(
            child.tag in {"skipped", "error", "failure"}
            for result in results
            for child in result
        )
    ):
        raise SystemExit(f"Unexpected {suite} pytest report identity or skipped case")


if __name__ == "__main__":
    run_suite(sys.argv[1])
