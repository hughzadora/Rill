"""Explicitly non-persistent sample assets for the first-run empty dashboard."""

from .models import AssetKind, FleetSnapshot, InstalledAsset


def demo_fleet() -> FleetSnapshot:
    """Sample entries are UI-only; no demo asset is written to the real registry."""
    examples: tuple[tuple[str, str, AssetKind, str], ...] = (
        ("sample-explorer", "Code explorer", "agent", "1.0.0"),
        ("sample-reviewer", "Independent code reviewer", "agent", "1.1.0"),
        ("sample-design", "Product design workflow", "skill", "2.0.0"),
    )
    return FleetSnapshot(
        demo=True,
        assets=[
            InstalledAsset(id=key, name=name, kind=kind, version=tag, source="demo")
            for key, name, kind, tag in examples
        ],
    )
