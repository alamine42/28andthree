"""Phase aggregation into team_phase_weekly and team_phase_season.

Filter definitions live in docs/phase-definitions.md (versioned contract).
Rank + tiebreak semantics come from SPEC §3.5a.

Structure:
  - PHASE_FILTERS: per-phase SQL predicates + group-by column + metric type.
  - _build_phase_sql: single parameterized aggregation query used for both
    weekly and season granularities; same tiebreak semantics either way.
  - recompute_weekly / recompute_season: loop over phases, execute SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import psycopg
from psycopg import sql

from etl.constants import PHASES

MetricKind = Literal["epa", "rate"]
Granularity = Literal["weekly", "season"]

# Sample-size thresholds per SPEC §3.5a.
WEEKLY_MIN_PLAYS = 10
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
        stmt = _build_phase_sql(phase, filt, granularity="weekly", weeks_filter=weeks)
        with conn.cursor() as cur:
            cur.execute(stmt, {"season": season, "weeks": weeks or []})
            total += max(cur.rowcount, 0)
    return total


def recompute_season(conn: psycopg.Connection, *, season: int) -> int:
    """Recompute team_phase_season for the given season. Returns rows written."""
    total = 0
    for phase in PHASES:
        filt = PHASE_FILTERS[phase]
        stmt = _build_phase_sql(phase, filt, granularity="season")
        with conn.cursor() as cur:
            cur.execute(stmt, {"season": season})
            total += max(cur.rowcount, 0)
    return total


# -----------------------------------------------------------------------------
# SQL builder — one parameterized template drives both granularities.
# -----------------------------------------------------------------------------

def _build_phase_sql(
    phase: str,
    filt: PhaseFilter,
    *,
    granularity: Granularity,
    weeks_filter: list[int] | None = None,
) -> sql.Composed:
    """Return the INSERT…SELECT statement for one (phase, granularity).

    Same CTE pipeline for both weekly and season: filter plays, roll up by
    team + partition, flag insufficient-sample rows, rank with deterministic
    tiebreak, compute percentile. Partition + threshold + target table vary
    with granularity; everything else is shared so the two rollups can't
    drift (SPEC §3.5a).
    """
    is_weekly = granularity == "weekly"

    # Varying parts ------------------------------------------------------------
    target_table = sql.Identifier("team_phase_weekly" if is_weekly else "team_phase_season")
    partition_cols = sql.SQL("season, week") if is_weekly else sql.SQL("season")
    group_cols = sql.SQL("team, season, week") if is_weekly else sql.SQL("team, season")
    threshold = sql.Literal(WEEKLY_MIN_PLAYS if is_weekly else SEASON_MIN_PLAYS)
    week_projection = sql.SQL(", week") if is_weekly else sql.SQL("")
    week_select = sql.SQL("week,") if is_weekly else sql.SQL("")
    insert_cols = sql.SQL(
        "(team, season, week, phase, plays, epa_per_play, success_rate, "
        "rank, percentile, insufficient_sample, updated_at)"
    ) if is_weekly else sql.SQL(
        "(team, season, phase, plays, epa_per_play, success_rate, "
        "rank, percentile, insufficient_sample, updated_at)"
    )
    conflict_cols = sql.SQL("(team, season, week, phase)") if is_weekly else sql.SQL("(team, season, phase)")
    week_filter = (
        sql.SQL("AND week = ANY(%(weeks)s::int[])")
        if (is_weekly and weeks_filter)
        else sql.SQL("")
    )

    # Shared parts -------------------------------------------------------------
    group_col = sql.Identifier(filt.group_by)
    predicate = sql.SQL(filt.predicate)
    phase_literal = sql.Literal(phase)

    # `is_explosive` only needed for rate phases. Project conditionally so the
    # EPA phases don't carry a dead column through the CTE.
    if filt.metric == "rate":
        extra_projection = sql.SQL(
            ", (coalesce(is_explosive_pass, false) OR coalesce(is_explosive_run, false)) AS is_explosive"
        )
        metric_expr = sql.SQL(
            "AVG(CASE WHEN coalesce(is_explosive, false) THEN 1.0 ELSE 0.0 END)::double precision"
        )
    else:
        extra_projection = sql.SQL("")
        metric_expr = sql.SQL("AVG(epa)::double precision")

    return sql.SQL(
        """
        WITH filtered AS (
            SELECT {group_col} AS team, season{week_projection}, epa, success{extra_projection}
            FROM plays
            WHERE season = %(season)s
              {week_filter}
              AND {predicate}
              AND {garbage}
              AND {group_col} IS NOT NULL
        ),
        rollups AS (
            SELECT {group_cols},
                   COUNT(*)::int AS plays,
                   {metric_expr} AS epa_per_play,
                   AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::double precision AS success_rate
            FROM filtered
            GROUP BY {group_cols}
        ),
        flagged AS (
            SELECT *, (plays < {threshold}) AS insufficient_sample
            FROM rollups
        ),
        ranked AS (
            SELECT *,
                   CASE WHEN insufficient_sample THEN NULL::smallint
                        ELSE ROW_NUMBER() OVER (
                             PARTITION BY {partition_cols}
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
            SELECT *, MAX(rank) OVER (PARTITION BY {partition_cols}) AS k
            FROM ranked
        )
        INSERT INTO {target_table} {insert_cols}
        SELECT team, season, {week_select} {phase_literal}::phase_enum, plays,
               CASE WHEN insufficient_sample THEN NULL ELSE epa_per_play END,
               CASE WHEN insufficient_sample THEN NULL ELSE success_rate END,
               rank,
               CASE WHEN rank IS NULL OR k IS NULL OR k = 0 THEN NULL
                    ELSE ((k - rank + 1)::double precision / k::double precision)
               END,
               insufficient_sample,
               now()
        FROM with_k
        ON CONFLICT {conflict_cols} DO UPDATE SET
            plays = EXCLUDED.plays,
            epa_per_play = EXCLUDED.epa_per_play,
            success_rate = EXCLUDED.success_rate,
            rank = EXCLUDED.rank,
            percentile = EXCLUDED.percentile,
            insufficient_sample = EXCLUDED.insufficient_sample,
            updated_at = now()
        """
    ).format(
        group_col=group_col,
        week_projection=week_projection,
        extra_projection=extra_projection,
        week_filter=week_filter,
        predicate=predicate,
        garbage=GARBAGE_PLAY_PREDICATE,
        group_cols=group_cols,
        metric_expr=metric_expr,
        threshold=threshold,
        partition_cols=partition_cols,
        target_table=target_table,
        insert_cols=insert_cols,
        week_select=week_select,
        phase_literal=phase_literal,
        conflict_cols=conflict_cols,
    )
