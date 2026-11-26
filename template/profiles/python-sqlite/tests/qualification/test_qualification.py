import os
import subprocess
from pathlib import Path

import pytest
from disposable import copy_project

MISSPELLING = "te" + "hnique"


def mise_run(workspace: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    environment = {**os.environ, "MISE_TRUSTED_CONFIG_PATHS": str(workspace)}
    environment.pop("VIRTUAL_ENV", None)
    environment["UV_PROJECT_ENVIRONMENT"] = str(workspace / ".venv")
    result = subprocess.run(
        ["mise", *arguments],
        cwd=workspace,
        env=environment,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    print(
        f"mise {' '.join(arguments)} -> {result.returncode}\n{result.stdout}{result.stderr}"
    )
    return result


@pytest.fixture
def consumer(tmp_path: Path) -> Path:
    copy_project(Path.cwd(), tmp_path)
    assert mise_run(tmp_path, "exec", "--", "uv", "sync", "--locked").returncode == 0
    return tmp_path


def expect_rejection(consumer: Path, task: str, diagnostic: str) -> str:
    result = mise_run(consumer, "run", task)
    output = result.stdout + result.stderr
    assert result.returncode != 0 and diagnostic in output
    return output


def test_positive_locked_verify(consumer: Path) -> None:
    assert mise_run(consumer, "run", "verify").returncode == 0


@pytest.mark.parametrize(
    ("task", "fixture", "text", "diagnostic"),
    [
        (
            "format-check",
            "src/unformatted.py",
            "sample=[1,2]\n",
            "would be reformatted",
        ),
        ("lint", "src/undefined.py", "value = missing_name\n", "F821"),
        ("typecheck", "src/typed.py", 'total: int = "words"\n', "reportAssignmentType"),
        ("spelling", "word.txt", f"this is {MISSPELLING} wrong\n", MISSPELLING),
    ],
)
def test_native_checker_detects_representative_fault(
    consumer: Path, task: str, fixture: str, text: str, diagnostic: str
) -> None:
    (consumer / fixture).write_text(text)
    expect_rejection(consumer, task, diagnostic)


def test_formatter_has_stable_output(consumer: Path) -> None:
    sample = consumer / "src" / "unformatted.py"
    sample.write_text("sample=[1,2]\n")
    assert mise_run(consumer, "run", "format").returncode == 0
    assert sample.read_text() == "sample = [1, 2]\n"
    first = sample.read_bytes(), (consumer / "README.md").read_bytes()
    assert mise_run(consumer, "run", "format").returncode == 0
    assert (sample.read_bytes(), (consumer / "README.md").read_bytes()) == first
    assert mise_run(consumer, "run", "format-check").returncode == 0


def test_links_reject_missing_local_target(consumer: Path) -> None:
    readme = consumer / "README.md"
    readme.write_text(
        readme.read_text() + "\n[Broken reference](./missing-target.md)\n"
    )
    expect_rejection(consumer, "links", "missing-target.md")


def test_secret_scan_detects_and_redacts_synthetic_example(consumer: Path) -> None:
    synthetic = "gh" + "p_" + "b7V92KrLhA51EQTU9fWq7Z8c6xn4JadM3z2X"
    (consumer / "temporary.env").write_text(f"TOKEN={synthetic}\n")
    output = expect_rejection(consumer, "scan-secrets", "github-pat")
    assert synthetic not in output


def test_osv_rejects_a_known_advisory_from_the_python_lock(consumer: Path) -> None:
    (consumer / "uv.lock").write_text(
        'version = 1\nrequires-python = ">=3.13"\n\n'
        '[[package]]\nname = "requests"\nversion = "2.31.0"\n'
        'source = { registry = "https://pypi.org/simple" }\n'
    )
    expect_rejection(consumer, "scan-dependencies", "GHSA-9wx4-h78v-vm56")


def test_osv_rejects_a_lock_with_no_resolved_packages(consumer: Path) -> None:
    (consumer / "uv.lock").write_text('version = 1\nrequires-python = ">=3.13"\n')
    expect_rejection(consumer, "scan-dependencies", "No package sources found")


def test_verify_rejects_missing_behavior_test_file(consumer: Path) -> None:
    (consumer / "tests/behavior/test_model.py").unlink()
    expect_rejection(consumer, "verify", "Unexpected behavior suite inventory")


def test_verify_rejects_a_skipped_case(consumer: Path) -> None:
    test = consumer / "tests/behavior/test_requests.py"
    test.write_text(
        test.read_text() + '\n\ndef test_unapproved_skip():\n    pytest.skip("skip")\n'
    )
    expect_rejection(consumer, "verify", "Unexpected behavior pytest report")


def test_verify_rejects_a_title_validation_noop(consumer: Path) -> None:
    source = consumer / "src/rill_sqlite_tasks/requests.py"
    prefix, _, _ = source.read_text().partition("    if not title.strip()")
    source.write_text(prefix + "    return title\n")
    expect_rejection(consumer, "verify", "DID NOT RAISE")


def test_behavior_rejects_an_interruption_that_wrongly_commits(consumer: Path) -> None:
    source = consumer / "src/rill_sqlite_tasks/store.py"
    original = source.read_text()
    assert original.count('database.execute("ROLLBACK")') == 1
    source.write_text(
        original.replace('database.execute("ROLLBACK")', 'database.execute("COMMIT")')
    )
    expect_rejection(
        consumer,
        "test",
        "test_interrupted_transaction_recovers_via_normal_operation[during-add",
    )


def test_mutation_gate_detects_survivors_in_a_weakened_suite(consumer: Path) -> None:
    (consumer / "tests/behavior/test_requests.py").write_text(
        "from rill_sqlite_tasks.requests import validate_title\n\n"
        'def test_valid_title():\n    assert validate_title("read") == "read"\n'
    )
    expect_rejection(consumer, "mutation", "Mutation gate rejected native results")
    assert "survived" in (consumer / "reports/mutation/results.txt").read_text()
