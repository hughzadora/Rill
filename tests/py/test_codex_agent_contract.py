"""Prevent distributed Codex roles and reviewer policy from drifting."""

import tomllib
from pathlib import Path
from typing import cast

from rill_cli.core.installer import install

REPOSITORY = Path(__file__).resolve().parents[2]
SOURCE = REPOSITORY / "standards/template"
ROLES = {"explorer", "worker", "reviewer"}
MODELS = {
    "explorer": ("gpt-6-luna", "low", "read-only"),
    "worker": ("gpt-6-luna", "medium", "workspace-write"),
    "reviewer": ("gpt-6.2-sol", "low", "read-only"),
}


def _parse(path: Path) -> dict[str, object]:
    return tomllib.loads(path.read_text(encoding="utf-8"))


def test_native_role_configuration_matches_canonical_template() -> None:
    root = REPOSITORY / ".codex"
    embedded = REPOSITORY / "src/py/rill_cli/template"
    assert embedded.is_symlink()
    assert embedded.resolve() == SOURCE.resolve()
    assert (embedded / "REVIEW.md").read_bytes() == (SOURCE / "REVIEW.md").read_bytes()
    template = SOURCE / ".codex"
    for parent in (root, template):
        assert {file.stem for file in (parent / "agents").glob("*.toml")} == ROLES
        config = _parse(parent / "config.toml")
        agents = config["agents"]
        assert isinstance(agents, dict)
        agents = cast("dict[str, object]", agents)
        assert agents["max_threads"] == 3
        assert agents["max_depth"] == 1
        assert agents["enabled"] is True
        assert (
            set(agents)
            - {
                "enabled",
                "max_threads",
                "max_depth",
                "default_subagent_model",
                "default_subagent_reasoning_effort",
            }
            == ROLES
        )
        for role, expected in MODELS.items():
            entry = agents[role]
            assert isinstance(entry, dict)
            entry = cast("dict[str, object]", entry)
            assert entry["config_file"] == f"./agents/{role}.toml"
            detail = _parse(parent / "agents" / f"{role}.toml")
            assert (
                detail["model"],
                detail["model_reasoning_effort"],
                detail["sandbox_mode"],
            ) == expected
    assert {file.relative_to(root) for file in root.rglob("*") if file.is_file()} == {
        file.relative_to(template) for file in template.rglob("*") if file.is_file()
    }
    for file in root.rglob("*"):
        if file.is_file():
            assert file.read_bytes() == (template / file.relative_to(root)).read_bytes()


def test_review_instructions_and_limits_survive_distribution() -> None:
    root = REPOSITORY
    assert len((root / "REVIEW.md").read_text(encoding="utf-8").splitlines()) <= 30
    assert len((root / "AGENTS.md").read_text(encoding="utf-8").splitlines()) < 65
    for path in (
        root / "REVIEW.md",
        root / "AGENTS.md",
        SOURCE / "REVIEW.md",
        SOURCE / "AGENTS.md.jinja",
    ):
        content = path.read_text(encoding="utf-8")
        assert "ci-full" in content
        assert "test" in content.lower()
        assert any(marker in content for marker in ("two", "TWO", "second", "2"))
    explorer = (root / ".codex/agents/explorer.toml").read_text(encoding="utf-8")
    reviewer = (root / ".codex/agents/reviewer.toml").read_text(encoding="utf-8")
    worker = (root / ".codex/agents/worker.toml").read_text(encoding="utf-8")
    assert "150 characters" in explorer and "rg -n" in explorer
    assert "REVIEW.md" in reviewer and "LGTM" in reviewer
    assert "path:line" in reviewer and "false positives" in reviewer
    assert "tests" in worker and "Never delete, skip, narrow" in worker


def test_copier_embeds_three_roles_and_project_review(tmp_path: Path) -> None:
    project = install(tmp_path / "new-product")
    assert (project / "REVIEW.md").read_bytes() == (SOURCE / "REVIEW.md").read_bytes()
    assert {file.stem for file in (project / ".codex/agents").glob("*.toml")} == ROLES
    project_agents = _parse(project / ".codex/config.toml")["agents"]
    assert isinstance(project_agents, dict)
    assert cast("dict[str, object]", project_agents)["max_threads"] == 3
    assert (project / "AGENTS.md").is_file()
    assert "TWO reviewer/fix rounds" in (project / "AGENTS.md").read_text(encoding="utf-8")
