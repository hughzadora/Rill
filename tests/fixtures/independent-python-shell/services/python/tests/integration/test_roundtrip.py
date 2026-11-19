from independent_service import normalize, validate_port


def test_assembled_boundary() -> None:
    result = normalize(" Public API ")
    assert result == "public api"
    assert validate_port(443) == 443
