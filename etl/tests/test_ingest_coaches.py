"""Unit tests for etl.ingest.coaches.build_weekly_coaches."""

from __future__ import annotations

from etl.ingest.coaches import Tenure, build_weekly_coaches
from etl.ingest import coaches as mod


def test_should_emit_one_row_per_role_per_week_for_2025_ne():
    # Arrange: 3 roles x 4 weeks = 12 rows expected for NE 2025
    rows = build_weekly_coaches("NE", 2025, weeks=[1, 2, 3, 4])

    # Assert
    assert len(rows) == 12


def test_should_return_empty_list_for_unknown_team_season():
    rows = build_weekly_coaches("ZZZ", 2099, weeks=[1, 2, 3])
    assert rows == []


def test_should_dedupe_duplicate_week_inputs():
    rows = build_weekly_coaches("NE", 2025, weeks=[3, 3, 3])
    # 3 roles x 1 unique week
    assert len(rows) == 3


def test_should_set_coach_identity_fields_per_role():
    rows = build_weekly_coaches("NE", 2025, weeks=[1])
    by_role = {r.role: r for r in rows}
    assert by_role["HC"].coach_name == "Mike Vrabel"
    assert by_role["OC"].coach_name == "Josh McDaniels"
    assert by_role["DC"].coach_name == "Terrell Williams"


def test_should_skip_weeks_outside_tenure_window(monkeypatch):
    # Arrange: override the staff registry with a two-tenure OC split for
    # NE 2025 (weeks 1-9, then weeks 10-18). The §3.5a mid-season change
    # pattern.
    split_staff = (
        Tenure(team="NE", season=2025, role="OC",
               coach_name="Coach A", start_week=1, end_week=9),
        Tenure(team="NE", season=2025, role="OC",
               coach_name="Coach B", start_week=10, end_week=18),
    )
    monkeypatch.setattr(mod, "STAFF", split_staff)

    # Act: ask for weeks 8, 9, 10, 11 — should see A for 8-9 and B for 10-11
    rows = build_weekly_coaches("NE", 2025, weeks=[8, 9, 10, 11])

    # Assert
    names_by_week = {r.week: r.coach_name for r in rows}
    assert names_by_week == {
        8: "Coach A",
        9: "Coach A",
        10: "Coach B",
        11: "Coach B",
    }


def test_should_normalize_and_sort_week_input():
    # Unsorted, duplicated, str-coerced input should still produce sorted
    # unique output.
    rows = build_weekly_coaches("NE", 2025, weeks=[3, 1, 3, 2])
    weeks_for_hc = sorted({r.week for r in rows if r.role == "HC"})
    assert weeks_for_hc == [1, 2, 3]


def test_should_leave_coach_id_none_when_unset_in_tenure():
    rows = build_weekly_coaches("NE", 2025, weeks=[1])
    assert all(r.coach_id is None for r in rows)
