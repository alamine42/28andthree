"""Unit tests for etl/freshness.py. Uses a stub DB connection so the gate
logic can be exercised without a live Postgres."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

import pytest

from etl.freshness import FreshnessResult, check_freshness


class _StubCursor:
    def __init__(self, return_value: tuple | None) -> None:
        self._return_value = return_value

    def __enter__(self) -> "_StubCursor":
        return self

    def __exit__(self, *args: Any) -> None:
        return None

    def execute(self, query: str, params: tuple) -> None:  # noqa: D401 - test stub
        self._executed_query = query
        self._executed_params = params

    def fetchone(self) -> tuple | None:
        return self._return_value


class _StubConn:
    def __init__(self, cursor_return: tuple | None) -> None:
        self._return = cursor_return

    def cursor(self) -> _StubCursor:
        return _StubCursor(self._return)


def _mid_september() -> datetime:
    # Regular-season Tuesday.
    return datetime(2026, 9, 15, 14, 0, tzinfo=UTC)


# ---- Off-season short-circuit ----------------------------------------------


def test_gate_returns_offseason_when_date_is_mid_June() -> None:
    now = datetime(2026, 6, 15, 14, 0, tzinfo=UTC)
    result = check_freshness(
        now=now,
        current_season=2026,
        nflverse_latest_completed=(2025, 22),  # super bowl LX
        db_connection=_StubConn((22,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is False
    assert result.reason == "offseason"


def test_gate_runs_on_first_tuesday_of_new_season() -> None:
    result = check_freshness(
        now=_mid_september(),
        current_season=2026,
        nflverse_latest_completed=(2026, 1),
        db_connection=_StubConn((None,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is True
    assert result.reason == "fresh"


# ---- "Already loaded" short-circuit ----------------------------------------


def test_gate_does_not_run_when_db_already_has_latest_nflverse_week() -> None:
    result = check_freshness(
        now=_mid_september(),
        current_season=2026,
        nflverse_latest_completed=(2026, 3),
        db_connection=_StubConn((3,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is False
    assert result.reason == "already_loaded"


def test_gate_runs_when_nflverse_is_ahead_of_db() -> None:
    result = check_freshness(
        now=_mid_september(),
        current_season=2026,
        nflverse_latest_completed=(2026, 4),
        db_connection=_StubConn((3,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is True


# ---- Edge cases ------------------------------------------------------------


def test_gate_does_not_run_when_nflverse_is_unavailable() -> None:
    result = check_freshness(
        now=_mid_september(),
        current_season=2026,
        nflverse_latest_completed=None,
        db_connection=_StubConn((1,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is False
    assert result.reason == "nflverse_schedule_unavailable"


def test_gate_does_not_run_when_nflverse_season_is_previous() -> None:
    # It's September 2026 but nflverse still only has 2025 SB data. Waiting.
    result = check_freshness(
        now=_mid_september(),
        current_season=2026,
        nflverse_latest_completed=(2025, 22),
        db_connection=_StubConn((None,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is False
    assert "different_season" in result.reason


def test_gate_runs_when_db_is_empty_and_nflverse_has_data() -> None:
    result = check_freshness(
        now=_mid_september(),
        current_season=2026,
        nflverse_latest_completed=(2026, 1),
        db_connection=_StubConn((None,)),
        next_season_week1_date=date(2026, 9, 10),
    )
    assert result.should_run is True


def test_FreshnessResult_is_frozen_dataclass() -> None:
    result = FreshnessResult(should_run=False, reason="offseason")
    with pytest.raises(Exception):
        result.should_run = True  # type: ignore[misc]
