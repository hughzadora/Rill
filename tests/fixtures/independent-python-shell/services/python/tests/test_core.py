import pytest

from independent_service import normalize, validate_port


def test_normalize() -> None:
    assert normalize("  Rill  ") == "rill"


def test_reject_empty() -> None:
    with pytest.raises(ValueError):
        normalize("  ")


def test_validate_ports() -> None:
    assert validate_port(8765) == 8765


def test_reject_zero() -> None:
    with pytest.raises(ValueError):
        validate_port(0)
