"""Freshness gate + off-season short-circuit. See plan §3.8."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import psycopg

logger = logging.getLogger("etl.freshness")

# Grace window: if the latest completed nflverse game was within this window
# of "now", assume the nflverse release is still processing and call it not-fresh.
_RELEASE_GRACE = timedelta(hours=10)


@dataclass(frozen=True)
class FreshnessResult:
    """Decision about whether the ETL should run now."""

    should_run: bool
    reason: str
    current_season: int | None = None
    nflverse_max_week: int | None = None
    db_max_week: int | None = None


def check_freshness(
    *,
    now: datetime,
    current_season: int,
    nflverse_latest_completed: tuple[int, int] | None,
    db_connection: psycopg.Connection,
    next_season_week1_date: date | None,
) -> FreshnessResult:
    """Return whether the ETL should run now.

    Arguments:
      now: current UTC datetime, injected for testability.
      current_season: the NFL season year (e.g., 2026 for Sept 2026 – Feb 2027).
      nflverse_latest_completed: (season, week) of most recent completed game in
        nflverse. None if the schedule couldn't be fetched.
      db_connection: active Postgres conn to query our games table.
      next_season_week1_date: scheduled kick-off date of the next season's
        Week 1. If today is between post-Super-Bowl and this date, it's the
        off-season and nothing can be fresh.

    The decision rules:
      1. If we're in the off-season, exit heartbeat (not a retry signal).
      2. If nflverse's latest completed week equals our DB's latest → nothing
         new; exit heartbeat.
      3. If nflverse is ahead but the game is too recent (< grace window),
         back off; exit heartbeat.
      4. Otherwise: run the ETL.
    """
    if _is_offseason(now.date(), next_season_week1_date):
        return FreshnessResult(
            should_run=False,
            reason="offseason",
        )

    db_max_week = _db_max_completed_week(db_connection, current_season)

    if nflverse_latest_completed is None:
        return FreshnessResult(
            should_run=False,
            reason="nflverse_schedule_unavailable",
            current_season=current_season,
            db_max_week=db_max_week,
        )

    nfl_season, nfl_week = nflverse_latest_completed

    if nfl_season != current_season:
        # Pre-season, or nflverse lagging on season rollover.
        return FreshnessResult(
            should_run=False,
            reason=f"nflverse_on_different_season_{nfl_season}",
            current_season=current_season,
            nflverse_max_week=nfl_week,
            db_max_week=db_max_week,
        )

    if db_max_week is not None and nfl_week <= db_max_week:
        return FreshnessResult(
            should_run=False,
            reason="already_loaded",
            current_season=current_season,
            nflverse_max_week=nfl_week,
            db_max_week=db_max_week,
        )

    return FreshnessResult(
        should_run=True,
        reason="fresh",
        current_season=current_season,
        nflverse_max_week=nfl_week,
        db_max_week=db_max_week,
    )


def _is_offseason(today: date, next_week1: date | None) -> bool:
    """Return True when today is safely in the offseason.

    If we don't know next Week 1 (schedule unavailable), we conservatively say
    "not offseason" — better to run the gate and write a heartbeat than to
    silently skip and never notice new data.
    """
    if next_week1 is None:
        return False
    # Super Bowl typically completes by mid-February; next Week 1 is early Sept.
    # The gap is the offseason. One week of buffer either side keeps us from
    # flagging SB Monday or Week 1 Tuesday as offseason.
    buffer = timedelta(days=7)
    # "Offseason" = from mid-Feb until a week before Week 1.
    feb_start = date(today.year, 2, 15)
    offseason_end = next_week1 - buffer
    return feb_start <= today < offseason_end


def _db_max_completed_week(conn: psycopg.Connection, season: int) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(week) FROM games WHERE season = %s AND completed = true",
            (season,),
        )
        row = cur.fetchone()
    if row is None or row[0] is None:
        return None
    return int(row[0])


def now_utc() -> datetime:
    """Single indirection so tests can monkey-patch time."""
    return datetime.now(UTC)


__all__ = ["FreshnessResult", "check_freshness", "now_utc", "_RELEASE_GRACE"]
