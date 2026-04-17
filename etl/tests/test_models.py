"""Round-trip tests for the MetaRefresh model."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from etl.models import MetaRefresh


def test_should_round_trip_dict_to_meta_refresh_to_dict() -> None:
    # Arrange
    original = {
        "id": 1,
        "started_at": datetime(2026, 4, 17, 14, 0, tzinfo=UTC),
        "completed_at": datetime(2026, 4, 17, 14, 3, tzinfo=UTC),
        "status": "ok",
        "season": 2025,
        "week": 14,
        "source_version": "etl@0.1.0",
        "row_counts": {"plays": 2710},
        "error_text": None,
    }

    # Act
    model = MetaRefresh.model_validate(original)
    dumped = model.model_dump()

    # Assert
    assert dumped == original


def test_should_accept_minimal_heartbeat_row() -> None:
    row = MetaRefresh(
        started_at=datetime(2026, 4, 17, tzinfo=UTC),
        status="heartbeat",
    )
    assert row.status == "heartbeat"
    assert row.id is None
    assert row.season is None


def test_should_reject_unknown_status() -> None:
    with pytest.raises(ValidationError):
        MetaRefresh(
            started_at=datetime(2026, 4, 17, tzinfo=UTC),
            status="bogus",  # type: ignore[arg-type]
        )


def test_should_reject_extra_fields() -> None:
    with pytest.raises(ValidationError):
        MetaRefresh.model_validate(
            {
                "started_at": datetime(2026, 4, 17, tzinfo=UTC),
                "status": "ok",
                "unexpected_field": 42,
            }
        )
