"""Idempotent plays + games loaders. COPY-to-temp + INSERT … ON CONFLICT."""

from __future__ import annotations

import logging
from collections.abc import Sequence

import psycopg
from psycopg import sql

from etl.models import Game, Play

logger = logging.getLogger("etl.load")

# Columns written by the loader. `is_redzone` and `is_third_down` are generated
# by Postgres and MUST NOT appear here — attempting to INSERT into a
# GENERATED ALWAYS column raises.
_PLAYS_WRITE_COLUMNS: tuple[str, ...] = (
    "game_id", "play_id", "season", "week", "season_type",
    "posteam", "defteam", "down", "ydstogo", "yardline_100",
    "play_type", "yards_gained", "epa", "cpoe", "success", "wp",
    "qb_dropback", "qb_kneel", "qb_spike", "two_point_attempt",
    "pass_attempt", "rush_attempt", "pass_length", "air_yards",
    "is_explosive_pass", "is_explosive_run", "special_teams_play",
    "qb_hit", "sack", "was_pressure", "number_of_pass_rushers",
    "shotgun", "no_huddle", "pre_snap_motion", "play_action",
    "personnel_offense", "personnel_defense", "defenders_in_box",
    "score_differential", "game_seconds_remaining",
    "posteam_timeouts_remaining", "defteam_timeouts_remaining",
    "roof", "surface",
)

_GAMES_WRITE_COLUMNS: tuple[str, ...] = (
    "game_id", "season", "week", "season_type",
    "home_team", "away_team", "home_score", "away_score",
    "game_date", "completed", "home_offense_epa_per_play", "away_offense_epa_per_play",
)


def upsert_games(conn: psycopg.Connection, games: Sequence[Game]) -> int:
    """Upsert games by game_id. Returns row count written."""
    if not games:
        return 0
    rows = [_row_tuple(g, _GAMES_WRITE_COLUMNS) for g in games]
    stmt = _build_upsert("games", _GAMES_WRITE_COLUMNS, conflict_cols=("game_id",))
    with conn.cursor() as cur:
        cur.executemany(stmt, rows)
    logger.info("games_upserted count=%d", len(rows))
    return len(rows)


def upsert_plays(conn: psycopg.Connection, plays: Sequence[Play]) -> int:
    """Bulk-load plays via COPY-to-temp + INSERT ... ON CONFLICT. Idempotent
    via the composite PK (game_id, play_id).

    The COPY-to-temp trick is the only performant way to upsert 50k+ rows;
    straight executemany would be ~30x slower against a remote Neon instance.
    """
    if not plays:
        return 0

    cols_sql = sql.SQL(", ").join(sql.Identifier(c) for c in _PLAYS_WRITE_COLUMNS)

    with conn.cursor() as cur:
        # Create temp table mirroring plays structure but without the generated
        # columns + FK. CREATE TEMP TABLE ... AS selects a subset.
        cur.execute(
            sql.SQL(
                "CREATE TEMP TABLE _plays_staging (LIKE plays INCLUDING DEFAULTS EXCLUDING GENERATED) "
                "ON COMMIT DROP"
            )
        )
        copy_stmt = sql.SQL("COPY _plays_staging ({cols}) FROM STDIN").format(cols=cols_sql)
        with cur.copy(copy_stmt) as copy:
            for p in plays:
                copy.write_row(_row_tuple(p, _PLAYS_WRITE_COLUMNS))

        set_clause = sql.SQL(", ").join(
            sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(c))
            for c in _PLAYS_WRITE_COLUMNS
            if c not in ("game_id", "play_id")
        )
        cur.execute(
            sql.SQL(
                "INSERT INTO plays ({cols}) "
                "SELECT {cols} FROM _plays_staging "
                "ON CONFLICT (game_id, play_id) DO UPDATE SET {set_clause}"
            ).format(cols=cols_sql, set_clause=set_clause)
        )
        cur.execute(sql.SQL("SELECT count(*) FROM _plays_staging"))
        result = cur.fetchone()

    staged = result[0] if result else 0
    logger.info("plays_upserted count=%d", staged)
    return staged


def _row_tuple(model, columns: Sequence[str]) -> tuple:
    """Extract the column values from a Pydantic model in SQL column order."""
    dump = model.model_dump()
    return tuple(dump.get(c) for c in columns)


def _build_upsert(
    table: str,
    columns: Sequence[str],
    *,
    conflict_cols: Sequence[str],
) -> sql.Composed:
    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)
    cols = sql.SQL(", ").join(sql.Identifier(c) for c in columns)
    conflict = sql.SQL(", ").join(sql.Identifier(c) for c in conflict_cols)
    set_clause = sql.SQL(", ").join(
        sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(c))
        for c in columns
        if c not in conflict_cols
    )
    return sql.SQL(
        "INSERT INTO {table} ({cols}) VALUES ({placeholders}) "
        "ON CONFLICT ({conflict}) DO UPDATE SET {set_clause}"
    ).format(
        table=sql.Identifier(table),
        cols=cols,
        placeholders=placeholders,
        conflict=conflict,
        set_clause=set_clause,
    )
