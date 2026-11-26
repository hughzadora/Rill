class InvalidRequest(ValueError):
    pass


INVALID_TITLE_MESSAGE = (
    "Title must be 1–160 characters and contain nonblank text without NUL"
)


def validate_title(title: str) -> str:
    if not title.strip() or len(title) > 160 or "\0" in title:
        raise InvalidRequest(INVALID_TITLE_MESSAGE)
    return title
