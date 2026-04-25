"""Freshness gate. Decides whether the ETL should run on a given invocation.

The gate is the first step of every cron run. It compares nflverse vs DB
state and the calendar (via etl/schedule.py) to short-circuit no-op runs.

Schedule logic moved out: this module is now a thin policy layer over a
precomputed ScheduleSnapshot. Callers (etl/main.py) are responsible for
fetching the snap.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from etl.schedule import ScheduleSnapshot

logger = logging.getLogger("etl.freshness")

# Grace window: if the latest completed nflverse game was within this window
# of "now", assume the nflverse release is still processing and call it not-fresh.
_RELEASE_GRACE = timedelta(hours=10)

# Belt + suspenders deadlock breaker (codex E9 review CRITICAL #1).
# Even when the gate would otherwise skip indefinitely (e.g., offseason
# with no next-season schedule yet), force a re-attempt every N days so a
# newly-published nflverse schedule gets ingested.
_MAX_OFFSEASON_SKIP_DAYS = 14


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
    snap: ScheduleSnapshot,
    nflverse_latest_completed: tuple[int, int] | None,
    db_max_completed_week: int | None,
    last_ok_run_at: datetime | None,
    now: datetime,
) -> FreshnessResult:
    """Return whether the ETL should run now.

    Decision order:
      1. Offseason short-circuit (4 guards, all must hold to skip):
         - phase == 'offseason'
         - next_game_date IS NOT NULL  (else: re-run to refresh schedule)
         - days_until_next_game > 7
         - last_ok_run_at < 14 days ago (else: force a periodic refresh)
      2. nflverse unavailable → skip with explicit reason.
      3. nflverse on a different season than the snap thinks → skip
         (nflverse lags on season rollover).
      4. nflverse latest week ≤ DB latest week → already_loaded.
      5. Otherwise → run.
    """
    if _should_skip_offseason(snap, last_ok_run_at, now):
        return FreshnessResult(
            should_run=False,
            reason="offseason",
            current_season=snap.season,
        )

    current_season = snap.season

    if nflverse_latest_completed is None:
        return FreshnessResult(
            should_run=False,
            reason="nflverse_schedule_unavailable",
            current_season=current_season,
            db_max_week=db_max_completed_week,
        )

    nfl_season, nfl_week = nflverse_latest_completed

    if nfl_season != current_season:
        return FreshnessResult(
            should_run=False,
            reason=f"nflverse_on_different_season_{nfl_season}",
            current_season=current_season,
            nflverse_max_week=nfl_week,
            db_max_week=db_max_completed_week,
        )

    if db_max_completed_week is not None and nfl_week <= db_max_completed_week:
        return FreshnessResult(
            should_run=False,
            reason="already_loaded",
            current_season=current_season,
            nflverse_max_week=nfl_week,
            db_max_week=db_max_completed_week,
        )

    return FreshnessResult(
        should_run=True,
        reason="fresh",
        current_season=current_season,
        nflverse_max_week=nfl_week,
        db_max_week=db_max_completed_week,
    )


def _should_skip_offseason(
    snap: ScheduleSnapshot,
    last_ok_run_at: datetime | None,
    now: datetime,
) -> bool:
    """Apply all four offseason-skip guards. Any failure → don't skip."""
    if snap.phase != "offseason":
        return False
    if snap.next_game_date is None:
        # No upcoming game in DB → next-season schedule may not have been
        # published yet. Run to attempt a fresh nflverse fetch.
        return False
    if snap.days_until_next_game is None or snap.days_until_next_game <= 7:
        # In-window for a refresh in case nflverse drops a release early.
        return False
    if last_ok_run_at is None:
        # Cold start (or nuked meta_refresh) → run.
        return False
    if (now - last_ok_run_at).days >= _MAX_OFFSEASON_SKIP_DAYS:
        # Periodic-refresh ceiling. Codex CRITICAL #1 deadlock-breaker.
        return False
    return True


def now_utc() -> datetime:
    """Single indirection so tests can monkey-patch time."""
    return datetime.now(UTC)


__all__ = [
    "FreshnessResult",
    "check_freshness",
    "now_utc",
    "_RELEASE_GRACE",
    "_MAX_OFFSEASON_SKIP_DAYS",
]
