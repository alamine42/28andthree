"""E5-07: Play-calling + coaching-tendency weekly rollups.

Reads plays + games + coaches for a season. For each (team, week, coach_role)
emits one row of play-call mix + situational rates + tempo + personnel +
(defense only) blitz rate.

This module has two public functions:
  - `aggregate_tendencies(plays, coaches)` — pure; returns a list of rows.
  - `aggregate_fourth_down_decisions(plays, nfl4th_results)` — pure; builds
    the JSONB payload for the weekly row.

The DB write goes through `etl.load.coaching.upsert_coaching_tendencies`.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

import polars as pl


@dataclass(frozen=True, slots=True)
class WeeklyCoach:
    """Identity of a coach for a given (team, season, week, role) cell."""
    team: str
    season: int
    week: int
    role: str  # HC | OC | DC
    coach_id: str | None
    coach_name: str


@dataclass(slots=True)
class CoachingRollup:
    team: str
    season: int
    week: int
    coach_role: str
    coach_id: str | None
    coach_name: str
    # Pass rates, down × bucket (6 cells)
    pass_rate_1_short: float | None = None
    pass_rate_1_mid: float | None = None
    pass_rate_1_long: float | None = None
    pass_rate_2_short: float | None = None
    pass_rate_2_mid: float | None = None
    pass_rate_2_long: float | None = None
    pass_rate_3_short: float | None = None
    pass_rate_3_mid: float | None = None
    pass_rate_3_long: float | None = None
    # Situational
    shotgun_rate: float | None = None
    play_action_rate: float | None = None
    motion_rate: float | None = None
    no_huddle_rate: float | None = None
    # Score-state
    score_leading_big_pass_rate: float | None = None
    score_leading_small_pass_rate: float | None = None
    score_tied_pass_rate: float | None = None
    score_trailing_small_pass_rate: float | None = None
    score_trailing_big_pass_rate: float | None = None
    # Tempo + personnel
    seconds_per_snap: float | None = None
    personnel_top_groups: list[dict] = field(default_factory=list)
    # Defense-only
    blitz_rate: float | None = None
    # 4th-down payload
    fourth_down_decisions: list[dict] = field(default_factory=list)


# ---- Bucket helpers --------------------------------------------------------

def distance_bucket(ydstogo: int | None) -> str | None:
    if ydstogo is None:
        return None
    if ydstogo <= 3:
        return "short"
    if ydstogo <= 7:
        return "mid"
    return "long"


def score_state(score_diff: int | None) -> str | None:
    """Leading big (9+), leading small (1-8), tied (0),
    trailing small (-1 to -8), trailing big (-9+)."""
    if score_diff is None:
        return None
    if score_diff >= 9:
        return "leading_big"
    if score_diff >= 1:
        return "leading_small"
    if score_diff == 0:
        return "tied"
    if score_diff >= -8:
        return "trailing_small"
    return "trailing_big"


# ---- Aggregation -----------------------------------------------------------

def aggregate_tendencies(
    plays_df: pl.DataFrame,
    coaches: Sequence[WeeklyCoach],
) -> list[CoachingRollup]:
    """Aggregate plays into per-(team, week, coach_role) rollups.

    `plays_df` is expected to contain the E5-dep + E5-nfl4th-dep columns
    (down, ydstogo, play_type, shotgun, no_huddle, pre_snap_motion,
    play_action, personnel_offense, score_differential).
    """
    rollups: dict[tuple[str, int, int, str], CoachingRollup] = {}

    # Offense side (HC + OC share the same play-call splits).
    offense = plays_df.filter(
        pl.col("play_type").is_in(["pass", "run"])
    )
    for team, season, week in _unique_weeks(offense):
        team_plays = offense.filter(
            (pl.col("posteam") == team)
            & (pl.col("season") == season)
            & (pl.col("week") == week)
        )
        if team_plays.is_empty():
            continue
        base = _offense_rollup(team_plays)
        for coach in coaches:
            if coach.team != team or coach.season != season or coach.week != week:
                continue
            if coach.role not in ("HC", "OC"):
                continue
            key = (team, season, week, coach.role)
            rollups[key] = _merge_coach_identity(base, coach)

    # Defense side (DC — blitz rate).
    defense = plays_df.filter(pl.col("play_type").is_in(["pass", "run"]))
    for team, season, week in _unique_weeks(defense):
        team_plays = defense.filter(
            (pl.col("defteam") == team)
            & (pl.col("season") == season)
            & (pl.col("week") == week)
        )
        if team_plays.is_empty():
            continue
        base = _defense_rollup(team_plays)
        for coach in coaches:
            if coach.team != team or coach.season != season or coach.week != week:
                continue
            if coach.role != "DC":
                continue
            key = (team, season, week, coach.role)
            rollups[key] = _merge_coach_identity(base, coach)

    return list(rollups.values())


def _unique_weeks(df: pl.DataFrame) -> list[tuple[str, int, int]]:
    if df.is_empty():
        return []
    weeks_off = (
        df.filter(pl.col("posteam").is_not_null())
        .select(["posteam", "season", "week"])
        .unique()
        .rename({"posteam": "team"})
    )
    weeks_def = (
        df.filter(pl.col("defteam").is_not_null())
        .select(["defteam", "season", "week"])
        .unique()
        .rename({"defteam": "team"})
    )
    combined = pl.concat([weeks_off, weeks_def]).unique()
    return [(r["team"], r["season"], r["week"]) for r in combined.iter_rows(named=True)]


def _offense_rollup(plays: pl.DataFrame) -> CoachingRollup:
    total = plays.height
    total_passes = plays.filter(pl.col("play_type") == "pass").height

    def pass_rate_for(down: int, bucket: str) -> float | None:
        mask = (pl.col("down") == down) & (
            pl.col("ydstogo").is_between(*_bucket_bounds(bucket), closed="both")
        )
        subset = plays.filter(mask)
        n = subset.height
        if n == 0:
            return None
        passes = subset.filter(pl.col("play_type") == "pass").height
        return passes / n

    def rate(col: str) -> float | None:
        if total == 0:
            return None
        return plays.filter(pl.col(col).is_true()).height / total

    def score_pass_rate(state: str) -> float | None:
        lo, hi = _score_bounds(state)
        subset = plays.filter(pl.col("score_differential").is_between(lo, hi, closed="both"))
        n = subset.height
        if n == 0:
            return None
        return subset.filter(pl.col("play_type") == "pass").height / n

    personnel = _top_personnel(plays, "personnel_offense")

    return CoachingRollup(
        team="",  # filled by _merge_coach_identity
        season=0,
        week=0,
        coach_role="",
        coach_id=None,
        coach_name="",
        pass_rate_1_short=pass_rate_for(1, "short"),
        pass_rate_1_mid=pass_rate_for(1, "mid"),
        pass_rate_1_long=pass_rate_for(1, "long"),
        pass_rate_2_short=pass_rate_for(2, "short"),
        pass_rate_2_mid=pass_rate_for(2, "mid"),
        pass_rate_2_long=pass_rate_for(2, "long"),
        pass_rate_3_short=pass_rate_for(3, "short"),
        pass_rate_3_mid=pass_rate_for(3, "mid"),
        pass_rate_3_long=pass_rate_for(3, "long"),
        shotgun_rate=rate("shotgun"),
        play_action_rate=rate("play_action"),
        motion_rate=rate("pre_snap_motion"),
        no_huddle_rate=rate("no_huddle"),
        score_leading_big_pass_rate=score_pass_rate("leading_big"),
        score_leading_small_pass_rate=score_pass_rate("leading_small"),
        score_tied_pass_rate=score_pass_rate("tied"),
        score_trailing_small_pass_rate=score_pass_rate("trailing_small"),
        score_trailing_big_pass_rate=score_pass_rate("trailing_big"),
        seconds_per_snap=_seconds_per_snap(plays),
        personnel_top_groups=personnel,
    )


def _defense_rollup(plays: pl.DataFrame) -> CoachingRollup:
    # Blitz rate is our only DC-specific metric; everything else mirrors
    # offense structure so the same table can hold HC/OC/DC rows.
    # We approximate blitz rate as plays with 6+ pass rushers; nflverse
    # exposes `number_of_pass_rushers` on PBP.
    blitz_rate: float | None = None
    pass_plays = plays.filter(pl.col("play_type") == "pass")
    if pass_plays.height > 0 and "number_of_pass_rushers" in plays.columns:
        blitz = pass_plays.filter(pl.col("number_of_pass_rushers") >= 6).height
        blitz_rate = blitz / pass_plays.height

    return CoachingRollup(
        team="",
        season=0,
        week=0,
        coach_role="",
        coach_id=None,
        coach_name="",
        blitz_rate=blitz_rate,
    )


def _merge_coach_identity(base: CoachingRollup, coach: WeeklyCoach) -> CoachingRollup:
    base.team = coach.team
    base.season = coach.season
    base.week = coach.week
    base.coach_role = coach.role
    base.coach_id = coach.coach_id
    base.coach_name = coach.coach_name
    return base


def _top_personnel(plays: pl.DataFrame, col: str) -> list[dict]:
    if col not in plays.columns:
        return []
    filtered = plays.filter(pl.col(col).is_not_null())
    if filtered.is_empty():
        return []
    total = filtered.height
    counts = (
        filtered.group_by(col)
        .agg(pl.len().alias("n"))
        .sort("n", descending=True)
        .head(5)
    )
    return [
        {"grouping": row[col], "share": row["n"] / total}
        for row in counts.iter_rows(named=True)
    ]


def _seconds_per_snap(plays: pl.DataFrame) -> float | None:
    # nflverse exposes `play_clock` (seconds remaining when snap happened);
    # we approximate tempo by the delta between game_seconds_remaining on
    # consecutive offensive plays. Falls back to None when the column is
    # absent.
    if "game_seconds_remaining" not in plays.columns:
        return None
    series = plays.sort(["game_seconds_remaining"], descending=True)["game_seconds_remaining"].drop_nulls()
    if series.len() < 2:
        return None
    diffs = series.diff().abs().drop_nulls()
    if diffs.len() == 0:
        return None
    return float(diffs.median())


def _bucket_bounds(bucket: str) -> tuple[int, int]:
    if bucket == "short":
        return (1, 3)
    if bucket == "mid":
        return (4, 7)
    return (8, 99)


def _score_bounds(state: str) -> tuple[int, int]:
    if state == "leading_big":
        return (9, 200)
    if state == "leading_small":
        return (1, 8)
    if state == "tied":
        return (0, 0)
    if state == "trailing_small":
        return (-8, -1)
    return (-200, -9)
