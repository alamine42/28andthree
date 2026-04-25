"""bd-8rd.3: NFL schedule-phase derivation. Pure-function core + thin DB
wrapper. Same contract as lib/schedule/phase.ts — both implementations
are covered by tests/fixtures/schedule-cases.json. Day-deltas are
calendar days in America/New_York so countdown text doesn't flip ±1
around UTC midnight.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

import psycopg

# ---- Types -----------------------------------------------------------------

SchedulePhase = Literal["regular", "playoffs", "offseason"]
PlayoffRound = Literal["wild_card", "divisional", "conference", "super_bowl"]
SeasonType = Literal["REG", "POST"]


@dataclass(frozen=True, slots=True)
class Aggregate:
    """One row from the games-table aggregate query."""

    season: int
    season_type: SeasonType
    first_game: date
    last_game: date
    last_week: int


@dataclass(frozen=True, slots=True)
class PlayoffWeek:
    """Per-week range for a season's POST games."""

    week: int
    first_game: date
    last_game: date


@dataclass(frozen=True, slots=True)
class ScheduleSnapshot:
    """Result of derive_phase. Mirror of TS ScheduleSnapshot."""

    phase: SchedulePhase
    season: int
    last_game_date: date | None
    days_since_last_game: int | None
    next_game_date: date | None
    days_until_next_game: int | None
    playoff_round: PlayoffRound | None


# nflverse week-to-round mapping for postseason. Verified against `games`
# table 2024-25 + 2025-26 POST rows: week 19=6 games (wild card),
# 20=4 (divisional), 21=2 (conference), 22=1 (super bowl). Our ETL
# normalizes nflverse string weeks to integers, so the integer mapping is
# safe here. See plan v2 §5.
_PLAYOFF_WEEK_TO_ROUND: dict[int, PlayoffRound] = {
    19: "wild_card",
    20: "divisional",
    21: "conference",
    22: "super_bowl",
}

_NY_TZ = ZoneInfo("America/New_York")


# ---- Pure derivation -------------------------------------------------------


def derive_phase(
    *,
    now: datetime,
    rows: list[Aggregate],
    playoff_weeks: list[PlayoffWeek],
    next_game_date: date | None,
    last_completed_date: date | None,
) -> ScheduleSnapshot:
    """Compute the schedule snapshot from precomputed aggregates."""
    today = _ny_date(now)
    season = _pick_current_season(rows, today)
    phase = _compute_phase(rows, today, season)
    playoff_round = (
        _compute_playoff_round(playoff_weeks, today) if phase == "playoffs" else None
    )

    return ScheduleSnapshot(
        phase=phase,
        season=season,
        last_game_date=last_completed_date,
        days_since_last_game=(today - last_completed_date).days if last_completed_date else None,
        next_game_date=next_game_date,
        days_until_next_game=(next_game_date - today).days if next_game_date else None,
        playoff_round=playoff_round,
    )


def _pick_current_season(rows: list[Aggregate], today: date) -> int:
    # The latest season whose REG first_game <= today. If none (early
    # bootstrap state), fall back to the smallest season we have.
    started = [r.season for r in rows if r.season_type == "REG" and r.first_game <= today]
    if started:
        return max(started)
    if rows:
        return min(r.season for r in rows)
    return today.year


def _compute_phase(rows: list[Aggregate], today: date, season: int) -> SchedulePhase:
    reg = next((r for r in rows if r.season == season and r.season_type == "REG"), None)
    post = next((r for r in rows if r.season == season and r.season_type == "POST"), None)

    if reg and reg.first_game <= today <= reg.last_game:
        return "regular"
    if reg and post and reg.last_game < today <= post.last_game:
        return "playoffs"
    return "offseason"


def _compute_playoff_round(weeks: list[PlayoffWeek], today: date) -> PlayoffRound | None:
    if not weeks:
        return None
    sorted_weeks = sorted(weeks, key=lambda w: w.week)
    for w in sorted_weeks:
        if w.first_game <= today <= w.last_game:
            return _PLAYOFF_WEEK_TO_ROUND.get(w.week)
    # No "current" week — find next upcoming.
    upcoming = next((w for w in sorted_weeks if today < w.first_game), None)
    if upcoming:
        return _PLAYOFF_WEEK_TO_ROUND.get(upcoming.week)
    # Past the last playoff week — return last round as a safe default.
    return _PLAYOFF_WEEK_TO_ROUND.get(sorted_weeks[-1].week)


def _ny_date(now: datetime) -> date:
    """Convert an aware UTC datetime to its calendar date in America/New_York."""
    if now.tzinfo is None:
        raise ValueError("derive_phase requires a tz-aware datetime; got naive")
    return now.astimezone(_NY_TZ).date()


# ---- DB wrapper ------------------------------------------------------------


def get_schedule_phase(
    *,
    now: datetime,
    db_connection: psycopg.Connection,
) -> ScheduleSnapshot:
    """Query `games` table and derive a ScheduleSnapshot. Single round-trip
    for aggregates + a second round-trip for playoff-week ranges (only
    needed during the postseason; cheap in absolute terms).
    """
    today = _ny_date(now)
    calendar_year = today.year

    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT season, season_type,
                   MIN(game_date) AS first_game,
                   MAX(game_date) AS last_game,
                   MAX(week)::int AS last_week,
                   (SELECT MIN(game_date) FROM games
                      WHERE game_date > %s::date)                        AS next_game_date,
                   (SELECT MAX(game_date) FROM games
                      WHERE game_date <= %s::date AND completed = true)  AS last_completed_date
            FROM games
            WHERE season BETWEEN %s AND %s
            GROUP BY season, season_type
            ORDER BY season, season_type
            """,
            (today, today, calendar_year - 1, calendar_year + 1),
        )
        agg_rows = cur.fetchall()

    if not agg_rows:
        return ScheduleSnapshot(
            phase="offseason",
            season=calendar_year,
            last_game_date=None,
            days_since_last_game=None,
            next_game_date=None,
            days_until_next_game=None,
            playoff_round=None,
        )

    rows = [
        Aggregate(
            season=r[0],
            season_type=r[1],
            first_game=r[2],
            last_game=r[3],
            last_week=r[4],
        )
        for r in agg_rows
    ]
    next_game_date = agg_rows[0][5]
    last_completed_date = agg_rows[0][6]

    season_guess = _pick_current_season(rows, today)
    playoff_weeks = _fetch_playoff_weeks(db_connection, season_guess)

    return derive_phase(
        now=now,
        rows=rows,
        playoff_weeks=playoff_weeks,
        next_game_date=next_game_date,
        last_completed_date=last_completed_date,
    )


def _fetch_playoff_weeks(
    db_connection: psycopg.Connection, season: int
) -> list[PlayoffWeek]:
    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT week::int,
                   MIN(game_date),
                   MAX(game_date)
            FROM games
            WHERE season = %s AND season_type = 'POST'
            GROUP BY week
            ORDER BY week
            """,
            (season,),
        )
        return [PlayoffWeek(week=r[0], first_game=r[1], last_game=r[2]) for r in cur.fetchall()]


__all__ = [
    "Aggregate",
    "PlayoffRound",
    "PlayoffWeek",
    "ScheduleSnapshot",
    "SchedulePhase",
    "derive_phase",
    "get_schedule_phase",
]
