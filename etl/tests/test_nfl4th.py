"""Unit tests for the nfl4th wrapper.

These tests don't require the upstream port to be installed — they verify
the graceful-degradation behavior + the pure-logic reference-line builder.
The output-parity contract test against upstream `nfl4th` (R) lives in
`etl/tests/test_contracts.py` and runs only when the port is installed.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import polars as pl
import pytest

from etl.transform.nfl4th import (
    FourthDownDecision,
    compute_league_reference_line,
    is_disabled,
    score_fourth_downs,
)


@pytest.fixture
def fourth_down_plays() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "game_id": ["2025_01_NE_BUF"] * 3,
            "play_id": [10, 20, 30],
            "season": [2025] * 3,
            "week": [1] * 3,
            "posteam": ["NE", "NE", "NE"],
            "down": [4, 4, 4],
            "ydstogo": [1, 3, 7],
            "yardline_100": [40, 55, 30],
            "game_seconds_remaining": [1800, 900, 600],
            "posteam_timeouts_remaining": [3, 2, 1],
            "defteam_timeouts_remaining": [3, 2, 1],
            "score_differential": [0, -3, 7],
            "yards_gained": [2, 0, 5],
            "went_for_it": [True, False, True],
        }
    )


def test_is_disabled_returns_True_when_env_flag_set() -> None:
    with patch.dict(os.environ, {"DISABLE_NFL4TH": "1"}):
        assert is_disabled() is True


def test_is_disabled_returns_False_when_env_flag_empty() -> None:
    with patch.dict(os.environ, {}, clear=True):
        assert is_disabled() is False


def test_is_disabled_returns_False_when_env_flag_is_0() -> None:
    with patch.dict(os.environ, {"DISABLE_NFL4TH": "0"}):
        assert is_disabled() is False


def test_score_fourth_downs_returns_empty_when_disabled(fourth_down_plays: pl.DataFrame) -> None:
    with patch.dict(os.environ, {"DISABLE_NFL4TH": "1"}):
        result = score_fourth_downs(fourth_down_plays)
    assert result == []


def test_score_fourth_downs_returns_empty_when_port_unavailable(fourth_down_plays: pl.DataFrame) -> None:
    # py4thdown not installed in the test environment → graceful degrade.
    with patch.dict(os.environ, {}, clear=True):
        result = score_fourth_downs(fourth_down_plays)
    assert result == []


def test_score_fourth_downs_returns_empty_when_no_fourth_downs() -> None:
    empty_plays = pl.DataFrame(
        {
            "game_id": ["g"],
            "play_id": [1],
            "season": [2025],
            "week": [1],
            "posteam": ["NE"],
            "down": [3],
            "ydstogo": [10],
            "yardline_100": [50],
            "game_seconds_remaining": [1800],
            "posteam_timeouts_remaining": [3],
            "defteam_timeouts_remaining": [3],
            "score_differential": [0],
            "yards_gained": [5],
            "went_for_it": [False],
        }
    )
    result = score_fourth_downs(empty_plays)
    assert result == []


def test_compute_league_reference_line_returns_empty_on_no_decisions() -> None:
    assert compute_league_reference_line([]) == []


def test_compute_league_reference_line_emits_buckets_by_wp_boost() -> None:
    # Synthetic: 20 decisions spread across wp_boost_go range.
    decisions = [
        FourthDownDecision(
            game_id=f"g-{i}",
            play_id=i,
            season=2024,
            week=1,
            team="NE",
            wp_boost_go=i * 0.01,
            went_for_it=(i % 2 == 0),
            go_recommended=(i * 0.01 > 0),
            result_yards=None,
        )
        for i in range(1, 21)
    ]
    buckets = compute_league_reference_line(decisions, buckets=5)
    assert len(buckets) >= 1
    # Every bucket carries a go_rate in [0, 1] and a non-zero count.
    for b in buckets:
        assert 0.0 <= b["go_rate"] <= 1.0
        assert b["n"] >= 1


def test_compute_league_reference_line_returns_empty_when_all_wp_boost_identical() -> None:
    # Degenerate input: can't bucket.
    decisions = [
        FourthDownDecision(
            game_id="g",
            play_id=i,
            season=2024,
            week=1,
            team="NE",
            wp_boost_go=0.05,
            went_for_it=False,
            go_recommended=True,
            result_yards=None,
        )
        for i in range(5)
    ]
    assert compute_league_reference_line(decisions) == []
