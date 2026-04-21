"""E5-07: coaching-tendency rollups for one (team, season).

Pulls plays from Postgres for the target team+season, materializes the
WeeklyCoach registry in etl.ingest.coaches, runs the pure aggregator, and
upserts rollups into coaching_tendencies_weekly.

Usage:
    cd /path/to/repo
    ETL_DATABASE_URL=<prod> PYTHONPATH=. \\
        uv run --project etl python -m etl.scripts.e5_coaching_backfill \\
            --team NE --season 2025
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

import polars as pl
import psycopg

from etl.ingest.coaches import build_weekly_coaches
from etl.load.coaching import upsert_coaching_tendencies
from etl.transform.coaching_tendencies import aggregate_tendencies

log = logging.getLogger("e5-coaching")

# Columns the aggregator reads. Fetching only what we need keeps the
# transit payload small even though polars can handle the whole row.
PLAYS_COLUMNS = [
    "game_id", "season", "week", "posteam", "defteam",
    "play_type", "down", "ydstogo",
    "shotgun", "no_huddle", "pre_snap_motion", "play_action",
    "personnel_offense", "score_differential", "game_seconds_remaining",
    "number_of_pass_rushers",
]


def _fetch_plays(conn: psycopg.Connection, team: str, season: int) -> pl.DataFrame:
    """Pull plays where the team is either offense or defense for the season.
    We need both sides because the aggregator does offense + defense rollups."""
    cols_sql = ", ".join(PLAYS_COLUMNS)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {cols_sql}
            FROM plays
            WHERE season = %s
              AND (posteam = %s OR defteam = %s)
              AND play_type IN ('pass', 'run')
              AND season_type = 'REG'
            """,
            (season, team, team),
        )
        rows = cur.fetchall()
    if not rows:
        return pl.DataFrame(schema={c: pl.Utf8 for c in PLAYS_COLUMNS})
    data: dict[str, list] = {c: [] for c in PLAYS_COLUMNS}
    for row in rows:
        for i, c in enumerate(PLAYS_COLUMNS):
            data[c].append(row[i])
    return pl.DataFrame(data)


def _weeks_present(df: pl.DataFrame) -> list[int]:
    if df.is_empty() or "week" not in df.columns:
        return []
    return sorted({int(w) for w in df["week"].to_list() if w is not None})


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    p = argparse.ArgumentParser()
    p.add_argument("--team", required=True)
    p.add_argument("--season", type=int, required=True)
    args = p.parse_args(argv)

    url = os.environ.get("ETL_DATABASE_URL")
    if not url:
        log.error("ETL_DATABASE_URL not set")
        return 2

    with psycopg.connect(url) as conn:
        log.info("fetching plays for %s %d", args.team, args.season)
        plays_df = _fetch_plays(conn, args.team, args.season)
        log.info("plays loaded: %d", plays_df.height)

        weeks = _weeks_present(plays_df)
        log.info("weeks present: %s", weeks)
        if not weeks:
            log.warning("no plays for %s %d — nothing to aggregate", args.team, args.season)
            return 0

        coaches = build_weekly_coaches(args.team, args.season, weeks=weeks)
        log.info("weekly coach records: %d (across %d roles)",
                 len(coaches), len({c.role for c in coaches}))

        if not coaches:
            log.error(
                "no coach registry entries for %s %d — seed etl/ingest/coaches.py first",
                args.team, args.season,
            )
            return 1

        rollups = aggregate_tendencies(plays_df, coaches)
        log.info("rollups produced: %d", len(rollups))

        n = upsert_coaching_tendencies(conn, rollups)
        conn.commit()
        log.info("upserted rollups: %d", n)

    by_role: dict[str, int] = {}
    for r in rollups:
        by_role[r.coach_role] = by_role.get(r.coach_role, 0) + 1
    print("\nCoaching tendency rows by role:")
    for role in ("HC", "OC", "DC"):
        print(f"  {role}: {by_role.get(role, 0)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
