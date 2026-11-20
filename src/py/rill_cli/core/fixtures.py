"""Explicitly non-persistent sample assets for the first-run empty dashboard."""

from .constants import FLEET_DEMO_VERSIONS
from .models import AssetKind, FleetSnapshot, InstalledAsset


def demo_fleet() -> FleetSnapshot:
    """Sample entries are UI-only; no demo asset is written to the real registry."""
    examples: tuple[tuple[str, str, AssetKind], ...] = (
        ("sample-explorer", "Code explorer", "agent"),
        ("sample-reviewer", "Independent code reviewer", "agent"),
        ("sample-design", "Product design workflow", "skill"),
    )
    return FleetSnapshot(
        demo=True,
        assets=[
            InstalledAsset(id=key, name=name, kind=kind, version=tag, source="demo")
            for (key, name, kind), tag in zip(examples, FLEET_DEMO_VERSIONS, strict=True)
        ],
    )
