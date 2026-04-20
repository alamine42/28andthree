"""Denormalize per-game offensive EPA into the games table (E3-15).

After plays for a season land, compute AVG(epa) per (game_id, posteam) over
REG qualifying plays (same garbage-play filter as phase aggregations) and
write the values into games.home_offense_epa_per_play +
games.away_offense_epa_per_play. Feeds the home-page Last-6-Games strip.

Runs inside the caller's transaction; no commit here.
"""

from __future__ import annotations

import psycopg
from psycopg import sql

from etl.transform.phases import GARBAGE_PLAY_PREDICATE


# Scope: offensive plays only (dropbacks + rushes). Matches what rbsdm + FTN
# call "offensive EPA per play" at the game level — what the user sees on
# the Last-6-Games strip.
_OFFENSIVE_PREDICATE = sql.SQL("(qb_dropback = true OR rush_attempt = true)")


def recompute_games_epa(conn: psycopg.Connection, *, season: int) -> int:
    """Recompute home_offense_epa_per_play + away_offense_epa_per_play for
    every REG game in the given season. Returns rows updated."""
    stmt = sql.SQL(
        """
        WITH per_game_per_team AS (
            SELECT p.game_id, p.posteam, AVG(p.epa)::double precision AS epa_per_play
            FROM plays p
            WHERE p.season = %(season)s
              AND p.posteam IS NOT NULL
              AND {offensive}
              AND {garbage}
            GROUP BY p.game_id, p.posteam
        ),
        per_game AS (
            SELECT g.game_id,
                   MAX(CASE WHEN t.posteam = g.home_team THEN t.epa_per_play END) AS home_epa,
                   MAX(CASE WHEN t.posteam = g.away_team THEN t.epa_per_play END) AS away_epa
            FROM games g
            JOIN per_game_per_team t USING (game_id)
            WHERE g.season = %(season)s AND g.season_type = 'REG'
            GROUP BY g.game_id
        )
        UPDATE games g
        SET home_offense_epa_per_play = per_game.home_epa,
            away_offense_epa_per_play = per_game.away_epa
        FROM per_game
        WHERE g.game_id = per_game.game_id
        """
    ).format(offensive=_OFFENSIVE_PREDICATE, garbage=GARBAGE_PLAY_PREDICATE)

    with conn.cursor() as cur:
        cur.execute(stmt, {"season": season})
        return max(cur.rowcount, 0)
