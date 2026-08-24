"""Unit tests for etl/freshness.py. Pure-function gate over a precomputed
ScheduleSnapshot — no DB stubs needed (snap is constructed directly)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from etl.freshness import FreshnessResult, _MAX_OFFSEASON_SKIP_DAYS, check_freshness
from etl.schedule import ScheduleSnapshot


# ---- Snapshot factories -----------------------------------------------------


def _regular_snap(season: int = 2026) -> ScheduleSnapshot:
    return ScheduleSnapshot(
        phase="regular",
        season=season,
        last_game_date=date(season, 9, 8),
        days_since_last_game=3,
        next_game_date=date(season, 9, 14),
        days_until_next_game=3,
        playoff_round=None,
    )


def _offseason_snap_next_far(*, season: int = 2025, days_until: int = 30) -> ScheduleSnapshot:
    today = date(2026, 8, 1)
    return ScheduleSnapshot(
        phase="offseason",
        season=season,
        last_game_date=date(2026, 2, 8),
        days_since_last_game=(today - date(2026, 2, 8)).days,
        next_game_date=today + timedelta(days=days_until),
        days_until_next_game=days_until,
        playoff_round=None,
    )


def _offseason_snap_no_schedule(season: int = 2025) -> ScheduleSnapshot:
    return ScheduleSnapshot(
        phase="offseason",
        season=season,
        last_game_date=date(2026, 2, 8),
        days_since_last_game=125,
        next_game_date=None,
        days_until_next_game=None,
        playoff_round=None,
    )


def _mid_september() -> datetime:
    return datetime(2026, 9, 15, 14, 0, tzinfo=UTC)


# ---- Off-season skip --------------------------------------------------------


def test_gate_skips_when_offseason_with_distant_next_game_and_recent_run() -> None:
    now = datetime(2026, 8, 1, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_next_far(days_until=30),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=3),
        now=now,
    )
    assert result.should_run is False
    assert result.reason == "offseason"


def test_gate_does_not_short_circuit_offseason_when_next_game_within_seven_days() -> None:
    # 7-day window before kickoff: don't claim "offseason"; let the gate
    # fall through to the rest of the freshness logic.
    now = datetime(2026, 8, 27, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_next_far(days_until=7),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=3),
        now=now,
    )
    assert result.reason != "offseason"


def test_gate_does_not_short_circuit_offseason_when_next_game_unknown() -> None:
    # Codex CRITICAL #1: missing next_game_date must NOT trigger the
    # offseason skip — else the gate would never re-fetch a newly-released
    # schedule. The gate falls through and may still skip for another
    # reason (already_loaded), but not "offseason".
    now = datetime(2026, 6, 15, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_no_schedule(),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=3),
        now=now,
    )
    assert result.reason != "offseason"


def test_gate_does_not_short_circuit_offseason_when_skip_exceeds_max_window() -> None:
    # Codex CRITICAL #1 belt-and-suspenders: 14-day periodic refresh
    # ceiling. Even when every other guard would let us skip, the gate
    # must fall through after the ceiling.
    now = datetime(2026, 8, 1, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_next_far(days_until=30),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=_MAX_OFFSEASON_SKIP_DAYS),
        now=now,
    )
    assert result.reason != "offseason"


def test_gate_does_not_short_circuit_offseason_when_no_prior_ok_run() -> None:
    # Cold start (meta_refresh empty) → never short-circuit on offseason.
    now = datetime(2026, 8, 1, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_next_far(days_until=30),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=None,
        now=now,
    )
    assert result.reason != "offseason"


# ---- "Already loaded" short-circuit ----------------------------------------


def test_gate_does_not_run_when_db_already_has_latest_nflverse_week() -> None:
    result = check_freshness(
        snap=_regular_snap(2026),
        nflverse_latest_completed=(2026, 3),
        db_max_completed_week=3,
        last_ok_run_at=None,
        now=_mid_september(),
    )
    assert result.should_run is False
    assert result.reason == "already_loaded"


def test_gate_runs_when_nflverse_is_ahead_of_db() -> None:
    result = check_freshness(
        snap=_regular_snap(2026),
        nflverse_latest_completed=(2026, 4),
        db_max_completed_week=3,
        last_ok_run_at=None,
        now=_mid_september(),
    )
    assert result.should_run is True


# ---- Season rollover --------------------------------------------------------


def test_gate_runs_rollover_when_target_schedule_published_and_db_lacks_it() -> None:
    # The post-Super-Bowl deadlock: nflverse and the DB agree on the old
    # season's max week, so without the rollover check every run exits
    # "already_loaded" and the new schedule never lands.
    now = datetime(2026, 8, 24, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_no_schedule(season=2025),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=3),
        now=now,
        target_season=2026,
        target_schedule_available=True,
        db_has_target_games=False,
    )
    assert result.should_run is True
    assert result.reason == "season_rollover"
    assert result.current_season == 2026


def test_gate_does_not_rollover_when_db_already_has_target_games() -> None:
    now = datetime(2026, 8, 24, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_next_far(season=2025, days_until=17),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=3),
        now=now,
        target_season=2026,
        target_schedule_available=True,
        db_has_target_games=True,
    )
    assert result.should_run is False


def test_gate_does_not_rollover_when_target_schedule_not_published() -> None:
    now = datetime(2026, 4, 1, 14, 0, tzinfo=UTC)
    result = check_freshness(
        snap=_offseason_snap_no_schedule(season=2025),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=22,
        last_ok_run_at=now - timedelta(days=3),
        now=now,
        target_season=2026,
        target_schedule_available=False,
        db_has_target_games=False,
    )
    assert result.should_run is False
    assert result.reason == "already_loaded"


def test_gate_ignores_target_season_when_not_ahead_of_snap() -> None:
    result = check_freshness(
        snap=_regular_snap(2026),
        nflverse_latest_completed=(2026, 3),
        db_max_completed_week=3,
        last_ok_run_at=None,
        now=_mid_september(),
        target_season=2026,
        target_schedule_available=True,
        db_has_target_games=True,
    )
    assert result.should_run is False
    assert result.reason == "already_loaded"


# ---- Edge cases ------------------------------------------------------------


def test_gate_does_not_run_when_nflverse_is_unavailable() -> None:
    result = check_freshness(
        snap=_regular_snap(2026),
        nflverse_latest_completed=None,
        db_max_completed_week=1,
        last_ok_run_at=None,
        now=_mid_september(),
    )
    assert result.should_run is False
    assert result.reason == "nflverse_schedule_unavailable"


def test_gate_does_not_run_when_nflverse_season_is_previous() -> None:
    result = check_freshness(
        snap=_regular_snap(2026),
        nflverse_latest_completed=(2025, 22),
        db_max_completed_week=None,
        last_ok_run_at=None,
        now=_mid_september(),
    )
    assert result.should_run is False
    assert "different_season" in result.reason


def test_gate_runs_when_db_is_empty_and_nflverse_has_data() -> None:
    result = check_freshness(
        snap=_regular_snap(2026),
        nflverse_latest_completed=(2026, 1),
        db_max_completed_week=None,
        last_ok_run_at=None,
        now=_mid_september(),
    )
    assert result.should_run is True


def test_FreshnessResult_is_frozen_dataclass() -> None:
    result = FreshnessResult(should_run=False, reason="offseason")
    with pytest.raises(Exception):
        result.should_run = True  # type: ignore[misc]
