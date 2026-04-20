"""Upsert players + roster_snapshots. Called once per ETL run after
rosters are fetched; feeds FK constraints for qb_weekly / skill_weekly etc."""

from __future__ import annotations

import logging
from collections.abc import Sequence

import psycopg
from psycopg import sql

from etl.ingest.rosters import PlayerRow, RosterSnapshotRow

logger = logging.getLogger("etl.load")


def upsert_players(conn: psycopg.Connection, players: Sequence[PlayerRow]) -> int:
    if not players:
        return 0
    rows = [
        (
            p.gsis_id, p.display_name, p.first_name, p.last_name, p.position,
            p.current_team, p.current_jersey_number, p.rookie_year, p.headshot_url,
        )
        for p in players
    ]
    stmt = sql.SQL(
        """
        INSERT INTO players
            (gsis_id, display_name, first_name, last_name, position,
             current_team, current_jersey_number, rookie_year, headshot_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (gsis_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            position = EXCLUDED.position,
            current_team = EXCLUDED.current_team,
            current_jersey_number = EXCLUDED.current_jersey_number,
            rookie_year = EXCLUDED.rookie_year,
            headshot_url = EXCLUDED.headshot_url,
            updated_at = now()
        """
    )
    with conn.cursor() as cur:
        cur.executemany(stmt, rows)
    logger.info("players_upserted count=%d", len(rows))
    return len(rows)


def upsert_roster_snapshots(
    conn: psycopg.Connection, snapshots: Sequence[RosterSnapshotRow]
) -> int:
    if not snapshots:
        return 0
    rows = [
        (s.gsis_id, s.season, s.team, s.jersey_number, s.position,
         s.display_name, s.headshot_url)
        for s in snapshots
    ]
    stmt = sql.SQL(
        """
        INSERT INTO roster_snapshots
            (gsis_id, season, team, jersey_number, position,
             display_name, headshot_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (gsis_id, season, team) DO UPDATE SET
            jersey_number = EXCLUDED.jersey_number,
            position = EXCLUDED.position,
            display_name = EXCLUDED.display_name,
            headshot_url = EXCLUDED.headshot_url,
            updated_at = now()
        """
    )
    with conn.cursor() as cur:
        cur.executemany(stmt, rows)
    logger.info("roster_snapshots_upserted count=%d", len(rows))
    return len(rows)
