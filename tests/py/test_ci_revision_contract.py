"""CI receipts must never bless a Git revision that the run did not start on."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from rill_cli.cli.app import app
from rill_cli.core.constants import CI_SUMMARY_PATH
from rill_cli.core.git_policy import git, revision
from rill_cli.core.installer import install

REPOSITORY = Path(__file__).resolve().parents[2]


def test_cli_receipt_blocks_changed_head_without_updating_verified_sha(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = install(tmp_path / "project")
    start_head = revision(project)
    monkeypatch.chdir(project)
    runner = CliRunner()
    args = ["policy", "ci-receipt", "full"]
    assert runner.invoke(app, [*args, "running", start_head]).exit_code == 0
    initial = (project / CI_SUMMARY_PATH).read_bytes()
    (project / "new.txt").write_text("Change that CI did not test\n", encoding="utf-8")
    git(project, "add", "new.txt")
    git(project, "-c", "core.hooksPath=/dev/null", "commit", "-m", "test(rill): change head")
    assert revision(project) != start_head
    denied = runner.invoke(app, [*args, "pass", start_head])
    assert denied.exit_code != 0
    assert "HEAD changed during CI" in denied.output
    assert (project / CI_SUMMARY_PATH).read_bytes() == initial
    assert "last_verified_sha" not in json.loads(initial)


def test_root_and_consumer_full_ci_capture_head_before_running_checks() -> None:
    root = (REPOSITORY / "justfile").read_text(encoding="utf-8")
    consumer = (REPOSITORY / "standards/template/justfile.jinja").read_text(encoding="utf-8")
    for content, headings in (
        (root, ('ci mode="incremental":', "ci-full:")),
        (consumer, ("ci:", "ci-full:")),
    ):
        for heading in headings:
            lines = content.split("\n" + heading + "\n", maxsplit=1)[1].lstrip("\n").splitlines()
            assert lines[0].strip() == "#!/usr/bin/env bash"
            assert lines[1].strip() == 'START_HEAD="$(git rev-parse HEAD)" || exit 1'
        assert '"$(git rev-parse HEAD)" != "$START_HEAD"' in content
        assert 'ci-receipt full "$1" "$START_HEAD"' in content
