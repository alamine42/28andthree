"""Unit tests for etl.transform.coaching_tendencies.aggregate_tendencies.

Covers the rate-accumulation path (regression guard for the polars 1.x
is_true() removal — see git blame on this file) plus the role-wiring
that maps a set of plays + WeeklyCoach identities into rollup rows.
"""

from __future__ import annotations

import polars as pl

from etl.transform.coaching_tendencies import WeeklyCoach, aggregate_tendencies


def _plays(rows: list[dict]) -> pl.DataFrame:
    # Fill in the minimal column set the aggregator touches. Tests
    # construct only the non-None fields they need; we pad the rest.
    defaults = {
        "season": 2025, "week": 1, "posteam": "NE", "defteam": "BUF",
        "play_type": "pass", "down": 1, "ydstogo": 10,
        "shotgun": False, "no_huddle": False,
        "pre_snap_motion": False, "play_action": False,
        "personnel_offense": "1 RB, 1 TE, 3 WR", "score_differential": 0,
        "game_seconds_remaining": 3000, "number_of_pass_rushers": 4,
    }
    merged = [{**defaults, **r} for r in rows]
    return pl.DataFrame(merged)


def _coach(team: str = "NE", season: int = 2025, week: int = 1, role: str = "OC") -> WeeklyCoach:
    return WeeklyCoach(team=team, season=season, week=week, role=role,
                       coach_id=None, coach_name=f"Coach {role}")


def test_should_emit_one_rollup_per_role_for_a_single_week():
    # Offense plays have posteam=NE; defense plays flip so defteam=NE.
    plays = _plays([
        {"play_type": "pass", "posteam": "NE", "defteam": "BUF"},
        {"play_type": "run", "posteam": "NE", "defteam": "BUF"},
        {"play_type": "pass", "posteam": "BUF", "defteam": "NE"},
    ])
    coaches = [_coach(role="HC"), _coach(role="OC"), _coach(role="DC")]

    rollups = aggregate_tendencies(plays, coaches)

    assert {r.coach_role for r in rollups} == {"HC", "OC", "DC"}


def test_should_compute_shotgun_rate_as_share_of_snaps():
    # 4 plays, 2 shotgun → 0.5
    plays = _plays([
        {"play_type": "pass", "shotgun": True},
        {"play_type": "pass", "shotgun": False},
        {"play_type": "run",  "shotgun": True},
        {"play_type": "run",  "shotgun": False},
    ])
    rollups = aggregate_tendencies(plays, [_coach(role="OC")])

    oc = next(r for r in rollups if r.coach_role == "OC")
    assert oc.shotgun_rate == 0.5


def test_should_compute_pass_rate_by_down_and_distance_bucket():
    # 2 plays on 1st & 0-3 — one pass, one run -> 50%
    plays = _plays([
        {"play_type": "pass", "down": 1, "ydstogo": 2},
        {"play_type": "run",  "down": 1, "ydstogo": 3},
    ])
    rollups = aggregate_tendencies(plays, [_coach(role="OC")])
    oc = next(r for r in rollups if r.coach_role == "OC")
    assert oc.pass_rate_1_short == 0.5


def test_should_compute_blitz_rate_from_6plus_pass_rushers():
    # DC rollup needs defteam=NE.
    plays = _plays([
        {"play_type": "pass", "posteam": "BUF", "defteam": "NE",
         "number_of_pass_rushers": 4},
        {"play_type": "pass", "posteam": "BUF", "defteam": "NE",
         "number_of_pass_rushers": 6},
        {"play_type": "pass", "posteam": "BUF", "defteam": "NE",
         "number_of_pass_rushers": 7},
    ])
    rollups = aggregate_tendencies(plays, [_coach(role="DC")])
    dc = next(r for r in rollups if r.coach_role == "DC")
    assert dc.blitz_rate == 2 / 3


def test_should_skip_weeks_with_no_coach_seeded_even_when_plays_exist():
    # Plays for week 2 exist; coach registry only has week 1.
    plays = _plays([
        {"play_type": "pass", "week": 1},
        {"play_type": "pass", "week": 2},
    ])
    rollups = aggregate_tendencies(plays, [_coach(role="OC", week=1)])
    # Only the week-1 rollup should appear.
    assert [r.week for r in rollups] == [1]


def test_should_handle_empty_plays_dataframe_gracefully():
    plays = pl.DataFrame(schema={c: pl.Utf8 for c in [
        "season", "week", "posteam", "defteam", "play_type"
    ]})
    rollups = aggregate_tendencies(plays, [_coach(role="HC")])
    assert rollups == []


def test_should_yield_none_for_situational_rate_when_column_missing():
    # Regression guard: a plays DF without `shotgun` column shouldn't crash.
    plays = pl.DataFrame([{
        "season": 2025, "week": 1, "posteam": "NE", "defteam": "BUF",
        "play_type": "pass", "down": 1, "ydstogo": 10,
        "play_action": False, "pre_snap_motion": False, "no_huddle": False,
        "personnel_offense": None, "score_differential": 0,
        "game_seconds_remaining": 3000, "number_of_pass_rushers": 4,
    }])
    rollups = aggregate_tendencies(plays, [_coach(role="OC")])
    oc = next(r for r in rollups if r.coach_role == "OC")
    assert oc.shotgun_rate is None
