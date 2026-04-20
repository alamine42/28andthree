"""Team-unit rollups (defense / OL / DL). All stats come from base PBP
where possible; pressure rate relies on participation data which degrades
to NULL when coverage < 80% (same threshold as QB rollups).

Three unit types, three typed table pairs (weekly + season) — no JSONB.
"""

from __future__ import annotations

import psycopg
from psycopg import sql

_GARBAGE_FILTER = sql.SQL(
    """
    season_type = 'REG'
    AND NOT coalesce(qb_kneel, false)
    AND NOT coalesce(qb_spike, false)
    AND NOT coalesce(two_point_attempt, false)
    AND (play_type IS NULL OR play_type <> 'no_play')
    """
)


def recompute_unit_rollups(conn: psycopg.Connection, *, season: int) -> int:
    """Recompute all 6 unit tables (weekly + season × 3 units) for the season."""
    total = 0
    with conn.cursor() as cur:
        for table in (
            "team_defense_weekly", "team_defense_season",
            "team_ol_weekly", "team_ol_season",
            "team_dl_weekly", "team_dl_season",
        ):
            cur.execute(sql.SQL("DELETE FROM {} WHERE season = %s").format(sql.Identifier(table)),
                        (season,))
        cur.execute(_DEFENSE_WEEKLY_SQL, {"season": season})
        total += max(cur.rowcount, 0)
        cur.execute(_DEFENSE_SEASON_SQL, {"season": season})
        total += max(cur.rowcount, 0)
        cur.execute(_OL_WEEKLY_SQL, {"season": season})
        total += max(cur.rowcount, 0)
        cur.execute(_OL_SEASON_SQL, {"season": season})
        total += max(cur.rowcount, 0)
        cur.execute(_DL_WEEKLY_SQL, {"season": season})
        total += max(cur.rowcount, 0)
        cur.execute(_DL_SEASON_SQL, {"season": season})
        total += max(cur.rowcount, 0)
    return total


# Defense: pressure rate, coverage EPA allowed, run stop, explosive allowed.
_DEFENSE_WEEKLY_SQL = sql.SQL(
    """
    INSERT INTO team_defense_weekly
      (team, season, week, pressure_rate, coverage_epa_allowed,
       run_stop_rate, explosive_plays_allowed, updated_at)
    SELECT
      defteam AS team, season, week,
      AVG(CASE WHEN was_pressure = true THEN 1.0
               WHEN was_pressure IS NULL THEN NULL
               ELSE 0.0 END) FILTER (WHERE qb_dropback = true)::float8 AS pressure_rate,
      AVG(epa) FILTER (WHERE qb_dropback = true)::float8 AS coverage_epa_allowed,
      AVG(CASE WHEN yards_gained <= 2 THEN 1.0 ELSE 0.0 END)
        FILTER (WHERE rush_attempt = true)::float8 AS run_stop_rate,
      COUNT(*) FILTER (
        WHERE coalesce(is_explosive_pass, false) OR coalesce(is_explosive_run, false)
      )::smallint AS explosive_plays_allowed,
      now()
    FROM plays
    WHERE season = %(season)s AND {garbage} AND defteam IS NOT NULL
    GROUP BY defteam, season, week
    """
).format(garbage=_GARBAGE_FILTER)

_DEFENSE_SEASON_SQL = sql.SQL(
    """
    INSERT INTO team_defense_season
      (team, season, pressure_rate, coverage_epa_allowed, run_stop_rate,
       explosive_plays_allowed, updated_at)
    SELECT team, season,
           AVG(pressure_rate)::float8,
           AVG(coverage_epa_allowed)::float8,
           AVG(run_stop_rate)::float8,
           SUM(explosive_plays_allowed)::int,
           now()
    FROM team_defense_weekly
    WHERE season = %(season)s
    GROUP BY team, season
    """
)

# OL: pass-block win (proxy: no sack + no pressure), run block (yards before
# contact proxy: yards_gained), pressures allowed, EPA on dropbacks.
_OL_WEEKLY_SQL = sql.SQL(
    """
    INSERT INTO team_ol_weekly
      (team, season, week, pass_block_win_rate, run_block_rate,
       pressures_allowed, epa_on_dropbacks, updated_at)
    SELECT
      posteam AS team, season, week,
      AVG(CASE WHEN was_pressure = false AND NOT coalesce(sack, false) THEN 1.0
               WHEN was_pressure IS NULL THEN NULL
               ELSE 0.0 END) FILTER (WHERE qb_dropback = true)::float8 AS pass_block_win_rate,
      -- Run block proxy: fraction of runs gaining 3+ yards.
      AVG(CASE WHEN yards_gained >= 3 THEN 1.0 ELSE 0.0 END)
        FILTER (WHERE rush_attempt = true)::float8 AS run_block_rate,
      COUNT(*) FILTER (WHERE was_pressure = true)::smallint AS pressures_allowed,
      AVG(epa) FILTER (WHERE qb_dropback = true)::float8 AS epa_on_dropbacks,
      now()
    FROM plays
    WHERE season = %(season)s AND {garbage} AND posteam IS NOT NULL
    GROUP BY posteam, season, week
    """
).format(garbage=_GARBAGE_FILTER)

_OL_SEASON_SQL = sql.SQL(
    """
    INSERT INTO team_ol_season
      (team, season, pass_block_win_rate, run_block_rate,
       pressures_allowed, epa_on_dropbacks, updated_at)
    SELECT team, season,
           AVG(pass_block_win_rate)::float8,
           AVG(run_block_rate)::float8,
           SUM(pressures_allowed)::int,
           AVG(epa_on_dropbacks)::float8,
           now()
    FROM team_ol_weekly
    WHERE season = %(season)s
    GROUP BY team, season
    """
)

# DL: pressures generated, pass-rush win (inverse of pass-block), run stop, sack rate.
_DL_WEEKLY_SQL = sql.SQL(
    """
    INSERT INTO team_dl_weekly
      (team, season, week, pressures_generated, pass_rush_win_rate,
       run_stop_rate, sack_rate, updated_at)
    SELECT
      defteam AS team, season, week,
      COUNT(*) FILTER (WHERE was_pressure = true)::smallint AS pressures_generated,
      AVG(CASE WHEN was_pressure = true OR coalesce(sack, false) THEN 1.0
               WHEN was_pressure IS NULL THEN NULL
               ELSE 0.0 END) FILTER (WHERE qb_dropback = true)::float8 AS pass_rush_win_rate,
      AVG(CASE WHEN yards_gained <= 2 THEN 1.0 ELSE 0.0 END)
        FILTER (WHERE rush_attempt = true)::float8 AS run_stop_rate,
      (COUNT(*) FILTER (WHERE sack = true)::float8
        / NULLIF(COUNT(*) FILTER (WHERE qb_dropback = true), 0))::float8 AS sack_rate,
      now()
    FROM plays
    WHERE season = %(season)s AND {garbage} AND defteam IS NOT NULL
    GROUP BY defteam, season, week
    """
).format(garbage=_GARBAGE_FILTER)

_DL_SEASON_SQL = sql.SQL(
    """
    INSERT INTO team_dl_season
      (team, season, pressures_generated, pass_rush_win_rate,
       run_stop_rate, sack_rate, updated_at)
    SELECT team, season,
           SUM(pressures_generated)::int,
           AVG(pass_rush_win_rate)::float8,
           AVG(run_stop_rate)::float8,
           AVG(sack_rate)::float8,
           now()
    FROM team_dl_weekly
    WHERE season = %(season)s
    GROUP BY team, season
    """
)
