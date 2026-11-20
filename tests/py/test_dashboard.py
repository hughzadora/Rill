"""Dashboard facts, output sanitization and one-shot HTTP receipts."""

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import cast
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from rill_cli.core.constants import CI_SUMMARY_PATH, DASHBOARD_PATH, MAX_SYMBOL_LINES, SYMBOLS_PATH
from rill_cli.core.dashboard import facts, receipt, record_ci, render
from rill_cli.core.git_policy import git, revision
from rill_cli.core.installer import install
from rill_cli.core.state import load, save


@pytest.fixture
def project(tmp_path: Path) -> Path:
    return install(tmp_path / "product")


def test_dashboard_contains_real_git_timeline_and_bounded_symbols(project: Path) -> None:
    entries = [f"src/app.py:1 FunctionDef function{index}" for index in range(MAX_SYMBOL_LINES + 1)]
    (project / SYMBOLS_PATH).write_text("\n".join(entries), encoding="utf-8")
    record_ci(project, "full", "pass", revision(project))
    observed = facts(project)
    assert observed["shortHead"] != "(unborn)"
    assert len(str(observed["symbols"]).splitlines()) == MAX_SYMBOL_LINES
    assert isinstance(observed["ci"], dict)
    assert observed["ci"]["result"] == "pass"
    assert observed["ci"]["head"] == revision(project)
    assert observed["ci"]["last_verified_sha"] == revision(project)
    assert observed["history"]
    assert observed["branch"] == "feat/rill-init"
    assert observed["dirty"] == 0


def test_html_json_is_escaped_not_interpreted_as_markup(project: Path) -> None:
    state = load(project)
    state["task_goal"] = "</script><script>window.stolen=1</script>"
    save(project, state)
    html = render(project).read_text(encoding="utf-8")
    assert "window.stolen=1</script>" not in html
    assert "\\u003c/script\\u003e" in html
    assert 'id="rill-data"' in html
    assert (project / DASHBOARD_PATH).exists()


def test_decision_is_bounded_and_does_not_change_authority(project: Path) -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        receipt(project, "purchase")
    receipt(project, "escalate")
    data = load(project)
    assert data["owner_decision"] == "escalate"
    assert data["mode"] == "normal"
    receipt(project, "reject")
    assert load(project)["owner_decision"] == "reject"


def test_loopback_receipt_rejects_bad_token_and_exits_after_valid_decision(project: Path) -> None:
    with subprocess.Popen(  # noqa: S603 - local CLI and fixed argument vector
        [sys.executable, "-m", "rill_cli", "ui", str(project), "--serve", "--no-open"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ) as child:
        assert child.stdout is not None
        origin = child.stdout.readline().strip()
        assert origin.startswith("http://127.0.0.1:")
        body = urlopen(origin, timeout=5).read().decode("utf-8")  # noqa: S310 - loopback-only bound test
        embedded = re.search(r'<script type="application/json" id="rill-data">(.+)</script>', body)
        assert embedded is not None
        token = json.loads(embedded.group(1))["token"]
        # Another read-only refresh must not invalidate the pending HTTP receipt.
        render(project)
        serving_page = urlopen(origin, timeout=5).read().decode("utf-8")  # noqa: S310
        serving_data = re.search(
            r'<script type="application/json" id="rill-data">(.+)</script>', serving_page
        )
        assert serving_data is not None
        assert json.loads(serving_data.group(1))["serving"] is True

        def post(value: str) -> int:
            payload = json.dumps({"token": value, "decision": "approve"}).encode()
            request = Request(  # noqa: S310 - loopback-only bound test
                origin + "/decision",
                data=payload,
                method="POST",
                headers={"Content-Type": "application/json", "Origin": origin},
            )
            try:
                return urlopen(request, timeout=5).status  # noqa: S310 - localhost test
            except HTTPError as exc:
                return exc.code

        assert post("invalid") == 400
        assert post(token) == 204
        assert child.wait(timeout=5) == 0
    assert load(project)["owner_decision"] == "approve"
    assert '"serving":false' in (project / DASHBOARD_PATH).read_text(encoding="utf-8")


def test_ci_receipt_is_atomic_and_rejected_for_stale_revision(project: Path) -> None:
    record_ci(project, "ci", "running", revision(project))
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "running"
    record_ci(project, "ci", "pass", revision(project))
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "pass"
    payload = json.loads((project / CI_SUMMARY_PATH).read_text(encoding="utf-8"))
    assert payload["head"] == revision(project)
    assert payload["last_verified_sha"] == revision(project)
    (project / "new.txt").write_text("New revision\n", encoding="utf-8")
    git(project, "add", "new.txt")
    git(project, "-c", "core.hooksPath=/dev/null", "commit", "-m", "test(rill): change revision")
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "unverified"
    with pytest.raises(ValueError, match="Unsupported CI"):
        record_ci(project, "full", "faked-green", revision(project))


def test_ci_rejects_concurrent_commit_without_writing_false_green(project: Path) -> None:
    original_head = revision(project)
    record_ci(project, "full", "running", original_head)
    before = (project / CI_SUMMARY_PATH).read_bytes()
    (project / "new-revision.txt").write_text("New revision\n", encoding="utf-8")
    git(project, "add", "new-revision.txt")
    git(project, "-c", "core.hooksPath=/dev/null", "commit", "-m", "test(rill): change HEAD")
    assert revision(project) != original_head
    with pytest.raises(ValueError, match="HEAD changed during CI"):
        record_ci(project, "full", "pass", original_head)
    assert (project / CI_SUMMARY_PATH).read_bytes() == before
    assert "last_verified_sha" not in json.loads(before)
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "unverified"


def test_dirty_worktree_cannot_carry_verified_sha(project: Path) -> None:
    """The passing working-tree result must not certify its older commit."""
    current = revision(project)
    record_ci(project, "full", "pass", current)
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "pass"
    (project / "new.py").write_text("value = 2\n", encoding="utf-8")
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "unverified"
    record_ci(project, "full", "pass", current)
    summary = json.loads((project / CI_SUMMARY_PATH).read_text(encoding="utf-8"))
    assert summary["result"] == "unverified"
    assert "last_verified_sha" not in summary
    git(project, "add", "new.py")
    git(
        project,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: new commit",
    )
    record_ci(project, "full", "pass", revision(project))
    summary = json.loads((project / CI_SUMMARY_PATH).read_text(encoding="utf-8"))
    assert summary["last_verified_sha"] == revision(project)
    assert cast("dict[str, object]", facts(project)["ci"])["result"] == "pass"
