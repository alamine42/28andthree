"""QB per-game (qb_weekly) + per-season (qb_season) rollups.

Key decisions (post-adversarial-review):
  - primary_starter rule is deterministic: >50% team dropbacks, or max-
    dropbacks fallback with earliest-passer tiebreaker. Exactly one per
    (game_id, team).
  - Pressure-derived fields (pressure_rate, clean/pressured EPA splits) are
    NULL when the game's participation_coverage < 0.80.
  - Rollups key on (gsis_id, game_id) so a player traded mid-week lands
    cleanly for both teams.
"""

from __future__ import annotations

import psycopg
from psycopg import sql

# Only count dropbacks that aren't garbage plays. Same filter as E2 phase agg.
_DROPBACK_FILTER = sql.SQL(
    """
    qb_dropback = true
    AND season_type = 'REG'
    AND NOT coalesce(qb_kneel, false)
    AND NOT coalesce(qb_spike, false)
    AND NOT coalesce(two_point_attempt, false)
    AND (play_type IS NULL OR play_type <> 'no_play')
    AND passer_player_id IS NOT NULL
    """
)

# Pressure stats only trustworthy when the GAME has enough tagged plays.
_COVERAGE_THRESHOLD = 0.80


def recompute_qb_weekly(conn: psycopg.Connection, *, season: int) -> int:
    """Per-game QB aggregates for the given season."""
    with conn.cursor() as cur:
        # Wipe and rebuild for idempotency; qb_weekly is small (~3k rows/season).
        cur.execute("DELETE FROM qb_weekly WHERE season = %s", (season,))
        cur.execute(_QB_WEEKLY_SQL, {"season": season})
        return max(cur.rowcount, 0)


def recompute_qb_season(conn: psycopg.Connection, *, season: int) -> int:
    """Season rollup — aggregates the weekly table."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM qb_season WHERE season = %s", (season,))
        cur.execute(_QB_SEASON_SQL, {"season": season})
        return max(cur.rowcount, 0)


_QB_WEEKLY_SQL = sql.SQL(
    """
    WITH qb_plays AS (
      SELECT p.game_id, p.posteam AS team, p.season, p.week,
             p.passer_player_id AS gsis_id,
             p.play_id, p.epa, p.cpoe, p.success,
             p.pass_attempt, p.complete_pass,
             p.air_yards, p.yards_gained,
             p.was_pressure, p.qb_hit, p.sack,
             g.participation_coverage
      FROM plays p
      JOIN games g ON g.game_id = p.game_id
      WHERE p.season = %(season)s
        AND p.qb_dropback = true
        AND p.season_type = 'REG'
        AND NOT coalesce(p.qb_kneel, false)
        AND NOT coalesce(p.qb_spike, false)
        AND NOT coalesce(p.two_point_attempt, false)
        AND (p.play_type IS NULL OR p.play_type <> 'no_play')
        AND p.passer_player_id IS NOT NULL
    ),
    team_dropbacks AS (
      SELECT game_id, team, COUNT(*)::int AS team_dropbacks
      FROM qb_plays
      GROUP BY game_id, team
    ),
    per_qb AS (
      SELECT game_id, team, gsis_id, season, week,
             COUNT(*)::int AS dropbacks,
             MIN(play_id) AS earliest_play_id,
             COUNT(*) FILTER (WHERE pass_attempt) AS attempts,
             COUNT(*) FILTER (WHERE complete_pass)::int AS completions,
             COALESCE(SUM(yards_gained) FILTER (WHERE complete_pass), 0)::int AS yards,
             AVG(epa)::float8 AS epa_per_dropback,
             AVG(cpoe) FILTER (WHERE pass_attempt)::float8 AS cpoe,
             AVG(air_yards) FILTER (WHERE pass_attempt)::float8 AS adot,
             AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::float8 AS success_rate,
             BOOL_OR(participation_coverage IS NULL OR participation_coverage < {threshold})
               AS low_coverage,
             COUNT(*) FILTER (WHERE was_pressure = true)::int AS pressured_dropbacks,
             AVG(epa) FILTER (WHERE was_pressure = false)::float8 AS clean_pocket_epa,
             AVG(epa) FILTER (WHERE was_pressure = true)::float8 AS pressured_epa,
             COUNT(*) FILTER (WHERE pass_attempt AND air_yards >= 20)::int AS deep_attempts,
             COUNT(*) FILTER (WHERE pass_attempt AND air_yards >= 20
                                    AND complete_pass)::int AS deep_completions,
             AVG(epa) FILTER (WHERE pass_attempt AND air_yards >= 20)::float8 AS deep_epa
      FROM qb_plays
      GROUP BY game_id, team, gsis_id, season, week
    ),
    with_ratio AS (
      SELECT per_qb.*, td.team_dropbacks,
             per_qb.dropbacks::float / NULLIF(td.team_dropbacks, 0) AS share
      FROM per_qb
      JOIN team_dropbacks td USING (game_id, team)
    ),
    primary_rank AS (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY game_id, team
               ORDER BY
                 CASE WHEN share > 0.5 THEN 0 ELSE 1 END,
                 dropbacks DESC,
                 earliest_play_id ASC
             ) AS rn
      FROM with_ratio
    )
    INSERT INTO qb_weekly
      (gsis_id, game_id, season, week, team, dropbacks, attempts, completions,
       yards, epa_per_dropback, cpoe, adot, success_rate,
       pressure_rate, pressured_dropbacks,
       clean_pocket_epa_per_dropback, pressured_epa_per_dropback,
       deep_attempts, deep_completions, deep_epa_per_attempt,
       primary_starter, updated_at)
    SELECT
      gsis_id, game_id, season, week, team,
      dropbacks::smallint, attempts::smallint, completions::smallint,
      yards::smallint,
      epa_per_dropback, cpoe, adot, success_rate,
      CASE WHEN low_coverage THEN NULL
           ELSE pressured_dropbacks::float / NULLIF(dropbacks, 0) END AS pressure_rate,
      CASE WHEN low_coverage THEN NULL ELSE pressured_dropbacks::smallint END,
      CASE WHEN low_coverage THEN NULL ELSE clean_pocket_epa END,
      CASE WHEN low_coverage THEN NULL ELSE pressured_epa END,
      deep_attempts::smallint, deep_completions::smallint, deep_epa,
      (rn = 1) AS primary_starter,
      now()
    FROM primary_rank
    """
).format(threshold=sql.Literal(_COVERAGE_THRESHOLD))


_QB_SEASON_SQL = sql.SQL(
    """
    INSERT INTO qb_season
      (gsis_id, season, team, games_played, primary_starter_games,
       dropbacks, attempts, completions, yards,
       epa_per_dropback, cpoe, adot, success_rate,
       pressure_rate, clean_pocket_epa_per_dropback, pressured_epa_per_dropback,
       deep_epa_per_attempt, updated_at)
    SELECT
      gsis_id, season, team,
      COUNT(*)::smallint AS games_played,
      COUNT(*) FILTER (WHERE primary_starter)::smallint AS primary_starter_games,
      SUM(dropbacks)::int AS dropbacks,
      SUM(attempts)::int AS attempts,
      SUM(completions)::int AS completions,
      SUM(yards)::int AS yards,
      SUM(epa_per_dropback * dropbacks)::float8 / NULLIF(SUM(dropbacks), 0) AS epa_per_dropback,
      SUM(cpoe * attempts)::float8 / NULLIF(SUM(attempts), 0) AS cpoe,
      SUM(adot * attempts)::float8 / NULLIF(SUM(attempts), 0) AS adot,
      SUM(success_rate * dropbacks)::float8 / NULLIF(SUM(dropbacks), 0) AS success_rate,
      AVG(pressure_rate)::float8 AS pressure_rate,
      AVG(clean_pocket_epa_per_dropback)::float8 AS clean_pocket_epa_per_dropback,
      AVG(pressured_epa_per_dropback)::float8 AS pressured_epa_per_dropback,
      AVG(deep_epa_per_attempt)::float8 AS deep_epa_per_attempt,
      now()
    FROM qb_weekly
    WHERE season = %(season)s
    GROUP BY gsis_id, season, team
    """
)
