"""Exercise every executable statement in the greeting module."""

from hello import hello


def test_hello_with_name() -> None:
    """A supplied name must appear unchanged in the greeting."""
    assert hello("Rill") == "Hello, Rill!"


def test_hello_with_empty_name() -> None:
    """Empty input is handled deterministically."""
    assert hello("") == "Hello, !"
