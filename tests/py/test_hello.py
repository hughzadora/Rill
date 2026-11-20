"""Assert both branches of the Python greeting fixture."""

from rill_quality.hello import hello


def test_hello_with_name() -> None:
    """A supplied name must appear unchanged in the greeting."""
    assert hello("Rill") == "Hello, Rill!"


def test_hello_with_empty_name() -> None:
    """The empty name must produce the documented fallback."""
    assert hello("") == "Hello, stranger!"
