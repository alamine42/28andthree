"""Integration tests for etl/transform/phases.py against real Postgres.

Tests the SPEC §3.5a semantics: deterministic tiebreaks, sample-size guards,
idempotency, phase-filter correctness. All tests use small synthetic fixtures
inserted at the start of the test transaction; the rollback on teardown means
no fixture data persists.
"""

from __future__ import annotations

from datetime import date

import psycopg
import pytest

from etl.constants import NFL_TEAMS
from etl.transform.phases import (
    SEASON_MIN_PLAYS,
    WEEKLY_MIN_PLAYS,
    recompute_season,
    recompute_weekly,
)

pytestmark = pytest.mark.integration


# ---- Helpers ----------------------------------------------------------------


def _insert_game(
    conn: psycopg.Connection,
    *,
    game_id: str,
    home: str,
    away: str,
    season: int = 2025,
    week: int = 1,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO games
                (game_id, season, week, season_type, home_team, away_team,
                 home_score, away_score, game_date, completed)
            VALUES (%s, %s, %s, 'REG', %s, %s, 24, 17, %s, true)
            """,
            (game_id, season, week, home, away, date(2025, 9, 7)),
        )


def _insert_synthetic_plays(
    conn: psycopg.Connection,
    *,
    game_id: str,
    posteam: str,
    defteam: str,
    season: int,
    week: int,
    pass_plays: list[float],
    rush_plays: list[float] | None = None,
    redzone: bool = False,
    third_down: bool = False,
) -> None:
    """Insert `len(pass_plays)` dropback plays + optional rush plays.

    Play_ids are derived from the next available id within the game so
    multiple invocations for the same game don't collide on the composite PK.

    `redzone` / `third_down` drive the situational phases. is_redzone and
    is_third_down are GENERATED columns (yardline_100 <= 20, down = 3), so
    they cannot be inserted — these kwargs set the source columns instead.
    Without them the redzone_* and third_down_* phases have no qualifying
    plays and silently produce no rows.
    """
    rush_plays = rush_plays or []
    # Generated: is_redzone = yardline_100 <= 20, is_third_down = down = 3.
    yardline = 10 if redzone else 50
    down = 3 if third_down else 1
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COALESCE(MAX(play_id), 0) FROM plays WHERE game_id = %s",
            (game_id,),
        )
        start = cur.fetchone()[0] + 1

    rows: list[tuple] = []
    play_id = start
    for epa in pass_plays:
        rows.append((
            game_id, play_id, season, week, "REG", posteam, defteam,
            "pass", epa, epa > 0, True, False, False, False, False,
            yardline, down,
        ))
        play_id += 1
    for epa in rush_plays:
        rows.append((
            game_id, play_id, season, week, "REG", posteam, defteam,
            "run", epa, epa > 0, False, False, False, False, True,
            yardline, down,
        ))
        play_id += 1

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO plays
                (game_id, play_id, season, week, season_type, posteam, defteam,
                 play_type, epa, success, qb_dropback, qb_kneel, qb_spike,
                 two_point_attempt, rush_attempt, yardline_100, down)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            rows,
        )


def _fetch_phase_rows(
    conn: psycopg.Connection,
    *,
    phase: str,
    season: int,
    week: int | None = None,
) -> list[dict]:
    with conn.cursor() as cur:
        if week is None:
            cur.execute(
                """
                SELECT team, plays, epa_per_play, rank, percentile, insufficient_sample
                FROM team_phase_season
                WHERE season = %s AND phase = %s
                ORDER BY rank NULLS LAST, team
                """,
                (season, phase),
            )
        else:
            cur.execute(
                """
                SELECT team, plays, epa_per_play, rank, percentile, insufficient_sample
                FROM team_phase_weekly
                WHERE season = %s AND week = %s AND phase = %s
                ORDER BY rank NULLS LAST, team
                """,
                (season, week, phase),
            )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---- Tiebreak + rank semantics ---------------------------------------------


def test_ranks_are_unique_and_contiguous_with_qualifying_teams(
    db_conn: psycopg.Connection,
) -> None:
    # Arrange: 3 teams, different EPA each, all above threshold.
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_game(db_conn, game_id="2025_01_BUF_KC", home="KC", away="BUF")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.5] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.2] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_BUF_KC", posteam="KC", defteam="BUF",
        season=2025, week=1, pass_plays=[0.8] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_BUF_KC", posteam="BUF", defteam="KC",
        season=2025, week=1, pass_plays=[0.1] * 15,
    )

    # Act
    recompute_weekly(db_conn, season=2025, weeks=[1])

    # Assert: KC rank 1, NE rank 2, PIT rank 3, BUF rank 4.
    rows = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    team_to_rank = {r["team"]: r["rank"] for r in rows}
    assert team_to_rank["KC"] == 1
    assert team_to_rank["NE"] == 2
    assert team_to_rank["PIT"] == 3
    assert team_to_rank["BUF"] == 4


def test_tiebreak_prefers_more_plays_when_EPA_is_identical(
    db_conn: psycopg.Connection,
) -> None:
    # Arrange: two teams with same EPA, NE has more plays.
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.3] * 25,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.3] * 15,
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    team_to_rank = {r["team"]: r["rank"] for r in rows}
    # NE more plays (25 > 15) → NE rank 1.
    assert team_to_rank["NE"] == 1
    assert team_to_rank["PIT"] == 2


def test_tiebreak_falls_through_to_team_alphabetical_when_all_else_equal(
    db_conn: psycopg.Connection,
) -> None:
    # Arrange: ARI and ATL with identical EPA, plays, success rate.
    _insert_game(db_conn, game_id="2025_01_ARI_ATL", home="ATL", away="ARI")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_ARI_ATL", posteam="ARI", defteam="ATL",
        season=2025, week=1, pass_plays=[0.2] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_ARI_ATL", posteam="ATL", defteam="ARI",
        season=2025, week=1, pass_plays=[0.2] * 15,
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    team_to_rank = {r["team"]: r["rank"] for r in rows}
    assert team_to_rank["ARI"] == 1
    assert team_to_rank["ATL"] == 2


# ---- Sample-size guards ----------------------------------------------------


def test_team_with_plays_below_weekly_threshold_gets_null_rank(
    db_conn: psycopg.Connection,
) -> None:
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.5] * 15,
    )
    # PIT gets only 5 dropbacks — below WEEKLY_MIN_PLAYS (10).
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.3] * 5,
    )
    assert WEEKLY_MIN_PLAYS == 10  # guard against threshold drift

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    pit = next(r for r in rows if r["team"] == "PIT")
    assert pit["rank"] is None
    assert pit["insufficient_sample"] is True
    assert pit["epa_per_play"] is None


def test_team_below_threshold_does_not_count_in_K_for_percentile(
    db_conn: psycopg.Connection,
) -> None:
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.5] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.3] * 5,  # insufficient
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    ne = next(r for r in rows if r["team"] == "NE")
    # Only 1 qualifying team → rank 1 / K=1 → percentile 1.0.
    assert ne["rank"] == 1
    assert ne["percentile"] == pytest.approx(1.0)


def test_season_threshold_differs_from_weekly(
    db_conn: psycopg.Connection,
) -> None:
    # Season rollup uses plays < 30. 25 plays should be insufficient for season
    # but sufficient for weekly (plays >= 10).
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.5] * 25,
    )
    assert SEASON_MIN_PLAYS == 30

    recompute_weekly(db_conn, season=2025, weeks=[1])
    recompute_season(db_conn, season=2025)

    weekly = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    seasonal = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025)

    ne_weekly = next(r for r in weekly if r["team"] == "NE")
    ne_seasonal = next(r for r in seasonal if r["team"] == "NE")

    assert ne_weekly["insufficient_sample"] is False
    assert ne_seasonal["insufficient_sample"] is True
    assert ne_seasonal["rank"] is None


# ---- Idempotency -----------------------------------------------------------


def test_running_aggregation_twice_yields_identical_ranks(
    db_conn: psycopg.Connection,
) -> None:
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.5] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.2] * 15,
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])
    first = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)

    recompute_weekly(db_conn, season=2025, weeks=[1])
    second = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)

    assert len(first) == len(second)
    first_map = {r["team"]: r["rank"] for r in first}
    second_map = {r["team"]: r["rank"] for r in second}
    assert first_map == second_map


# ---- Phase filter correctness ---------------------------------------------


def test_kneel_plays_are_excluded_from_rush_offense(
    db_conn: psycopg.Connection,
) -> None:
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    # Insert 10 legit NE runs + 5 NE kneels. Kneels should not count.
    with db_conn.cursor() as cur:
        rows = []
        for i in range(10):
            rows.append((
                "2025_01_NE_PIT", i + 1, 2025, 1, "REG", "NE", "PIT",
                "run", 0.3, True, False, False, False, False, True,
            ))
        for i in range(5):
            rows.append((
                "2025_01_NE_PIT", 100 + i, 2025, 1, "REG", "NE", "PIT",
                "qb_kneel", -0.5, False, False, True, False, False, False,
            ))
        cur.executemany(
            """
            INSERT INTO plays
                (game_id, play_id, season, week, season_type, posteam, defteam,
                 play_type, epa, success, qb_dropback, qb_kneel, qb_spike,
                 two_point_attempt, rush_attempt)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            rows,
        )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows_out = _fetch_phase_rows(db_conn, phase="rush_offense", season=2025, week=1)
    ne = next(r for r in rows_out if r["team"] == "NE")
    assert ne["plays"] == 10  # kneels excluded; only the 10 legitimate runs count


def test_nfl_teams_constant_matches_db_expectations() -> None:
    # Guard against the Python constant drifting from the schema's implicit
    # 32-team expectation.
    assert len(NFL_TEAMS) == 32


# ---- Rank direction (bd patsbythenumbers-78e) -------------------------------
#
# Every phase shared one DESC sort until 2026-08-26, which handed rank 1 to the
# WORST defense in the league. The existing rank tests all used pass_offense,
# where DESC happens to be correct, so nothing failed. These cover the other
# side of the ball.


def test_defensive_rank_1_goes_to_the_lowest_epa_allowed(
    db_conn: psycopg.Connection,
) -> None:
    # Arrange: PIT's defense allows 0.5/play, NE's allows 0.2, KC's allows 0.8.
    # Lower allowed = better defense, so NE must rank 1 and KC last.
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_game(db_conn, game_id="2025_01_BUF_KC", home="KC", away="BUF")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.5] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.2] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_BUF_KC", posteam="BUF", defteam="KC",
        season=2025, week=1, pass_plays=[0.8] * 15,
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows = _fetch_phase_rows(db_conn, phase="pass_defense", season=2025, week=1)
    team_to_rank = {r["team"]: r["rank"] for r in rows}
    # NE allowed 0.2 — the stingiest — so NE is the best pass defense.
    assert team_to_rank["NE"] == 1, "rank 1 must be the LOWEST EPA allowed"
    assert team_to_rank["PIT"] == 2
    assert team_to_rank["KC"] == 3, "the most generous defense must rank last"


def test_every_defensive_phase_ranks_best_defense_first(
    db_conn: psycopg.Connection,
) -> None:
    # Guard the whole class, not just pass_defense. Each defensive phase gets
    # two teams; the one allowing less must rank 1 in every one of them.
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    # NE's defense faces PIT: stingy. PIT's defense faces NE: generous.
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[-0.3] * 20, rush_plays=[-0.3] * 20,
        redzone=True, third_down=True,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.4] * 20, rush_plays=[0.4] * 20,
        redzone=True, third_down=True,
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    for phase in (
        "pass_defense",
        "run_defense",
        "redzone_defense",
        "third_down_defense",
    ):
        rows = _fetch_phase_rows(db_conn, phase=phase, season=2025, week=1)
        ranked = {r["team"]: r["rank"] for r in rows if r["rank"] is not None}
        if not ranked:
            continue
        best = min(ranked, key=lambda t: ranked[t])
        by_epa = {r["team"]: r["epa_per_play"] for r in rows}
        assert best == "NE", (
            f"{phase}: rank 1 went to {best} "
            f"(NE allowed {by_epa.get('NE')}, PIT allowed {by_epa.get('PIT')})"
        )


def test_offensive_rank_direction_is_unchanged(
    db_conn: psycopg.Connection,
) -> None:
    # The fix must not flip the side that was already correct.
    _insert_game(db_conn, game_id="2025_01_NE_PIT", home="PIT", away="NE")
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="NE", defteam="PIT",
        season=2025, week=1, pass_plays=[0.6] * 15,
    )
    _insert_synthetic_plays(
        db_conn, game_id="2025_01_NE_PIT", posteam="PIT", defteam="NE",
        season=2025, week=1, pass_plays=[0.1] * 15,
    )

    recompute_weekly(db_conn, season=2025, weeks=[1])

    rows = _fetch_phase_rows(db_conn, phase="pass_offense", season=2025, week=1)
    team_to_rank = {r["team"]: r["rank"] for r in rows}
    assert team_to_rank["NE"] == 1, "higher offensive EPA must still rank first"
    assert team_to_rank["PIT"] == 2
