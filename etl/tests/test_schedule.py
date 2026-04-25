"""bd-8rd.3: contract test against the shared golden-values fixture.

The same fixture (tests/fixtures/schedule-cases.json at the repo root) is
consumed by lib/schedule/phase.test.ts. Both implementations must produce
the same snapshot for every case. Day-deltas are calendar days in
America/New_York.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

import pytest

from etl.schedule import (
    Aggregate,
    PlayoffWeek,
    ScheduleSnapshot,
    derive_phase,
)

# Repo root is two levels above this file: etl/tests/ → etl/ → repo root.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE_PATH = _REPO_ROOT / "tests" / "fixtures" / "schedule-cases.json"


def _load_fixture() -> list[dict]:
    return json.loads(_FIXTURE_PATH.read_text())["cases"]


def _to_aggregate(row: dict) -> Aggregate:
    return Aggregate(
        season=row["season"],
        season_type=row["season_type"],
        first_game=date.fromisoformat(row["first_game"]),
        last_game=date.fromisoformat(row["last_game"]),
        last_week=row["last_week"],
    )


def _to_playoff_week(row: dict) -> PlayoffWeek:
    return PlayoffWeek(
        week=row["week"],
        first_game=date.fromisoformat(row["first_game"]),
        last_game=date.fromisoformat(row["last_game"]),
    )


def _expected(case: dict) -> ScheduleSnapshot:
    e = case["expected"]
    return ScheduleSnapshot(
        phase=e["phase"],
        season=e["season"],
        last_game_date=date.fromisoformat(e["last_game_date"]) if e["last_game_date"] else None,
        days_since_last_game=e["days_since_last_game"],
        next_game_date=date.fromisoformat(e["next_game_date"]) if e["next_game_date"] else None,
        days_until_next_game=e["days_until_next_game"],
        playoff_round=e["playoff_round"],
    )


@pytest.mark.parametrize("case", _load_fixture(), ids=lambda c: c["name"])
def test_derive_phase_matches_golden_values(case: dict) -> None:
    # Arrange
    now = datetime.fromisoformat(case["now_utc"].replace("Z", "+00:00"))
    rows = [_to_aggregate(r) for r in case["input"]["rows"]]
    playoff_weeks = [_to_playoff_week(w) for w in case["input"]["playoff_weeks"]]
    next_game_date = (
        date.fromisoformat(case["input"]["next_game_date"])
        if case["input"]["next_game_date"]
        else None
    )
    last_completed_date = (
        date.fromisoformat(case["input"]["last_completed_date"])
        if case["input"]["last_completed_date"]
        else None
    )

    # Act
    result = derive_phase(
        now=now,
        rows=rows,
        playoff_weeks=playoff_weeks,
        next_game_date=next_game_date,
        last_completed_date=last_completed_date,
    )

    # Assert
    assert result == _expected(case)
