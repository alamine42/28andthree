"""Unit tests for etl/constants.py. Pure-Python, no DB required."""

from __future__ import annotations

from etl.constants import (
    NFL_TEAMS,
    PHASES,
    TEAM_ABBREVIATION_ALIAS,
    normalize_team_abbr,
)


def test_phases_has_exactly_twelve_entries() -> None:
    assert len(PHASES) == 12


def test_phases_has_no_duplicates() -> None:
    assert len(set(PHASES)) == len(PHASES)


def test_phases_starts_with_pass_offense() -> None:
    # SPEC §3.2 order: offensive base, defensive base, situational, explosive+ST.
    assert PHASES[0] == "pass_offense"


def test_phases_ends_with_special_teams() -> None:
    assert PHASES[-1] == "special_teams"


def test_nfl_teams_has_exactly_thirty_two_entries() -> None:
    assert len(NFL_TEAMS) == 32


def test_nfl_teams_includes_new_england() -> None:
    assert "NE" in NFL_TEAMS


def test_nfl_teams_uses_LV_not_OAK() -> None:
    assert "LV" in NFL_TEAMS
    assert "OAK" not in NFL_TEAMS


def test_nfl_teams_uses_WAS_not_WSH() -> None:
    assert "WAS" in NFL_TEAMS
    assert "WSH" not in NFL_TEAMS


def test_normalize_team_abbr_maps_WSH_to_WAS() -> None:
    assert normalize_team_abbr("WSH") == "WAS"


def test_normalize_team_abbr_passes_canonical_through() -> None:
    assert normalize_team_abbr("NE") == "NE"
    assert normalize_team_abbr("LV") == "LV"


def test_normalize_team_abbr_returns_None_on_empty_or_null() -> None:
    assert normalize_team_abbr(None) is None
    assert normalize_team_abbr("") is None


def test_normalize_team_abbr_preserves_unknown_values() -> None:
    # Better to let unknowns flow through and be flagged by a contract test
    # than to silently remap them.
    assert normalize_team_abbr("XYZ") == "XYZ"


def test_alias_map_has_no_self_references() -> None:
    # WSH -> WAS is fine; but WSH -> WSH would be a typo we'd want to catch.
    for src, dst in TEAM_ABBREVIATION_ALIAS.items():
        assert src != dst, f"alias {src} maps to itself"
