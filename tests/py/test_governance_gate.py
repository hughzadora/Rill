"""L4 negative checks use real Git stages, schema and native CI receipts."""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from rill_cli import __version__
from rill_cli.core.constants import CI_SUMMARY_PATH, MISE_RILL_FRAGMENT
from rill_cli.core.git_policy import git, revision
from rill_cli.core.governance_contract import DefectRecord, Severity
from rill_cli.core.governance_engine import GovernanceEngine
from rill_cli.core.governance_gate import check_pre_commit, committed_test_deletions, release_gate
from rill_cli.core.governance_git import RepairWorkspace, freeze_contracts
from rill_cli.core.installer import install


@pytest.fixture
def workspace(tmp_path: Path) -> tuple[Path, GovernanceEngine]:
    root = tmp_path / "business"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/acceptance")
    (root / ".gitignore").write_text(".rill/\n", encoding="utf-8")
    (root / "contracts").mkdir()
    (root / "contracts/api.json").write_text('{"type":"object"}\n', encoding="utf-8")
    (root / "tests").mkdir()
    (root / "tests/test_api.py").write_text("def test_contract():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: baseline",
    )
    engine = GovernanceEngine(root, data_root=tmp_path / "data")
    freeze_contracts(engine, ["contracts/"])
    return root, engine


def _receipt(root: Path, *, sha: str | None = None) -> None:
    current = sha or revision(root)
    output = root / CI_SUMMARY_PATH
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "head": current,
                "tier": "full",
                "result": "pass",
                "last_verified_sha": current,
            }
        ),
        encoding="utf-8",
    )


def test_l1_contract_is_immutable_during_integration(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    (root / "contracts/api.json").write_text('{"type":"string"}\n', encoding="utf-8")
    git(root, "add", "contracts/api.json")
    with pytest.raises(PermissionError, match="Frozen L1"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)
    git(root, "restore", "--source=HEAD", "--staged", "--worktree", "--", "contracts/api.json")
    check_pre_commit(root, data_root=engine.data_root.parent.parent)


def test_test_deletion_is_blocked_without_skipping_assertions(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    git(root, "rm", "tests/test_api.py")
    with pytest.raises(PermissionError, match="deleted tests"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)
    git(root, "restore", "--source=HEAD", "--staged", "--worktree", "--", "tests/test_api.py")
    check_pre_commit(root, data_root=engine.data_root.parent.parent)


def test_stale_revision_and_dirty_source_never_receive_release_status(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    data_root = engine.data_root.parent.parent
    _receipt(root)
    assert any(
        "independently observed" in entry for entry in release_gate(root, data_root=data_root)
    )
    (root / "untracked.py").write_text("unexpected = 1\n")
    assert any("uncommitted" in item for item in release_gate(root, data_root=data_root))
    (root / "untracked.py").unlink()
    (root / "feature.py").write_text("changed = True\n")
    git(root, "add", "feature.py")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: changed head",
    )
    assert any("stale" in item for item in release_gate(root, data_root=data_root))


def test_unresolved_p0_blocks_despite_green_receipt(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    _receipt(root)
    engine.register(
        DefectRecord(
            identity="p0-critical",
            severity=Severity.P0,
            baseline_revision=revision(root),
            root_cause="customer data corruption",
        )
    )
    result = release_gate(root, data_root=engine.data_root.parent.parent)
    assert any("p0-critical" in item for item in result)


def test_unfrozen_and_missing_ci_never_approve(tmp_path: Path) -> None:
    repo = tmp_path / "unmanaged"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "feat/unmanaged")
    (repo / "README.md").write_text("# Business\n")
    git(repo, "add", "README.md")
    git(
        repo,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: init",
    )
    assert check_pre_commit(repo, data_root=tmp_path / "data") is None
    blockers = release_gate(repo, data_root=tmp_path / "data")
    assert "L1 contract has not been frozen" in blockers
    assert "Missing L3 CI receipt" in blockers


def test_deleted_test_in_prior_commit_is_rejected_at_release(
    workspace: tuple[Path, GovernanceEngine],
) -> None:
    root, engine = workspace
    git(root, "rm", "tests/test_api.py")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: delete test",
    )
    _receipt(root)
    blockers = release_gate(root, data_root=engine.data_root.parent.parent)
    assert any("Committed test deletions" in issue for issue in blockers)
    assert not (root / "tests/test_api.py").exists()


def test_ci_checks_already_committed_test_deletion_against_event_base(
    workspace: tuple[Path, GovernanceEngine], monkeypatch: pytest.MonkeyPatch
) -> None:
    root, engine = workspace
    previous = revision(root)
    git(root, "rm", "tests/test_api.py")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: delete test",
    )
    assert git(root, "status", "--porcelain").stdout == ""
    monkeypatch.setenv("CI", "true")
    monkeypatch.setenv("RILL_CI_BASE_SHA", previous)
    with pytest.raises(PermissionError, match="Committed test deletions"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)
    monkeypatch.delenv("RILL_CI_BASE_SHA")
    with pytest.raises(PermissionError, match="no trustworthy native event base"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)


def test_generated_ci_installs_pinned_binary_before_executing_checks(tmp_path: Path) -> None:
    project = install(tmp_path / "native-ci")
    config = (project / MISE_RILL_FRAGMENT).read_text(encoding="utf-8")
    assert f'version = "v{__version__}"' in config
    assert 'asset_pattern = "rill-linux-x64.tar.gz"' in config
    workflow = (project / ".github/workflows/rill-quality.yml").read_text(encoding="utf-8")
    assert "fetch-depth: 0" in workflow
    assert "RILL_CI_BASE_SHA:" in workflow
    assert "mise install 'github:hughzadora/Rill'" in workflow
    assert workflow.index("mise install 'github:hughzadora/Rill'") < workflow.index("just setup-ci")
    assert "mise exec -- just ci" in workflow


def test_generated_ci_fails_closed_when_release_cli_is_unavailable(tmp_path: Path) -> None:
    """A fresh PR runner must not silently skip the mandatory governance gate."""
    project = install(tmp_path / "generated")
    just = shutil.which("just")
    assert just is not None
    # Keep standard host tools, deliberately not the Rill virtualenv or mise shim.
    environment = {**os.environ, "PATH": "/usr/bin:/bin", "CI": "true"}
    result = subprocess.run(  # noqa: S603 - native Just CLI in isolated repo
        [just, "ci"],
        cwd=project,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "Rill CLI missing" in result.stderr
    assert "before CI" in result.stderr
    generated = (project / "justfile").read_text(encoding="utf-8")
    assert "if True" not in generated and "if False" not in generated
    assert '[ "$(git rev-parse HEAD)" != "$START_HEAD" ]' in generated


def test_root_actions_pin_real_event_baselines_with_complete_history() -> None:
    root = Path(__file__).resolve().parents[2]
    quality = (root / ".github/workflows/quality.yml").read_text(encoding="utf-8")
    release = (root / ".github/workflows/release-rill.yml").read_text(encoding="utf-8")
    assert "github.event.pull_request.base.sha || github.event.before" in quality
    assert "fetch-depth: 0" in quality
    assert "git describe --tags --abbrev=0 --match 'v*' HEAD^" in release
    assert 'RILL_CI_BASE_SHA=$(git rev-parse "$previous^{commit}")' in release
    assert "fetch-depth: 0" in release
    assert "tags: ['v*']" in release


def test_registration_before_freeze_can_recover_without_disabling_gate(
    tmp_path: Path,
) -> None:
    root = tmp_path / "registered-first"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/candidate")
    (root / "api.json").write_text("{}\n", encoding="utf-8")
    git(root, "add", "api.json")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: contract",
    )
    engine = GovernanceEngine(root, data_root=tmp_path / "data")
    engine.register(
        DefectRecord(
            identity="pre-freeze",
            severity=Severity.P0,
            baseline_revision=revision(root),
            root_cause="unverified initial defect",
        )
    )
    check_pre_commit(root, data_root=tmp_path / "data")
    with pytest.raises(PermissionError, match="No frozen L1"):
        RepairWorkspace(engine, "pre-freeze").open()
    freeze_contracts(engine, ["api.json"])
    check_pre_commit(root, data_root=tmp_path / "data")
    (root / "api.json").write_text('{"changed":true}\n', encoding="utf-8")
    git(root, "add", "api.json")
    with pytest.raises(PermissionError, match="L1 contract"):
        check_pre_commit(root, data_root=tmp_path / "data")


def test_nonroot_copier_python_test_deletion_staged_and_committed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "custom-tests"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/candidate")
    tests = root / "services/worker/tests"
    tests.mkdir(parents=True)
    (tests / "test_edge.py").write_text("def test_edge():\n    assert True\n")
    (root / ".rill").mkdir()
    (root / ".rill/copier-answers.yml").write_text(
        "python: true\npython_root: services/worker\npython_tests: tests\n"
    )
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: baseline",
    )
    baseline = revision(root)
    git(root, "rm", "services/worker/tests/test_edge.py")
    with pytest.raises(PermissionError, match="deleted tests"):
        check_pre_commit(root, data_root=tmp_path / "data")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: malicious deletion",
    )
    monkeypatch.setenv("CI", "true")
    monkeypatch.setenv("RILL_CI_BASE_SHA", baseline)
    with pytest.raises(PermissionError, match="Committed test deletions"):
        check_pre_commit(root, data_root=tmp_path / "data")


def test_hosted_baseline_never_leaks_into_unrelated_temp_repositories(
    workspace: tuple[Path, GovernanceEngine],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, engine = workspace
    monkeypatch.setenv("CI", "true")
    monkeypatch.setenv("GITHUB_WORKSPACE", str(tmp_path / "other-hosted-repo"))
    monkeypatch.setenv("RILL_CI_BASE_SHA", "a" * 40)
    check_pre_commit(root, data_root=engine.data_root.parent.parent)
    monkeypatch.setenv("GITHUB_WORKSPACE", str(root))
    with pytest.raises(PermissionError, match="not an ancestor"):
        check_pre_commit(root, data_root=engine.data_root.parent.parent)


def test_release_interval_includes_earlier_deleted_test(tmp_path: Path) -> None:
    root = tmp_path / "release-history"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/candidate")
    (root / "tests").mkdir()
    (root / "tests/test_example.py").write_text("def test_original():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: baseline",
    )
    git(root, "tag", "v0.1.0")
    old_release = revision(root)
    git(root, "rm", "tests/test_example.py")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: remove old test",
    )
    (root / "README.md").write_text("Other feature\n")
    git(root, "add", "README.md")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "feat: unrelated",
    )
    assert not committed_test_deletions(root, git(root, "rev-parse", "HEAD^").stdout.strip())
    tag = git(root, "describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD^")
    assert tag.stdout.strip() == "v0.1.0"
    assert committed_test_deletions(root, old_release)


def test_original_copier_test_roots_survive_profile_relocation(tmp_path: Path) -> None:
    root = tmp_path / "relocated"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/candidate")
    (root / ".rill").mkdir()
    (root / ".rill/copier-answers.yml").write_text(
        "python: true\npython_root: services/old\npython_tests: tests\n"
    )
    target = root / "services/old/tests/test_feature.py"
    target.parent.mkdir(parents=True)
    target.write_text("def test_case():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: old profile",
    )
    original = revision(root)
    git(root, "rm", "services/old/tests/test_feature.py")
    (root / ".rill/copier-answers.yml").write_text(
        "python: false\npython_root: services/new\npython_tests: tests\n"
    )
    git(root, "add", ".rill/copier-answers.yml")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "refactor: move profile",
    )
    assert committed_test_deletions(root, original)


def test_merge_resolution_deleted_test_is_detected(tmp_path: Path) -> None:
    root = tmp_path / "merge-deletion"
    root.mkdir()
    git(root, "init", "-q", "-b", "feat/base")
    (root / "tests").mkdir()
    target = root / "tests/test_case.py"
    target.write_text("def test_a():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "test: original",
    )
    original = revision(root)
    git(root, "switch", "-c", "feat/side")
    target.write_text("def test_side():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "feat: side",
    )
    git(root, "switch", "feat/base")
    target.write_text("def test_main():\n    assert True\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "feat: main",
    )
    merge = git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "merge",
        "--no-ff",
        "--no-commit",
        "feat/side",
        check=False,
    )
    assert merge.returncode != 0
    git(root, "rm", "tests/test_case.py")
    git(
        root,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "merge: resolve deleting test",
    )
    assert committed_test_deletions(root, original)
