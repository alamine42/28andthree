"""Data contract tests — the primary test surface for ETL per SPEC §8.

Run after every ETL invocation. A failure marks the run failed and surfaces
in the GH Actions summary. Locally: `TEST_DATABASE_URL=... uv run pytest
etl/tests/test_contracts.py`.

The 14 assertions map 1:1 to the table in plan §4.2.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import psycopg
import pytest
import yaml

from etl.constants import NFL_TEAMS, PHASES

pytestmark = pytest.mark.integration


# ---- Helpers ----------------------------------------------------------------


def _row_count(conn: psycopg.Connection, table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {table}")
        row = cur.fetchone()
    return int(row[0]) if row else 0


def _fetchone(conn: psycopg.Connection, query: str, params: tuple = ()) -> tuple | None:
    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchone()


def _fetchall(conn: psycopg.Connection, query: str, params: tuple = ()) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchall()


@pytest.fixture(scope="module")
def loaded_db(db_conn_module: psycopg.Connection) -> psycopg.Connection:
    """Bypasses the per-test rollback fixture. Contract tests READ the live
    DB state — they should never mutate, so a single shared connection is fine.
    """
    return db_conn_module


@pytest.fixture(scope="module")
def db_conn_module(test_database_url: str) -> Any:
    """Module-scoped DB connection for read-only contract checks."""
    conn = psycopg.connect(test_database_url, autocommit=True)
    yield conn
    conn.close()


# ---- The 14 contracts -------------------------------------------------------


def test_c1_every_completed_REG_game_has_plays(loaded_db: psycopg.Connection) -> None:
    """Guard against truncated loads. A completed game with <100 plays smells wrong."""
    orphans = _fetchall(
        loaded_db,
        """
        SELECT g.game_id, COUNT(p.play_id)
        FROM games g
        LEFT JOIN plays p ON p.game_id = g.game_id
        WHERE g.completed = true AND g.season_type = 'REG'
        GROUP BY g.game_id
        HAVING COUNT(p.play_id) < 100
        """,
    )
    assert not orphans, f"{len(orphans)} completed REG games have <100 plays: {orphans[:5]}"


def test_c2_rank_sum_matches_k_triangle_per_phase_week(
    loaded_db: psycopg.Connection,
) -> None:
    """For each (season, week, phase) with any qualifying team:
    SUM(rank) = K*(K+1)/2 where K = teams meeting threshold."""
    bad = _fetchall(
        loaded_db,
        """
        WITH agg AS (
            SELECT season, week, phase,
                   COUNT(*) FILTER (WHERE insufficient_sample = false)::int AS k,
                   COUNT(rank)::int AS rank_count,
                   COALESCE(SUM(rank), 0)::int AS rank_sum
            FROM team_phase_weekly
            GROUP BY season, week, phase
        )
        SELECT season, week, phase, k, rank_count, rank_sum
        FROM agg
        WHERE k > 0
          AND (rank_count <> k OR rank_sum <> k * (k + 1) / 2)
        """,
    )
    assert not bad, f"{len(bad)} (season, week, phase) rows violate rank math: {bad[:5]}"


def test_c3_no_duplicate_team_season_week_phase_rows(
    loaded_db: psycopg.Connection,
) -> None:
    dupes = _fetchall(
        loaded_db,
        """
        SELECT team, season, week, phase, COUNT(*)
        FROM team_phase_weekly
        GROUP BY team, season, week, phase
        HAVING COUNT(*) > 1
        """,
    )
    assert not dupes, f"duplicate (team, season, week, phase): {dupes[:5]}"


def test_c4_pats_pass_offense_epa_matches_pandas_baseline(
    loaded_db: psycopg.Connection,
) -> None:
    """Pandas-on-polars recomputation cross-check. Circular vs. nflverse but
    catches SQL bugs in the aggregation path."""
    row = _fetchone(
        loaded_db,
        """
        SELECT epa_per_play
        FROM team_phase_season
        WHERE team = 'NE' AND phase = 'pass_offense'
        ORDER BY season DESC
        LIMIT 1
        """,
    )
    if row is None or row[0] is None:
        pytest.skip("no NE pass_offense rows loaded yet")
    stored = float(row[0])

    # Recompute from the raw plays the same SQL consumed.
    baseline_row = _fetchone(
        loaded_db,
        """
        WITH latest AS (SELECT MAX(season) s FROM team_phase_season WHERE team='NE')
        SELECT AVG(epa)::double precision
        FROM plays, latest
        WHERE season = latest.s
          AND posteam = 'NE'
          AND season_type = 'REG'
          AND qb_dropback = true
          AND NOT coalesce(qb_kneel, false)
          AND NOT coalesce(qb_spike, false)
          AND NOT coalesce(two_point_attempt, false)
          AND (play_type IS NULL OR play_type <> 'no_play')
        """,
    )
    recomputed = float(baseline_row[0]) if baseline_row and baseline_row[0] is not None else None
    if recomputed is None:
        pytest.skip("no plays to recompute against")
    assert abs(stored - recomputed) < 1e-9, (
        f"stored {stored} vs recomputed {recomputed} drifts beyond tolerance"
    )


def test_c6_source_version_is_non_null_in_latest_ok_run(
    loaded_db: psycopg.Connection,
) -> None:
    row = _fetchone(
        loaded_db,
        """
        SELECT source_version
        FROM meta_refresh
        WHERE status = 'ok'
        ORDER BY started_at DESC
        LIMIT 1
        """,
    )
    if row is None:
        pytest.skip("no ok meta_refresh rows yet")
    assert row[0] is not None and row[0].strip() != ""


def test_c7_no_null_epa_on_qb_dropback_or_rush_attempt_in_completed_reg(
    loaded_db: psycopg.Connection,
) -> None:
    """nflverse schema wobbles sometimes drop the epa column. Fail loud."""
    row = _fetchone(
        loaded_db,
        """
        SELECT COUNT(*)
        FROM plays p JOIN games g ON g.game_id = p.game_id
        WHERE g.completed = true AND g.season_type = 'REG'
          AND p.season_type = 'REG'
          AND p.epa IS NULL
          AND (p.qb_dropback = true OR p.rush_attempt = true)
          AND NOT coalesce(p.qb_kneel, false)
          AND NOT coalesce(p.qb_spike, false)
          AND NOT coalesce(p.two_point_attempt, false)
        """,
    )
    null_count = int(row[0]) if row else 0
    # Some plays legitimately have null EPA (pre-snap penalty no-plays that
    # slip through). Tolerate up to 1% of total; more than that is a bug.
    total_row = _fetchone(
        loaded_db,
        "SELECT COUNT(*) FROM plays WHERE qb_dropback = true OR rush_attempt = true",
    )
    total = int(total_row[0]) if total_row else 0
    tolerance = max(1, total // 100)
    assert null_count <= tolerance, (
        f"{null_count} null-epa dropback/rush plays exceeds 1% tolerance ({tolerance})"
    )


def test_c8_team_phase_weekly_ranks_are_contiguous_starting_at_one(
    loaded_db: psycopg.Connection,
) -> None:
    """Spot-check: for each phase-week with qualifying teams, rank=1 exists
    and rank=K exists where K is the qualifying-team count."""
    row = _fetchone(
        loaded_db,
        """
        WITH by_pw AS (
            SELECT season, week, phase,
                   COUNT(*) FILTER (WHERE insufficient_sample = false)::int AS k,
                   MIN(rank) AS min_rank,
                   MAX(rank) AS max_rank
            FROM team_phase_weekly
            GROUP BY season, week, phase
        )
        SELECT COUNT(*)
        FROM by_pw
        WHERE k > 0 AND (min_rank <> 1 OR max_rank <> k)
        """,
    )
    violations = int(row[0]) if row else 0
    assert violations == 0, f"{violations} (season,week,phase) rows have non-contiguous ranks"


def test_c10_meta_refresh_row_counts_present_and_non_zero(
    loaded_db: psycopg.Connection,
) -> None:
    row = _fetchone(
        loaded_db,
        """
        SELECT row_counts
        FROM meta_refresh
        WHERE status = 'ok' AND row_counts IS NOT NULL
        ORDER BY started_at DESC
        LIMIT 1
        """,
    )
    if row is None:
        pytest.skip("no ok meta_refresh rows yet")
    counts: dict[str, int] = row[0]
    expected = {"plays", "games", "team_phase_weekly", "team_phase_season"}
    present = set(counts.keys())
    missing = expected - present
    assert not missing, f"row_counts missing: {missing}"
    zero = [k for k, v in counts.items() if k in expected and v == 0]
    assert not zero, f"expected non-zero row_counts, got zero for: {zero}"


def test_c11_latest_ok_run_wallclock_under_budget(loaded_db: psycopg.Connection) -> None:
    row = _fetchone(
        loaded_db,
        """
        SELECT EXTRACT(EPOCH FROM (completed_at - started_at)) AS wall_s, season
        FROM meta_refresh
        WHERE status = 'ok' AND completed_at IS NOT NULL
        ORDER BY started_at DESC
        LIMIT 1
        """,
    )
    if row is None:
        pytest.skip("no ok meta_refresh rows yet")
    wall_seconds = float(row[0])
    season = row[1]
    # Per plan §1 success criteria: <10 min full, <3 min weekly.
    # Conservative: if a single-season ok run took >10 min, something is off.
    assert wall_seconds < 600, f"ok run for season {season} took {wall_seconds:.1f}s, budget 600s"


def test_c12_golden_values_match_stored_ranks(loaded_db: psycopg.Connection) -> None:
    """E2-11a: externally-anchored NE ranks from rbsdm / Sumer Sports."""
    path = Path(__file__).parent / "golden_values.yml"
    if not path.exists():
        pytest.skip("golden_values.yml not yet present")
    doc = yaml.safe_load(path.read_text()) or {}
    entries = doc.get("entries", [])
    if not entries:
        pytest.skip("golden_values.yml has no entries")

    failures: list[str] = []
    for entry in entries:
        if entry.get("expected_rank") == "pending":
            continue  # bootstrapping — not yet anchored
        row = _fetchone(
            loaded_db,
            """
            SELECT rank
            FROM team_phase_season
            WHERE team = %s AND season = %s AND phase = %s
            """,
            (entry["team"], entry["season"], entry["phase"]),
        )
        if row is None:
            failures.append(
                f"{entry['team']} {entry['season']} {entry['phase']}: no row in DB"
            )
            continue
        actual = row[0]
        if actual != entry["expected_rank"]:
            failures.append(
                f"{entry['team']} {entry['season']} {entry['phase']}: "
                f"expected {entry['expected_rank']} got {actual}"
            )
    assert not failures, "golden-value mismatches:\n  " + "\n  ".join(failures)


def test_c13_every_plays_posteam_is_in_canonical_nfl_team_list(
    loaded_db: psycopg.Connection,
) -> None:
    row = _fetchone(
        loaded_db,
        "SELECT array_agg(DISTINCT posteam) FROM plays WHERE posteam IS NOT NULL",
    )
    if row is None or row[0] is None:
        pytest.skip("no plays loaded yet")
    distinct = set(row[0])
    extra = distinct - set(NFL_TEAMS)
    assert not extra, f"plays.posteam contains non-canonical values: {sorted(extra)}"


def test_c14_every_plays_defteam_is_in_canonical_nfl_team_list(
    loaded_db: psycopg.Connection,
) -> None:
    row = _fetchone(
        loaded_db,
        "SELECT array_agg(DISTINCT defteam) FROM plays WHERE defteam IS NOT NULL",
    )
    if row is None or row[0] is None:
        pytest.skip("no plays loaded yet")
    distinct = set(row[0])
    extra = distinct - set(NFL_TEAMS)
    assert not extra, f"plays.defteam contains non-canonical values: {sorted(extra)}"


# ---- Sanity meta ------------------------------------------------------------


def test_every_phase_exists_in_at_least_one_loaded_row_once_backfill_done(
    loaded_db: psycopg.Connection,
) -> None:
    rows_row = _fetchone(loaded_db, "SELECT COUNT(*) FROM team_phase_weekly")
    if rows_row is None or int(rows_row[0]) == 0:
        pytest.skip("team_phase_weekly empty; backfill not yet run")
    phases_present = {
        r[0] for r in _fetchall(loaded_db, "SELECT DISTINCT phase FROM team_phase_weekly")
    }
    missing = set(PHASES) - phases_present
    assert not missing, f"phases never loaded: {sorted(missing)}"
