"""Skill-position per-game (skill_weekly) + per-season (skill_season) rollups.

Covers WR / RB / TE. Position-specific columns are NULL when they don't
conceptually apply (review #3: NULL = N/A, 0 = actual zero).
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


def recompute_skill_weekly(conn: psycopg.Connection, *, season: int) -> int:
    """Build skill_weekly from receiving + rushing plays."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM skill_weekly WHERE season = %s", (season,))
        cur.execute(_SKILL_WEEKLY_SQL, {"season": season})
        return max(cur.rowcount, 0)


def recompute_skill_season(conn: psycopg.Connection, *, season: int) -> int:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM skill_season WHERE season = %s", (season,))
        cur.execute(_SKILL_SEASON_SQL, {"season": season})
        return max(cur.rowcount, 0)


_SKILL_WEEKLY_SQL = sql.SQL(
    """
    WITH receiving_plays AS (
      SELECT p.game_id, p.posteam AS team, p.season, p.week,
             p.receiver_player_id AS gsis_id,
             p.play_id, p.pass_attempt, p.complete_pass,
             p.yards_gained, p.air_yards, p.yards_after_catch,
             p.is_redzone
      FROM plays p
      WHERE p.season = %(season)s AND {garbage}
        AND p.receiver_player_id IS NOT NULL
        AND p.pass_attempt = true
    ),
    rushing_plays AS (
      SELECT p.game_id, p.posteam AS team, p.season, p.week,
             p.rusher_player_id AS gsis_id,
             p.yards_gained
      FROM plays p
      WHERE p.season = %(season)s AND {garbage}
        AND p.rusher_player_id IS NOT NULL
        AND p.rush_attempt = true
    ),
    team_dropbacks AS (
      SELECT game_id, posteam AS team, COUNT(*) AS team_dropbacks
      FROM plays
      WHERE season = %(season)s AND {garbage} AND qb_dropback = true
      GROUP BY game_id, posteam
    ),
    per_receiver AS (
      SELECT game_id, team, gsis_id, season, week,
             COUNT(*)::int AS targets,
             COUNT(*) FILTER (WHERE complete_pass)::int AS receptions,
             SUM(yards_gained) FILTER (WHERE complete_pass)::int AS yards_receiving,
             SUM(yards_after_catch) FILTER (WHERE complete_pass)::int AS yac_total,
             AVG(air_yards)::float8 AS adot_on_targets,
             COUNT(*) FILTER (WHERE is_redzone = true)::int AS redzone_targets,
             COUNT(*) FILTER (WHERE is_redzone = true AND complete_pass)::int AS redzone_receptions
      FROM receiving_plays
      GROUP BY game_id, team, gsis_id, season, week
    ),
    per_rusher AS (
      SELECT game_id, team, gsis_id, season, week,
             COUNT(*)::int AS carries,
             SUM(yards_gained)::int AS yards_rushing
      FROM rushing_plays
      GROUP BY game_id, team, gsis_id, season, week
    ),
    combined AS (
      -- Union receivers + rushers; left-join so one-or-the-other players land.
      SELECT COALESCE(r.game_id, u.game_id) AS game_id,
             COALESCE(r.team, u.team) AS team,
             COALESCE(r.gsis_id, u.gsis_id) AS gsis_id,
             COALESCE(r.season, u.season) AS season,
             COALESCE(r.week, u.week) AS week,
             r.targets, r.receptions, r.yards_receiving, r.yac_total,
             r.adot_on_targets, r.redzone_targets, r.redzone_receptions,
             u.carries, u.yards_rushing
      FROM per_receiver r
      FULL OUTER JOIN per_rusher u USING (game_id, team, gsis_id, season, week)
    )
    INSERT INTO skill_weekly
      (gsis_id, game_id, season, week, team, position,
       targets, receptions, yards_receiving, yac_total, yac_per_reception,
       routes, target_share, adot_on_targets,
       redzone_targets, redzone_receptions,
       carries, yards_rushing, ypc, updated_at)
    SELECT
      c.gsis_id, c.game_id, c.season, c.week, c.team,
      COALESCE(p.position, 'UNK')::varchar(3),
      c.targets::smallint, c.receptions::smallint,
      c.yards_receiving::smallint, c.yac_total::smallint,
      CASE WHEN c.receptions > 0 THEN c.yac_total::float8 / c.receptions ELSE NULL END,
      NULL::smallint AS routes,  -- participation-dependent; NULL until refined in future sprint
      CASE WHEN td.team_dropbacks > 0 AND c.targets IS NOT NULL
           THEN c.targets::float8 / td.team_dropbacks ELSE NULL END,
      c.adot_on_targets,
      c.redzone_targets::smallint, c.redzone_receptions::smallint,
      c.carries::smallint, c.yards_rushing::smallint,
      CASE WHEN c.carries > 0 THEN c.yards_rushing::float8 / c.carries ELSE NULL END,
      now()
    FROM combined c
    LEFT JOIN players p ON p.gsis_id = c.gsis_id
    LEFT JOIN team_dropbacks td ON td.game_id = c.game_id AND td.team = c.team
    WHERE COALESCE(p.position, '') IN ('WR', 'RB', 'TE', 'FB', 'HB')
    """
).format(garbage=_GARBAGE_FILTER)


_SKILL_SEASON_SQL = sql.SQL(
    """
    INSERT INTO skill_season
      (gsis_id, season, team, position, games_played,
       targets, receptions, yards_receiving, yac_total, yac_per_reception,
       routes, target_share, adot_on_targets,
       redzone_targets, redzone_receptions,
       carries, yards_rushing, ypc, updated_at)
    SELECT
      gsis_id, season, team,
      MAX(position) AS position,  -- should be stable per (gsis,season,team)
      COUNT(*)::smallint AS games_played,
      SUM(targets)::int AS targets,
      SUM(receptions)::int AS receptions,
      SUM(yards_receiving)::int AS yards_receiving,
      SUM(yac_total)::int AS yac_total,
      CASE WHEN SUM(receptions) > 0
           THEN SUM(yac_total)::float8 / SUM(receptions) ELSE NULL END AS yac_per_reception,
      SUM(routes)::int AS routes,
      AVG(target_share)::float8 AS target_share,
      AVG(adot_on_targets)::float8 AS adot_on_targets,
      SUM(redzone_targets)::int AS redzone_targets,
      SUM(redzone_receptions)::int AS redzone_receptions,
      SUM(carries)::int AS carries,
      SUM(yards_rushing)::int AS yards_rushing,
      CASE WHEN SUM(carries) > 0
           THEN SUM(yards_rushing)::float8 / SUM(carries) ELSE NULL END AS ypc,
      now()
    FROM skill_weekly
    WHERE season = %(season)s
    GROUP BY gsis_id, season, team
    """
)
