import pytest
from hypothesis import given
from hypothesis import strategies as st

from rill_sqlite_tasks.requests import InvalidRequest, validate_title


@pytest.mark.parametrize("title", ["", "  ", "two\0words", "x" * 161])
def test_rejects_invalid_task_titles(title: str) -> None:
    with pytest.raises(InvalidRequest, match="Title must be 1–160 characters"):
        validate_title(title)


@pytest.mark.parametrize("title", ["x", "界" * 160, "  reset the pump  "])
def test_valid_titles_keep_their_exact_text(title: str) -> None:
    assert validate_title(title) == title


@given(infix=st.text(alphabet=st.characters(blacklist_characters="\0"), max_size=158))
def test_titles_preserve_all_supported_characters(infix: str) -> None:
    title = f"日{infix}本"
    assert validate_title(title) == title
