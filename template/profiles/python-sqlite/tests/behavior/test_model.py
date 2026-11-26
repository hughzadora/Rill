from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from rill_sqlite_tasks.requests import InvalidRequest
from rill_sqlite_tasks.store import Conflict, Task, TaskStore


@settings(max_examples=40)
@given(
    operations=st.lists(
        st.tuples(
            st.sampled_from(["add", "complete", "snapshot"]),
            st.sampled_from(["first", "second", "third"]),
            st.sampled_from(["inspect", "réparer", "清理"]),
        ),
        min_size=1,
        max_size=20,
    )
)
def test_reopened_database_matches_independent_task_model(
    operations: list[tuple[str, str, str]],
) -> None:
    with TemporaryDirectory(prefix="rill-model-") as directory:
        root = Path(directory)
        active = root / "active.sqlite"
        TaskStore(active).initialize()
        initial = Task("sentinel", "Do not change", False)
        assert TaskStore(active).add(initial.id, initial.title) == initial
        expected = {initial.id: initial}
        for index, (action, key, title) in enumerate(operations):
            store = TaskStore(active)
            record = expected.get(key)
            if action == "snapshot":
                snapshot = root / f"snapshot-{index}.sqlite"
                assert store.copy_to(snapshot) == 2
                assert TaskStore(snapshot).tasks() == [
                    expected[name] for name in sorted(expected)
                ]
            elif action == "add":
                if record is not None and record.title != title:
                    with pytest.raises(Conflict):
                        store.add(key, title)
                else:
                    expected.setdefault(key, Task(key, title, False))
                    assert store.add(key, title) == expected[key]
            elif record is None:
                with pytest.raises(InvalidRequest):
                    store.complete(key)
            else:
                expected[key] = Task(key, record.title, True)
                assert store.complete(key) == expected[key]
            assert TaskStore(active).tasks() == [
                expected[name] for name in sorted(expected)
            ]
