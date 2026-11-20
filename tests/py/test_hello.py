"""Unit tests for the Python quality fixture."""

from hello import hello


def test_hello() -> None:
    """Verify the greeting is derived from the name."""
    assert hello("Rill") == "Hello, Rill!"
