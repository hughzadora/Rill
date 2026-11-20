"""Typed greeting behavior used to validate the Python CI gates."""


def hello(name: str) -> str:
    """Use a stable default for an empty name and preserve supplied names."""
    if name == "":
        return "Hello, stranger!"
    return f"Hello, {name}!"
