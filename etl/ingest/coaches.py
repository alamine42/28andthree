"""E5-07 helper: coach identity source.

nflreadpy ships no coach-by-team-week feed, so we maintain a small
hand-curated registry here. Each entry is a tenure — a continuous
(team, season, role, coach) span declared by start_week/end_week.

Adding a new team-season
------------------------
Append a Tenure to STAFF. For mid-season changes, add two tenures with
non-overlapping week ranges (start_week / end_week) for the same
(team, season, role). The aggregator (via build_weekly_coaches below)
emits one WeeklyCoach per in-range week, and the §3.5a segmentation
logic in lib/logic/coach-segments.ts picks up the split automatically.

Coach IDs
---------
We prefer `coach_id` when there's an established identifier
(nflverse / pro-football-reference sometimes use `GM-Name-YYYY` style).
When unknown we fall back to a normalized-name string — good enough
because the TS segmentation logic treats ties by normalized name as
the same tenure (see `computeCoachSegments`).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from etl.transform.coaching_tendencies import WeeklyCoach


@dataclass(frozen=True, slots=True)
class Tenure:
    team: str
    season: int
    role: str  # "HC" | "OC" | "DC"
    coach_name: str
    coach_id: str | None = None
    start_week: int = 1
    end_week: int = 18


# Hand-curated staff registry. Keep entries chronological by (team, season,
# role, start_week) so diffs stay readable.
STAFF: tuple[Tenure, ...] = (
    # 2025 New England — Vrabel hire, McDaniels back as OC, Williams DC.
    Tenure(team="NE", season=2025, role="HC", coach_name="Mike Vrabel"),
    Tenure(team="NE", season=2025, role="OC", coach_name="Josh McDaniels"),
    Tenure(team="NE", season=2025, role="DC", coach_name="Terrell Williams"),
)


def build_weekly_coaches(
    team: str,
    season: int,
    weeks: Iterable[int],
) -> list[WeeklyCoach]:
    """Materialize a (team, season) slice of the staff registry into one
    WeeklyCoach per (role × in-range week). Only emits weeks that fall
    inside a declared tenure window — gaps stay empty.
    """
    weeks_list = sorted(set(int(w) for w in weeks))
    relevant = [t for t in STAFF if t.team == team and t.season == season]
    out: list[WeeklyCoach] = []
    for tenure in relevant:
        for week in weeks_list:
            if week < tenure.start_week or week > tenure.end_week:
                continue
            out.append(
                WeeklyCoach(
                    team=tenure.team,
                    season=tenure.season,
                    week=week,
                    role=tenure.role,
                    coach_id=tenure.coach_id,
                    coach_name=tenure.coach_name,
                )
            )
    return out
