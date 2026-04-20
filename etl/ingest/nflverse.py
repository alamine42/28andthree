"""nflverse PBP + schedule ingest.

Separates two concerns:
  - `fetch_*` functions hit the network via nflreadpy; pure I/O, tested
    end-to-end by the integration backfill (E2-10).
  - `normalize_*` functions are pure polars → list[BaseModel] transformations;
    unit-tested in `test_ingest_nflverse.py`.

Column semantics documented in docs/phase-definitions.md and plan §3.3.
Explosive thresholds are ≥20 yards for passes, ≥15 yards for rushes (FTN
convention).
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime
from typing import Final

import polars as pl

from etl.constants import normalize_team_abbr
from etl.models import Game, Play

# The minimum PBP columns we need. nflverse returns ~370; we subset on pull to
# keep polars memory + network small. If a column isn't present in a given
# nflverse release (schema drift), fetch logs a warning and skips it — the
# contract tests catch any resulting data quality regression.
_REQUIRED_PLAY_COLUMNS: Final[tuple[str, ...]] = (
    "game_id", "play_id", "season", "week", "season_type",
    "posteam", "defteam", "down", "ydstogo", "yardline_100",
    "play_type", "yards_gained", "epa", "cpoe", "success", "wp",
    "qb_dropback", "qb_kneel", "qb_spike", "two_point_attempt",
    "pass_attempt", "rush_attempt", "pass_length", "air_yards",
    "special_teams_play",
    # E4 player IDs — populated from base PBP, not participation
    "passer_player_id", "passer_player_name",
    "receiver_player_id", "receiver_player_name",
    "rusher_player_id", "rusher_player_name",
    "yards_after_catch",
    "complete_pass", "incomplete_pass",
    # E4-dep
    "qb_hit", "sack", "was_pressure", "number_of_pass_rushers",
    # E5-dep
    "shotgun", "no_huddle", "pre_snap_motion", "play_action",
    "offense_personnel", "defense_personnel", "defenders_in_box",
    # E5-nfl4th-dep
    "score_differential", "game_seconds_remaining",
    "posteam_timeouts_remaining", "defteam_timeouts_remaining",
    "roof", "surface",
)

# nflverse → our schema column renames. Keeps our Pydantic fields aligned with
# DB columns without us taking the column name dance into the aggregation SQL.
_PLAY_COLUMN_RENAMES: Final[dict[str, str]] = {
    "offense_personnel": "personnel_offense",
    "defense_personnel": "personnel_defense",
}

EXPLOSIVE_PASS_YARDS: Final[int] = 20
EXPLOSIVE_RUN_YARDS: Final[int] = 15

# nflverse stores these as float64 (0.0 / 1.0 / null) for historical pandas-
# compat reasons. Cast to bool on read so downstream expressions + Pydantic
# models see the semantic type they expect.
_BOOLEAN_PLAY_COLUMNS: Final[tuple[str, ...]] = (
    "qb_dropback", "qb_kneel", "qb_spike", "two_point_attempt",
    "pass_attempt", "rush_attempt", "success",
    "qb_hit", "sack", "was_pressure",
    "shotgun", "no_huddle", "pre_snap_motion", "play_action",
    "special_teams_play",
    "complete_pass", "incomplete_pass",
)


def required_play_columns() -> tuple[str, ...]:
    return _REQUIRED_PLAY_COLUMNS


def _cast_booleans(df: pl.DataFrame) -> pl.DataFrame:
    """Cast known boolean-semantic columns from float64 (nflverse convention)
    to proper Boolean. Columns that are already bool or absent are no-ops."""
    casts: list[pl.Expr] = []
    for col in _BOOLEAN_PLAY_COLUMNS:
        if col not in df.columns:
            continue
        if df.schema[col] == pl.Boolean:
            continue
        # Any non-zero, non-null value → true. Null stays null.
        casts.append(
            pl.when(pl.col(col).is_null())
            .then(None)
            .otherwise(pl.col(col) != 0)
            .alias(col)
        )
    return df.with_columns(casts) if casts else df


# ---- fetch (network I/O) ----------------------------------------------------

def fetch_pbp(seasons: Iterable[int]) -> pl.DataFrame:
    """Fetch league-wide PBP for the given seasons via nflreadpy. Subset to
    the columns in `_REQUIRED_PLAY_COLUMNS` that are actually present.

    E4-00a: also joins participation data to populate was_pressure,
    defenders_in_box, personnel groupings, pre_snap_motion, play_action.
    """
    import nflreadpy  # lazy: nflreadpy imports polars + pyarrow eagerly

    seasons = tuple(seasons)
    pbp = nflreadpy.load_pbp(seasons=seasons)
    part = _load_participation_safe(seasons)
    if part is not None:
        pbp = _join_participation(pbp, part)
    available = tuple(c for c in _REQUIRED_PLAY_COLUMNS if c in pbp.columns)
    return _cast_booleans(pbp.select(available))


def _load_participation_safe(seasons: tuple[int, ...]) -> pl.DataFrame | None:
    """Participation data is optional — coverage is "spotty" per SPEC §3.3.
    If nflreadpy doesn't have it (API change, release lag), return None so
    the ETL continues with base PBP only. Contract test #22 will flag any
    downstream stats that silently depend on this data."""
    import nflreadpy
    try:
        return nflreadpy.load_participation(seasons=seasons)
    except Exception:  # noqa: BLE001 - defensive: any participation error degrades gracefully
        return None


def _join_participation(pbp: pl.DataFrame, part: pl.DataFrame) -> pl.DataFrame:
    """Left-join participation onto PBP, preferring participation-sourced
    columns when both PBP and participation report the same field."""
    keep = [
        c for c in (
            "nflverse_game_id", "play_id", "was_pressure", "number_of_pass_rushers",
            "defenders_in_box", "offense_personnel", "defense_personnel",
            "offense_players", "defense_players",
        )
        if c in part.columns
    ]
    if not keep or "nflverse_game_id" not in part.columns:
        return pbp
    part_slim = part.select(keep).rename({"nflverse_game_id": "game_id"})
    # Drop PBP columns we intend to overwrite, then left-join.
    overlap = [
        c for c in ("was_pressure", "number_of_pass_rushers", "defenders_in_box",
                    "offense_personnel", "defense_personnel")
        if c in pbp.columns and c in part_slim.columns
    ]
    if overlap:
        pbp = pbp.drop(overlap)
    # PBP's play_id is f64 (float-with-NaN legacy); participation ships it as
    # i32. Cast both to i64 before the join so polars doesn't refuse.
    pbp = pbp.with_columns(pl.col("play_id").cast(pl.Int64))
    part_slim = part_slim.with_columns(pl.col("play_id").cast(pl.Int64))
    return pbp.join(part_slim, on=["game_id", "play_id"], how="left")


def compute_participation_coverage(pbp: pl.DataFrame) -> pl.DataFrame:
    """Compute per-game participation_coverage: fraction of plays with a
    non-null `was_pressure` or `offense_personnel`. Returns DF keyed by
    game_id; upserted into games.participation_coverage by the load step.
    """
    if "was_pressure" not in pbp.columns and "offense_personnel" not in pbp.columns:
        return pl.DataFrame({"game_id": [], "participation_coverage": []})
    signal_col = "was_pressure" if "was_pressure" in pbp.columns else "offense_personnel"
    # Only count plays where a player was on the field (has a passer or rusher).
    relevant = pbp.filter(
        pl.col("passer_player_id").is_not_null() | pl.col("rusher_player_id").is_not_null()
    )
    if relevant.height == 0:
        return pl.DataFrame({"game_id": [], "participation_coverage": []})
    return relevant.group_by("game_id").agg(
        (pl.col(signal_col).is_not_null().sum() / pl.len())
        .alias("participation_coverage")
    )


def fetch_schedules(seasons: Iterable[int]) -> pl.DataFrame:
    """Fetch schedule rows for the given seasons via nflreadpy.

    nflverse schedules expose `game_type` (REG, WC, DIV, CON, SB). Our schema
    collapses post-season variants into `season_type='POST'`. Map here so the
    downstream normalizer / models don't carry the nflverse taxonomy.
    """
    import nflreadpy

    seasons = tuple(seasons)
    sched = nflreadpy.load_schedules(seasons=seasons)

    if "game_type" in sched.columns:
        sched = sched.with_columns(
            pl.when(pl.col("game_type") == "REG")
            .then(pl.lit("REG"))
            .otherwise(pl.lit("POST"))
            .alias("season_type")
        )

    keep = [
        c for c in (
            "game_id", "season", "week", "season_type", "home_team", "away_team",
            "home_score", "away_score", "gameday",
        )
        if c in sched.columns
    ]
    return sched.select(keep)


# ---- normalize (pure transforms) --------------------------------------------

def normalize_plays(df: pl.DataFrame) -> list[Play]:
    """Convert a polars PBP frame into a list of Play models.

    Responsibilities:
      - Team abbreviation normalization (WSH → WAS) on posteam/defteam.
      - Column renames (offense_personnel → personnel_offense, etc.).
      - Compute is_explosive_pass / is_explosive_run from yards_gained.
    """
    renamed = df.rename({k: v for k, v in _PLAY_COLUMN_RENAMES.items() if k in df.columns})
    derived = renamed
    # Derived flags require both the attempt column and yards_gained. Skip
    # gracefully when either is absent (small test frames, old nflverse releases).
    if {"pass_attempt", "yards_gained"}.issubset(derived.columns):
        derived = derived.with_columns(
            _explosive_expr(col="pass_attempt", yards_threshold=EXPLOSIVE_PASS_YARDS)
            .alias("is_explosive_pass")
        )
    if {"rush_attempt", "yards_gained"}.issubset(derived.columns):
        derived = derived.with_columns(
            _explosive_expr(col="rush_attempt", yards_threshold=EXPLOSIVE_RUN_YARDS)
            .alias("is_explosive_run")
        )
    records = derived.to_dicts()
    return [_play_from_record(r) for r in records]


def normalize_games(df: pl.DataFrame) -> list[Game]:
    """Convert a polars schedule frame into a list of Game models."""
    records = df.to_dicts()
    return [_game_from_record(r) for r in records]


# ---- internals --------------------------------------------------------------

def _explosive_expr(*, col: str, yards_threshold: int) -> pl.Expr:
    """Build a polars expression for is_explosive_{pass,run}.

    Returns null when the relevant attempt flag is null, false when not an
    attempt, true when an attempt gained ≥ threshold yards.
    """
    return (
        pl.when(pl.col(col).is_null())
        .then(pl.lit(False, dtype=pl.Boolean))
        .when(pl.col(col) & (pl.col("yards_gained") >= yards_threshold))
        .then(pl.lit(True, dtype=pl.Boolean))
        .otherwise(pl.lit(False, dtype=pl.Boolean))
    )


def _play_from_record(r: dict) -> Play:
    # normalize_team_abbr preserves unknowns and maps only known aliases.
    r = dict(r)  # shallow copy so polars internals aren't mutated
    if "posteam" in r:
        r["posteam"] = normalize_team_abbr(r["posteam"])
    if "defteam" in r:
        r["defteam"] = normalize_team_abbr(r["defteam"])
    # Drop any keys Pydantic doesn't know about (schema drift safety valve).
    allowed = set(Play.model_fields.keys())
    payload = {k: v for k, v in r.items() if k in allowed}
    return Play.model_validate(payload)


def _game_from_record(r: dict) -> Game:
    r = dict(r)
    for field in ("home_team", "away_team"):
        if field in r:
            r[field] = normalize_team_abbr(r[field])
    # gameday → game_date (rename + parse)
    gameday = r.pop("gameday", None)
    r["game_date"] = _parse_date(gameday)
    # completed flag: if either score is non-null we treat the game as complete.
    r["completed"] = _is_completed(r)
    allowed = set(Game.model_fields.keys())
    payload = {k: v for k, v in r.items() if k in allowed}
    return Game.model_validate(payload)


def _parse_date(raw: object) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, str):
        return datetime.strptime(raw, "%Y-%m-%d").date()
    return None


def _is_completed(r: dict) -> bool:
    home = r.get("home_score")
    away = r.get("away_score")
    return home is not None and away is not None
