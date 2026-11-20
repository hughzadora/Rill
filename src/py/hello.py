"""A fully typed greeting module used to validate the Python CI gates."""


def hello(name: str) -> str:
    """Return a greeting for the provided name without hidden defaults."""
    return f"Hello, {name}!"
