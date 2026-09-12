"""Unit-rollup population rules (etl/transform/unit_rollups.py)."""

from __future__ import annotations

import psycopg
import pytest

from etl.transform.unit_rollups import recompute_unit_rollups
from tests.test_phase_aggregation import _insert_game, _insert_synthetic_plays


def _run_stop_rate(conn: psycopg.Connection, table: str, team: str) -> float | None:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT run_stop_rate FROM {table} WHERE team = %s AND season = 2025",  # noqa: S608
            (team,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def test_run_stop_rate_counts_designed_runs_only(db_conn: psycopg.Connection) -> None:
    # bd patsbythenumbers-4zm. 20 designed runs stopped at 1 yard, 10
    # scrambles for 8. With scrambles counted the rate is 20/30; the
    # contract (docs/phase-definitions.md §4) says 20/20.
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[],
        rush_plays=[-0.2] * 20, scramble_plays=[1.0] * 10,
    )
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE plays SET yards_gained = CASE WHEN qb_dropback THEN 8 ELSE 1 END "
            "WHERE game_id = '2025_01_NE_PIT'"
        )

    recompute_unit_rollups(db_conn, season=2025)

    for table in ("team_defense_weekly", "team_defense_season", "team_dl_weekly", "team_dl_season"):
        assert _run_stop_rate(db_conn, table, "NE") == pytest.approx(1.0), table
