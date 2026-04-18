"""Unit tests for etl/ingest/nflverse.py pure transform functions.

The fetch_* functions hit the network and aren't covered here — they're
exercised end-to-end by the backfill integration test (E2-10).
"""

from __future__ import annotations

from datetime import date

import polars as pl
import pytest

from etl.ingest.nflverse import (
    normalize_games,
    normalize_plays,
    required_play_columns,
)


# ---- Fixtures ---------------------------------------------------------------

@pytest.fixture
def schedule_frame() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "game_id": ["2025_01_NE_PIT", "2025_01_BUF_KC"],
            "season": [2025, 2025],
            "week": [1, 1],
            "season_type": ["REG", "REG"],
            "home_team": ["PIT", "KC"],
            "away_team": ["NE", "BUF"],
            "home_score": [21, 28],
            "away_score": [10, 24],
            "gameday": ["2025-09-07", "2025-09-07"],
        }
    )


@pytest.fixture
def pbp_frame() -> pl.DataFrame:
    # Carefully-crafted 6-play fixture covering pass, rush, kneel, punt,
    # null-yardline kickoff, and a WSH row for normalization.
    return pl.DataFrame(
        {
            "game_id": [
                "2025_01_NE_PIT",
                "2025_01_NE_PIT",
                "2025_01_NE_PIT",
                "2025_01_NE_PIT",
                "2025_01_NE_PIT",
                "2025_01_WSH_NYG",
            ],
            "play_id": [39, 62, 80, 101, 1, 42],
            "season": [2025, 2025, 2025, 2025, 2025, 2025],
            "week": [1, 1, 1, 1, 1, 1],
            "season_type": ["REG", "REG", "REG", "REG", "REG", "REG"],
            "posteam": ["NE", "NE", "NE", "NE", None, "WSH"],  # null on kickoff
            "defteam": ["PIT", "PIT", "PIT", "PIT", "PIT", "NYG"],
            "down": [1, 2, 3, 4, None, 1],
            "ydstogo": [10, 7, 3, 1, None, 10],
            "yardline_100": [75, 68, 65, 65, None, 50],
            "play_type": ["pass", "run", "qb_kneel", "punt", "kickoff", "pass"],
            "yards_gained": [7, 3, -1, 0, 0, 22],
            "epa": [0.14, -0.08, -1.2, -0.3, 0.0, 0.88],
            "cpoe": [5.2, None, None, None, None, -3.1],
            "success": [True, False, False, False, False, True],
            "wp": [0.5, 0.52, 0.48, 0.45, 0.5, 0.55],
            "qb_dropback": [True, False, False, False, False, True],
            "qb_kneel": [False, False, True, False, False, False],
            "qb_spike": [False, False, False, False, False, False],
            "two_point_attempt": [False, False, False, False, False, False],
            "pass_attempt": [True, False, False, False, False, True],
            "rush_attempt": [False, True, False, False, False, False],
            "pass_length": ["short", None, None, None, None, "deep"],
            "air_yards": [8, None, None, None, None, 25],
            "special_teams_play": [False, False, False, True, True, False],
            "qb_hit": [False, False, False, False, False, True],
            "sack": [False, False, False, False, False, False],
            "was_pressure": [False, False, False, False, False, True],
            "number_of_pass_rushers": [4, None, None, None, None, 6],
            "shotgun": [True, False, False, False, False, True],
            "no_huddle": [False, False, False, False, False, True],
            "pre_snap_motion": [False, True, False, False, False, True],
            "play_action": [False, False, False, False, False, True],
            "offense_personnel": ["11", "12", None, None, None, "11"],
            "defense_personnel": ["4-2-5", "4-2-5", None, None, None, "3-3-5"],
            "defenders_in_box": [6, 7, None, None, None, 6],
            "score_differential": [0, 0, 0, 0, 0, -3],
            "game_seconds_remaining": [3600, 3555, 3500, 3475, 1800, 1200],
            "posteam_timeouts_remaining": [3, 3, 3, 3, 3, 2],
            "defteam_timeouts_remaining": [3, 3, 3, 3, 3, 3],
            "roof": ["outdoors", "outdoors", "outdoors", "outdoors", "dome", "dome"],
            "surface": ["grass", "grass", "grass", "grass", "fieldturf", "fieldturf"],
        }
    )


# ---- normalize_games --------------------------------------------------------

def test_normalize_games_yields_one_row_per_game(schedule_frame: pl.DataFrame) -> None:
    rows = normalize_games(schedule_frame)
    assert len(rows) == 2


def test_normalize_games_preserves_game_id(schedule_frame: pl.DataFrame) -> None:
    rows = normalize_games(schedule_frame)
    ids = {r.game_id for r in rows}
    assert ids == {"2025_01_NE_PIT", "2025_01_BUF_KC"}


def test_normalize_games_parses_gameday_to_date(schedule_frame: pl.DataFrame) -> None:
    rows = normalize_games(schedule_frame)
    assert rows[0].game_date == date(2025, 9, 7)


def test_normalize_games_marks_completed_when_scores_present(
    schedule_frame: pl.DataFrame,
) -> None:
    rows = normalize_games(schedule_frame)
    assert all(r.completed for r in rows)


def test_normalize_games_marks_incomplete_when_scores_null() -> None:
    df = pl.DataFrame(
        {
            "game_id": ["2026_01_NE_PIT"],
            "season": [2026],
            "week": [1],
            "season_type": ["REG"],
            "home_team": ["PIT"],
            "away_team": ["NE"],
            "home_score": [None],
            "away_score": [None],
            "gameday": ["2026-09-06"],
        }
    )
    rows = normalize_games(df)
    assert rows[0].completed is False


# ---- normalize_plays --------------------------------------------------------

def test_normalize_plays_yields_one_row_per_play(pbp_frame: pl.DataFrame) -> None:
    rows = normalize_plays(pbp_frame)
    assert len(rows) == 6


def test_normalize_plays_remaps_WSH_to_WAS(pbp_frame: pl.DataFrame) -> None:
    rows = normalize_plays(pbp_frame)
    wsh_row = next(r for r in rows if r.game_id == "2025_01_WSH_NYG")
    assert wsh_row.posteam == "WAS"


def test_normalize_plays_preserves_null_posteam_on_kickoff(pbp_frame: pl.DataFrame) -> None:
    rows = normalize_plays(pbp_frame)
    kickoff = next(r for r in rows if r.play_type == "kickoff")
    assert kickoff.posteam is None


def test_normalize_plays_sets_is_explosive_pass_for_pass_over_20_yards(
    pbp_frame: pl.DataFrame,
) -> None:
    # The WSH pass gained 22 yards.
    rows = normalize_plays(pbp_frame)
    wsh = next(r for r in rows if r.game_id == "2025_01_WSH_NYG")
    assert wsh.is_explosive_pass is True


def test_normalize_plays_does_not_set_is_explosive_pass_for_short_pass(
    pbp_frame: pl.DataFrame,
) -> None:
    # The NE play_id=39 pass gained 7 yards.
    rows = normalize_plays(pbp_frame)
    short = next(r for r in rows if r.game_id == "2025_01_NE_PIT" and r.play_id == 39)
    assert short.is_explosive_pass is False


def test_normalize_plays_does_not_set_is_explosive_run_for_short_rush(
    pbp_frame: pl.DataFrame,
) -> None:
    rows = normalize_plays(pbp_frame)
    run = next(r for r in rows if r.game_id == "2025_01_NE_PIT" and r.play_id == 62)
    assert run.is_explosive_run is False


def test_normalize_plays_preserves_kneel_row(pbp_frame: pl.DataFrame) -> None:
    # We store kneels; the phase-aggregation SQL filters them out.
    rows = normalize_plays(pbp_frame)
    kneel = next(r for r in rows if r.play_id == 80)
    assert kneel.qb_kneel is True


def test_normalize_plays_renames_personnel_columns() -> None:
    # nflverse calls them offense_personnel / defense_personnel;
    # our schema uses personnel_offense / personnel_defense.
    df = pl.DataFrame(
        {
            "game_id": ["2025_01_NE_PIT"],
            "play_id": [1],
            "season": [2025],
            "week": [1],
            "season_type": ["REG"],
            "posteam": ["NE"],
            "defteam": ["PIT"],
            "offense_personnel": ["11"],
            "defense_personnel": ["4-2-5"],
        }
    )
    rows = normalize_plays(df)
    assert rows[0].personnel_offense == "11"
    assert rows[0].personnel_defense == "4-2-5"


def test_required_play_columns_includes_pk() -> None:
    assert "game_id" in required_play_columns()
    assert "play_id" in required_play_columns()


def test_required_play_columns_includes_grouping_fields() -> None:
    required = required_play_columns()
    assert "posteam" in required
    assert "defteam" in required
    assert "season_type" in required
