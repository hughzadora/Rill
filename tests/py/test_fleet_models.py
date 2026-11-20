"""The published fleet schema rejects unsafe assets and never persists fixtures."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from rill_cli.core.fixtures import demo_fleet
from rill_cli.core.models import AgentAssetManifest, AssetFile, FleetSnapshot, RegisteredProject


@pytest.mark.parametrize(
    "destination", ["../config.toml", "/root/outside", "skills//x", ".secret", "other/file"]
)
def test_manifest_rejects_unsafe_target(destination: str) -> None:
    with pytest.raises(ValidationError):
        AssetFile(source="files/code.md", target=destination, sha256="a" * 64)


def test_manifest_refuses_duplicate_outputs() -> None:
    entry = AssetFile(source="code.md", target="skills/demo/SKILL.md", sha256="b" * 64)
    with pytest.raises(ValidationError, match="Duplicate"):
        AgentAssetManifest(id="demo", name="demo", kind="skill", version="1", files=[entry, entry])


def test_snapshot_roundtrip_is_strict_and_versioned(tmp_path: Path) -> None:
    snapshot = FleetSnapshot(projects=[RegisteredProject(name="service", path=tmp_path.resolve())])
    assert FleetSnapshot.model_validate_json(snapshot.model_dump_json()) == snapshot
    with pytest.raises(ValidationError):
        FleetSnapshot.model_validate({"schema_version": 999})


def test_demo_is_visibly_marked_and_has_no_real_files() -> None:
    demo = demo_fleet()
    assert demo.demo and len(demo.assets) == 3
    assert all(not asset.file_hashes and asset.source == "demo" for asset in demo.assets)
