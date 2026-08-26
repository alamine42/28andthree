"""Phase aggregation into team_phase_weekly and team_phase_season.

Filter definitions live in docs/phase-definitions.md (versioned contract).
Rank + tiebreak semantics come from SPEC §3.5a.

Three metric kinds:
  - 'epa':         AVG(epa) over plays matching <phase_filter>, grouped by
                   <posteam|defteam>. Majority of phases.
  - 'rate':        AVG(is_explosive_pass OR is_explosive_run as 1/0). For
                   explosive_offense + explosive_defense.
  - 'differential': offensive AVG(epa) - defensive AVG(epa allowed), per
                   (team, season[, week]). For `overall` per SPEC §3.2 #12.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import psycopg
from psycopg import sql

from etl.constants import PHASES

MetricKind = Literal["epa", "rate", "differential"]
Granularity = Literal["weekly", "season"]
RankDirection = Literal["asc", "desc"]

# Sample-size thresholds per SPEC §3.5a.
WEEKLY_MIN_PLAYS = 10
SEASON_MIN_PLAYS = 30


@dataclass(frozen=True)
class PhaseFilter:
    """One row per phase in docs/phase-definitions.md §2."""

    predicate: str        # raw SQL predicate on `plays`
    group_by: str         # 'posteam' or 'defteam' (ignored for 'differential')
    metric: MetricKind
    # Which end of the metric is rank 1. 'desc' = higher is better (offense
    # scores EPA, special teams, the overall differential). 'asc' = lower is
    # better (defensive rows store EPA *allowed*, and explosive_defense stores
    # the rate of explosive plays *allowed*).
    #
    # This is not cosmetic. Until 2026-08-26 every phase shared one DESC sort,
    # which handed rank 1 to the WORST defense in the league: 2022 pass defense
    # ranked CHI (+0.19 allowed) first and PHI (-0.10 allowed) 32nd. The
    # Patriots' 2021 red-zone defense was the best in the NFL and the site
    # called it 32nd. See bd patsbythenumbers-78e.
    rank_direction: RankDirection = "desc"


PHASE_FILTERS: dict[str, PhaseFilter] = {
    "pass_offense":        PhaseFilter("qb_dropback = true", "posteam", "epa", "desc"),
    "rush_offense":        PhaseFilter("rush_attempt = true", "posteam", "epa", "desc"),
    # `overall` (E3-16): team EPA differential. predicate scopes the plays that
    # count toward either side; group_by is unused (built differently). Higher
    # differential is genuinely better, so this one stays 'desc'.
    "overall":             PhaseFilter("(qb_dropback = true OR rush_attempt = true)", "posteam", "differential", "desc"),
    "pass_defense":        PhaseFilter("qb_dropback = true", "defteam", "epa", "asc"),
    "run_defense":         PhaseFilter("rush_attempt = true", "defteam", "epa", "asc"),
    "redzone_offense":     PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_redzone = true", "posteam", "epa", "desc"),
    "redzone_defense":     PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_redzone = true", "defteam", "epa", "asc"),
    "third_down_offense":  PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_third_down = true", "posteam", "epa", "desc"),
    "third_down_defense":  PhaseFilter("(qb_dropback = true OR rush_attempt = true) AND is_third_down = true", "defteam", "epa", "asc"),
    "explosive_offense":   PhaseFilter("(qb_dropback = true OR rush_attempt = true)", "posteam", "rate", "desc"),
    "explosive_defense":   PhaseFilter("(qb_dropback = true OR rush_attempt = true)", "defteam", "rate", "asc"),
    "special_teams":       PhaseFilter("special_teams_play = true", "posteam", "epa", "desc"),
}

# A defteam-grouped phase measures what the team ALLOWED, so lower is always
# better. Pinning the invariant here means a new defensive phase cannot be
# added with the wrong direction.
assert all(
    f.rank_direction == "asc"
    for f in PHASE_FILTERS.values()
    if f.group_by == "defteam"
), "every defteam-grouped phase must rank ascending (lower allowed = better)"

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
    total = 0
    for phase in PHASES:
        filt = PHASE_FILTERS[phase]
        stmt = _build_phase_sql(phase, filt, granularity="weekly", weeks_filter=weeks)
        with conn.cursor() as cur:
            cur.execute(stmt, {"season": season, "weeks": weeks or []})
            total += max(cur.rowcount, 0)
    return total


def recompute_season(conn: psycopg.Connection, *, season: int) -> int:
    total = 0
    for phase in PHASES:
        filt = PHASE_FILTERS[phase]
        stmt = _build_phase_sql(phase, filt, granularity="season")
        with conn.cursor() as cur:
            cur.execute(stmt, {"season": season})
            total += max(cur.rowcount, 0)
    return total


# -----------------------------------------------------------------------------
# SQL builders — two templates. Keep single-side (epa/rate) and differential
# separate; they have materially different CTE shapes. Shared UPSERT tail
# helpers prevent drift between granularities.
# -----------------------------------------------------------------------------

def _build_phase_sql(
    phase: str,
    filt: PhaseFilter,
    *,
    granularity: Granularity,
    weeks_filter: list[int] | None = None,
) -> sql.Composed:
    if filt.metric == "differential":
        return _build_differential_sql(phase, filt, granularity, weeks_filter)
    return _build_single_side_sql(phase, filt, granularity, weeks_filter)


def _granularity_parts(granularity: Granularity, weeks_filter: list[int] | None) -> dict:
    is_weekly = granularity == "weekly"
    return dict(
        target_table=sql.Identifier("team_phase_weekly" if is_weekly else "team_phase_season"),
        partition_cols=sql.SQL("season, week") if is_weekly else sql.SQL("season"),
        group_cols=sql.SQL("team, season, week") if is_weekly else sql.SQL("team, season"),
        threshold=sql.Literal(WEEKLY_MIN_PLAYS if is_weekly else SEASON_MIN_PLAYS),
        week_projection=sql.SQL(", week") if is_weekly else sql.SQL(""),
        week_select=sql.SQL("week,") if is_weekly else sql.SQL(""),
        insert_cols=sql.SQL(
            "(team, season, week, phase, plays, epa_per_play, success_rate, "
            "rank, percentile, insufficient_sample, updated_at)"
        ) if is_weekly else sql.SQL(
            "(team, season, phase, plays, epa_per_play, success_rate, "
            "rank, percentile, insufficient_sample, updated_at)"
        ),
        conflict_cols=(
            sql.SQL("(team, season, week, phase)") if is_weekly
            else sql.SQL("(team, season, phase)")
        ),
        week_filter=(
            sql.SQL("AND week = ANY(%(weeks)s::int[])")
            if (is_weekly and weeks_filter) else sql.SQL("")
        ),
    )


def _build_single_side_sql(
    phase: str,
    filt: PhaseFilter,
    granularity: Granularity,
    weeks_filter: list[int] | None,
) -> sql.Composed:
    parts = _granularity_parts(granularity, weeks_filter)
    group_col = sql.Identifier(filt.group_by)
    predicate = sql.SQL(filt.predicate)
    phase_literal = sql.Literal(phase)

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
        )
        {insert_tail}
        """
    ).format(
        group_col=group_col,
        week_projection=parts["week_projection"],
        extra_projection=extra_projection,
        week_filter=parts["week_filter"],
        predicate=predicate,
        garbage=GARBAGE_PLAY_PREDICATE,
        group_cols=parts["group_cols"],
        metric_expr=metric_expr,
        insert_tail=_insert_tail(phase_literal, parts, filt.rank_direction),
    )


def _build_differential_sql(
    phase: str,
    filt: PhaseFilter,
    granularity: Granularity,
    weeks_filter: list[int] | None,
) -> sql.Composed:
    """EPA differential = avg(epa where posteam=team) - avg(epa where defteam=team).

    Both sides use the same predicate (typically offensive + defensive plays
    counted identically). success_rate is NULL for `overall` rows — a single
    success-rate figure across both sides of the ball isn't a real stat.
    """
    parts = _granularity_parts(granularity, weeks_filter)
    predicate = sql.SQL(filt.predicate)
    phase_literal = sql.Literal(phase)

    return sql.SQL(
        """
        WITH off AS (
            SELECT posteam AS team, season{week_projection},
                   COUNT(*)::int AS off_plays,
                   AVG(epa)::double precision AS off_epa
            FROM plays
            WHERE season = %(season)s
              {week_filter}
              AND {predicate}
              AND {garbage}
              AND posteam IS NOT NULL
            GROUP BY posteam, season{week_projection}
        ),
        def AS (
            SELECT defteam AS team, season{week_projection},
                   COUNT(*)::int AS def_plays,
                   AVG(epa)::double precision AS def_epa
            FROM plays
            WHERE season = %(season)s
              {week_filter}
              AND {predicate}
              AND {garbage}
              AND defteam IS NOT NULL
            GROUP BY defteam, season{week_projection}
        ),
        rollups AS (
            SELECT COALESCE(off.team, def.team) AS team,
                   COALESCE(off.season, def.season) AS season
                   {rollups_week_col},
                   COALESCE(off.off_plays, 0) + COALESCE(def.def_plays, 0) AS plays,
                   (COALESCE(off.off_epa, 0) - COALESCE(def.def_epa, 0))::double precision AS epa_per_play,
                   NULL::double precision AS success_rate
            FROM off
            FULL OUTER JOIN def USING (team, season{week_using})
        )
        {insert_tail}
        """
    ).format(
        week_projection=parts["week_projection"],
        week_filter=parts["week_filter"],
        predicate=predicate,
        garbage=GARBAGE_PLAY_PREDICATE,
        rollups_week_col=sql.SQL(", COALESCE(off.week, def.week) AS week")
            if granularity == "weekly" else sql.SQL(""),
        week_using=sql.SQL(", week") if granularity == "weekly" else sql.SQL(""),
        insert_tail=_insert_tail(phase_literal, parts, filt.rank_direction),
    )


def _insert_tail(
    phase_literal: sql.Literal,
    parts: dict,
    rank_direction: RankDirection = "desc",
) -> sql.Composed:
    """Shared rank + percentile + upsert logic. Same for all phase kinds —
    the differences live upstream in the rollups CTE.

    `rank_direction` drives BOTH the primary metric sort and the success-rate
    tiebreak. SPEC §3.5a phrases tiebreak #2 as "higher success rate", which
    is written from an offensive point of view: on a defensive row
    success_rate is what the opponent achieved, so lower is better there too.
    Flipping only the metric and leaving the tiebreak DESC would silently
    order tied defenses backwards.
    """
    direction = sql.SQL("ASC" if rank_direction == "asc" else "DESC")
    return sql.SQL(
        """
        ,
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
                               ROUND(epa_per_play::numeric, 6) {direction} NULLS LAST,
                               plays DESC,
                               ROUND(success_rate::numeric, 6) {direction} NULLS LAST,
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
        direction=direction,
        threshold=parts["threshold"],
        partition_cols=parts["partition_cols"],
        target_table=parts["target_table"],
        insert_cols=parts["insert_cols"],
        week_select=parts["week_select"],
        phase_literal=phase_literal,
        conflict_cols=parts["conflict_cols"],
    )
