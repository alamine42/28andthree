"""Shared constants mirrored from lib/constants/{phases,teams}.ts.

Kept in sync by the E2-00b CI check (etl/tests/test_schema_sync.py) which
diffs the Python tuples against the canonical TS lists.
"""

from __future__ import annotations

PHASES: tuple[str, ...] = (
    "pass_offense",
    "rush_offense",
    # `overall` replaced `overall_offense` in E3-16 — now the team EPA
    # differential (offensive EPA/play - defensive EPA/play allowed) per
    # SPEC §3.2 #12, not an offensive-plays-only rollup.
    "overall",
    "pass_defense",
    "run_defense",
    "redzone_offense",
    "redzone_defense",
    "third_down_offense",
    "third_down_defense",
    "explosive_offense",
    "explosive_defense",
    "special_teams",
)

NFL_TEAMS: tuple[str, ...] = (
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB",  "HOU", "IND", "JAX", "KC",
    "LAC", "LAR", "LV",  "MIA", "MIN", "NE",  "NO",  "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF",  "TB",  "TEN", "WAS",
)

TEAM_ABBREVIATION_ALIAS: dict[str, str] = {
    "WSH": "WAS",
    # nflverse PBP uses bare 'LA' for the Rams in every 2020–2025 season
    # alongside 'LAR'. The Chargers are always 'LAC', so LA→LAR is unambiguous.
    "LA": "LAR",
}


def normalize_team_abbr(abbr: str | None) -> str | None:
    """Canonicalize team abbreviations (WSH -> WAS). Preserves unknowns so
    contract tests can flag them rather than having them silently remapped."""
    if abbr is None or abbr == "":
        return None
    return TEAM_ABBREVIATION_ALIAS.get(abbr, abbr)


# Advisory lock ID used by the ETL txn guard. Random 32-bit int. Stable.
CONCURRENT_ETL_LOCK_ID: int = 8675309
