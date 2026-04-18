"""Phase aggregation into team_phase_weekly and team_phase_season.

Filter definitions live in docs/phase-definitions.md (versioned contract).
Rank + tiebreak semantics come from SPEC §3.5a.

Structure:
  - PHASE_FILTERS: per-phase SQL predicates + group-by column + metric type.
  - build_weekly_sql / build_season_sql: parameterized aggregation queries.
  - recompute_weekly / recompute_season: run queries against a Postgres conn.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import psycopg
from psycopg import sql

from etl.constants import PHASES

MetricKind = Literal["epa", "rate"]

# Weekly sample-size threshold per SPEC §3.5a.
WEEKLY_MIN_PLAYS = 10
# Season sample-size threshold per SPEC §3.5a.
SEASON_MIN_PLAYS = 30


@dataclass(frozen=True)
class PhaseFilter:
    """One row per phase in docs/phase-definitions.md §2."""

    predicate: str        # raw SQL predicate; trust-sourced from phase-definitions.md
    group_by: str         # 'posteam' or 'defteam'
    metric: MetricKind    # 'epa' (avg(epa)) or 'rate' (avg of explosive flag)


# Matches docs/phase-definitions.md §2. Keep in sync.
PHASE_FILTERS: dict[str, PhaseFilter] = {
    "pass_offense":        PhaseFilter("qb_dropback = true", "posteam", "epa"),
    "rush_offense":        PhaseFilter("rush_attempt = true", "posteam", "epa"),
    "overall_offense":     PhaseFilter("(qb_dropback = true OR rush_attempt = true)", "posteam", "epa"),
    "pass_defense":        PhaseFilter("qb_dropback = true", "defteam", "epa"),
    "run_defense":         PhaseFilter("rush_attempt = true", "defteam", "epa"),
    "redzone_offense":     PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_redzone = true", "posteam", "epa"),
    "redzone_defense":     PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_redzone = true", "defteam", "epa"),
    "third_down_offense":  PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_third_down = true", "posteam", "epa"),
    "third_down_defense":  PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_third_down = true", "defteam", "epa"),
    "explosive_offense":   PhaseFilter("(qb_dropback = true OR rush_attempt = true)", "posteam", "rate"),
    "explosive_defense":   PhaseFilter("(qb_dropback = true OR rush_attempt = true)", "defteam", "rate"),
    "special_teams":       PhaseFilter("special_teams_play = true", "posteam", "epa"),
}

# Belt-and-suspenders: keep in sync with the enum definition in schema.ts.
assert set(PHASE_FILTERS) == set(PHASES), "PHASE_FILTERS drifted from PHASES"

# Global rules §1: REG only, exclude garbage plays.
GARBAGE_PLAY_PREDICATE = sql.SQL(
    """
    season_type = 'REG'
    AND NOT coalesce(qb_kneel, false)
    AND NOT coalesce(qb_spike, false)
    AND NOT coalesce(two_point_attempt, false)
    AND (play_type IS NULL OR play_type <> 'no_play')
    """
)


def recompute_weekly(
    conn: psycopg.Connection,
    *,
    season: int,
    weeks: list[int] | None = None,
) -> int:
    """Recompute team_phase_weekly for the given season (and optional week subset).

    Returns total row count written across all phases. Runs inside the caller's
    transaction; no commit here.
    """
    total = 0
    for phase in PHASES:
        filt = PHASE_FILTERS[phase]
        stmt = _build_weekly_sql(phase, filt, weeks_filter=weeks)
        with conn.cursor() as cur:
            cur.execute(stmt, {"season": season, "weeks": weeks or []})
            total += cur.rowcount if cur.rowcount > 0 else 0
    return total


def recompute_season(conn: psycopg.Connection, *, season: int) -> int:
    """Recompute team_phase_season for the given season. Returns rows written."""
    total = 0
    for phase in PHASES:
        filt = PHASE_FILTERS[phase]
        stmt = _build_season_sql(phase, filt)
        with conn.cursor() as cur:
            cur.execute(stmt, {"season": season})
            total += cur.rowcount if cur.rowcount > 0 else 0
    return total


def _metric_expr(metric: MetricKind) -> sql.Composed:
    """Return the SQL expression for the phase's primary metric.

    For EPA phases: AVG(epa).
    For rate phases: AVG(is_explosive_pass OR is_explosive_run as 1/0).
    """
    if metric == "epa":
        return sql.SQL("AVG(epa)::double precision")
    return sql.SQL(
        "AVG(CASE WHEN coalesce(is_explosive, false) THEN 1.0 ELSE 0.0 END)::double precision"
    )


def _filtered_select(metric: MetricKind) -> sql.Composed:
    """Project the minimum columns each metric type needs."""
    base = sql.SQL("{group_col} AS team, season, week, epa, success")
    if metric == "epa":
        return base
    return sql.SQL(
        "{group_col} AS team, season, week, epa, success, "
        "(coalesce(is_explosive_pass, false) OR coalesce(is_explosive_run, false)) AS is_explosive"
    )


def _filtered_select_season(metric: MetricKind) -> sql.Composed:
    """Same as _filtered_select but without the week column (season rollup)."""
    base = sql.SQL("{group_col} AS team, season, epa, success")
    if metric == "epa":
        return base
    return sql.SQL(
        "{group_col} AS team, season, epa, success, "
        "(coalesce(is_explosive_pass, false) OR coalesce(is_explosive_run, false)) AS is_explosive"
    )


def _build_weekly_sql(
    phase: str,
    filt: PhaseFilter,
    *,
    weeks_filter: list[int] | None,
) -> sql.Composed:
    metric = _metric_expr(filt.metric)
    predicate = sql.SQL(filt.predicate)
    group_col = sql.Identifier(filt.group_by)
    weekly_min = sql.Literal(WEEKLY_MIN_PLAYS)
    phase_literal = sql.Literal(phase)
    week_filter = (
        sql.SQL("AND week = ANY(%(weeks)s::int[])")
        if weeks_filter
        else sql.SQL("")
    )

    filtered_select = _filtered_select(filt.metric).format(group_col=group_col)
    return sql.SQL(
        """
        WITH filtered AS (
            SELECT {filtered_select}
            FROM plays
            WHERE season = %(season)s
              {week_filter}
              AND {predicate}
              AND {garbage}
              AND {group_col} IS NOT NULL
        ),
        rollups AS (
            SELECT team, season, week,
                   COUNT(*)::int AS plays,
                   {metric} AS epa_per_play,
                   AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::double precision AS success_rate
            FROM filtered
            GROUP BY team, season, week
        ),
        flagged AS (
            SELECT *, (plays < {weekly_min}) AS insufficient_sample
            FROM rollups
        ),
        ranked AS (
            SELECT *,
                   CASE WHEN insufficient_sample THEN NULL::smallint
                        ELSE ROW_NUMBER() OVER (
                             PARTITION BY season, week
                             ORDER BY
                               CASE WHEN insufficient_sample THEN 1 ELSE 0 END,
                               ROUND(epa_per_play::numeric, 6) DESC NULLS LAST,
                               plays DESC,
                               ROUND(success_rate::numeric, 6) DESC NULLS LAST,
                               team ASC
                        )::smallint
                   END AS rank
            FROM flagged
        ),
        with_k AS (
            SELECT *,
                   MAX(rank) OVER (PARTITION BY season, week) AS k
            FROM ranked
        )
        INSERT INTO team_phase_weekly
            (team, season, week, phase, plays, epa_per_play, success_rate, rank, percentile, insufficient_sample, updated_at)
        SELECT team, season, week, {phase_literal}::phase_enum, plays,
               CASE WHEN insufficient_sample THEN NULL ELSE epa_per_play END,
               CASE WHEN insufficient_sample THEN NULL ELSE success_rate END,
               rank,
               CASE WHEN rank IS NULL OR k IS NULL OR k = 0 THEN NULL
                    ELSE ((k - rank + 1)::double precision / k::double precision)
               END,
               insufficient_sample,
               now()
        FROM with_k
        ON CONFLICT (team, season, week, phase) DO UPDATE SET
            plays = EXCLUDED.plays,
            epa_per_play = EXCLUDED.epa_per_play,
            success_rate = EXCLUDED.success_rate,
            rank = EXCLUDED.rank,
            percentile = EXCLUDED.percentile,
            insufficient_sample = EXCLUDED.insufficient_sample,
            updated_at = now()
        """
    ).format(
        filtered_select=filtered_select,
        group_col=group_col,
        predicate=predicate,
        garbage=GARBAGE_PLAY_PREDICATE,
        metric=metric,
        weekly_min=weekly_min,
        phase_literal=phase_literal,
        week_filter=week_filter,
    )


def _build_season_sql(phase: str, filt: PhaseFilter) -> sql.Composed:
    metric = _metric_expr(filt.metric)
    predicate = sql.SQL(filt.predicate)
    group_col = sql.Identifier(filt.group_by)
    season_min = sql.Literal(SEASON_MIN_PLAYS)
    phase_literal = sql.Literal(phase)

    filtered_select = _filtered_select_season(filt.metric).format(group_col=group_col)
    return sql.SQL(
        """
        WITH filtered AS (
            SELECT {filtered_select}
            FROM plays
            WHERE season = %(season)s
              AND {predicate}
              AND {garbage}
              AND {group_col} IS NOT NULL
        ),
        rollups AS (
            SELECT team, season,
                   COUNT(*)::int AS plays,
                   {metric} AS epa_per_play,
                   AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::double precision AS success_rate
            FROM filtered
            GROUP BY team, season
        ),
        flagged AS (
            SELECT *, (plays < {season_min}) AS insufficient_sample
            FROM rollups
        ),
        ranked AS (
            SELECT *,
                   CASE WHEN insufficient_sample THEN NULL::smallint
                        ELSE ROW_NUMBER() OVER (
                             PARTITION BY season
                             ORDER BY
                               CASE WHEN insufficient_sample THEN 1 ELSE 0 END,
                               epa_per_play DESC NULLS LAST,
                               plays DESC,
                               success_rate DESC NULLS LAST,
                               team ASC
                        )::smallint
                   END AS rank
            FROM flagged
        ),
        with_k AS (
            SELECT *,
                   MAX(rank) OVER (PARTITION BY season) AS k
            FROM ranked
        )
        INSERT INTO team_phase_season
            (team, season, phase, plays, epa_per_play, success_rate, rank, percentile, insufficient_sample, updated_at)
        SELECT team, season, {phase_literal}::phase_enum, plays,
               CASE WHEN insufficient_sample THEN NULL ELSE epa_per_play END,
               CASE WHEN insufficient_sample THEN NULL ELSE success_rate END,
               rank,
               CASE WHEN rank IS NULL OR k IS NULL OR k = 0 THEN NULL
                    ELSE ((k - rank + 1)::double precision / k::double precision)
               END,
               insufficient_sample,
               now()
        FROM with_k
        ON CONFLICT (team, season, phase) DO UPDATE SET
            plays = EXCLUDED.plays,
            epa_per_play = EXCLUDED.epa_per_play,
            success_rate = EXCLUDED.success_rate,
            rank = EXCLUDED.rank,
            percentile = EXCLUDED.percentile,
            insufficient_sample = EXCLUDED.insufficient_sample,
            updated_at = now()
        """
    ).format(
        filtered_select=filtered_select,
        group_col=group_col,
        predicate=predicate,
        garbage=GARBAGE_PLAY_PREDICATE,
        metric=metric,
        season_min=season_min,
        phase_literal=phase_literal,
    )
