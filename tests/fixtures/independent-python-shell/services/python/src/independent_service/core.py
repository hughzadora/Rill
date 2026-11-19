def normalize(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Empty input")
    return cleaned.casefold()


def validate_port(value: int) -> int:
    if not 1 <= value <= 65535:
        raise ValueError("Invalid port")
    return value
