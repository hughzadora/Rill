"""Single-file fleet dashboard uses only local, safely escaped evidence."""

import hashlib
import json
import re
from pathlib import Path
from typing import cast

from rill_cli.core.constants import FLEET_ASSET_MANIFEST, FLEET_REGISTRY_FILE
from rill_cli.core.dashboard import fleet_facts, render_fleet
from rill_cli.core.fleet import FleetEngine
from rill_cli.core.models import AgentAssetManifest, AssetFile


def test_first_run_loads_read_only_demo_without_registering(tmp_path: Path) -> None:
    engine = FleetEngine(data_root=tmp_path / "data", codex_root=tmp_path / "codex")
    page = render_fleet(engine)
    html = page.read_text(encoding="utf-8")
    assert 'data-theme="dark"' in html
    assert 'id="theme"' in html and 'id="projects"' in html
    assert 'id="audit"' in html and 'id="assets"' in html
    assert 'id="rill-fleet-data"' in html
    assert "No secrets shown" in html and "Action directions" in html
    assert not (engine.data_root / FLEET_REGISTRY_FILE).exists()
    data = fleet_facts(engine)
    snapshot = data["snapshot"]
    assert isinstance(snapshot, dict)
    entries = cast("list[object]", snapshot["assets"])
    assert isinstance(entries, list)
    assert snapshot["demo"] is True and len(entries) == 3


def test_asset_names_are_escaped_not_embedded_as_markup(tmp_path: Path) -> None:
    engine = FleetEngine(data_root=tmp_path / "data", codex_root=tmp_path / "codex")
    folder = tmp_path / "bundle"
    folder.mkdir()
    (folder / "SKILL.md").write_bytes(b"# Test\n")
    manifest = AgentAssetManifest(
        id="safe",
        name="<img src=x onerror=alert(1)>",
        kind="skill",
        version="1.0.0",
        files=[
            AssetFile(
                source="SKILL.md",
                target="skills/safe/SKILL.md",
                sha256=hashlib.sha256(b"# Test\n").hexdigest(),
            )
        ],
    )
    (folder / FLEET_ASSET_MANIFEST).write_text(manifest.model_dump_json(), encoding="utf-8")
    engine.install_bundle(folder)
    page = render_fleet(engine)
    content = page.read_text(encoding="utf-8")
    assert "<img src=x onerror" not in content
    assert "\\u003cimg" in content
    match = re.search(
        r'<script type="application/json" id="rill-fleet-data">(.*?)</script>', content
    )
    assert match is not None
    payload = json.loads(match.group(1))
    assert payload["snapshot"]["assets"][0]["name"] == manifest.name
    assert payload["snapshot"]["demo"] is False
