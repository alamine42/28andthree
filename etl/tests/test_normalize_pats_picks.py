"""Unit tests for etl.ingest.drafts.normalize_pats_picks.

Covers the 2021-2025 Pats seed path (E5-03). Input shape matches what
nflreadpy.load_draft_picks actually emits: PFR team codes (`NWE` not
`NE`), `pfr_player_name` as the display-name column.
"""

from __future__ import annotations

import polars as pl

from etl.ingest.drafts import PatsDraftPick, normalize_pats_picks


def _df(rows: list[dict]) -> pl.DataFrame:
    return pl.DataFrame(rows)


def test_should_filter_to_patriots_picks_only():
    df = _df([
        {"season": 2024, "round": 1, "pick": 3, "team": "NWE", "gsis_id": "00-A",
         "position": "QB", "pfr_player_name": "Drake Maye"},
        {"season": 2024, "round": 1, "pick": 2, "team": "WAS", "gsis_id": "00-B",
         "position": "QB", "pfr_player_name": "Jayden Daniels"},
    ])
    picks = normalize_pats_picks(df, seasons=[2024])
    assert len(picks) == 1
    assert picks[0].gsis_id == "00-A"


def test_should_translate_pfr_team_code_nwe_to_canonical_ne():
    # nflreadpy ships PFR codes; our Pats filter must map NWE -> NE before
    # comparing. Regression guard: filter was previously "team == 'NE'"
    # against the raw feed and matched zero rows.
    df = _df([
        {"season": 2023, "round": 2, "pick": 46, "team": "NWE", "gsis_id": "00-E",
         "position": "CB", "pfr_player_name": "Christian Gonzalez"},
    ])
    assert len(normalize_pats_picks(df, seasons=[2023])) == 1


def test_should_keep_only_seasons_in_scope():
    df = _df([
        {"season": 2021, "round": 1, "pick": 15, "team": "NWE", "gsis_id": "00-C",
         "position": "QB", "pfr_player_name": "Mac Jones"},
        {"season": 2019, "round": 2, "pick": 45, "team": "NWE", "gsis_id": "00-D",
         "position": "WR", "pfr_player_name": "N'Keal Harry"},
    ])
    picks = normalize_pats_picks(df, seasons=[2021, 2022, 2023, 2024, 2025])
    assert [p.draft_season for p in picks] == [2021]


def test_should_populate_pick_overall_round_and_position():
    df = _df([
        {"season": 2023, "round": 2, "pick": 46, "team": "NWE", "gsis_id": "00-E",
         "position": "CB", "pfr_player_name": "Christian Gonzalez"},
    ])
    p: PatsDraftPick = normalize_pats_picks(df, seasons=[2023])[0]
    assert (p.pick_overall, p.round, p.position) == (46, 2, "CB")


def test_should_use_pfr_player_name_as_display_label():
    # The nflreadpy feed only has pfr_player_name (no full_name); the
    # normalizer must accept either source.
    df = _df([
        {"season": 2022, "round": 1, "pick": 29, "team": "NWE", "gsis_id": "00-F",
         "position": "G", "pfr_player_name": "Cole Strange"},
    ])
    picks = normalize_pats_picks(df, seasons=[2022])
    assert picks[0].player_name == "Cole Strange"


def test_should_default_round_to_zero_when_missing():
    df = _df([
        {"season": 2025, "round": None, "pick": 260, "team": "NWE",
         "gsis_id": None, "position": None, "pfr_player_name": None},
    ])
    picks = normalize_pats_picks(df, seasons=[2025])
    assert picks[0].round == 0


def test_should_leave_traded_to_null_on_raw_feed():
    # `traded_to` is curator-supplied; normalizer must not guess from the feed.
    df = _df([
        {"season": 2024, "round": 3, "pick": 68, "team": "NWE", "gsis_id": "00-G",
         "position": "DL", "pfr_player_name": "Caedan Wallace"},
    ])
    assert normalize_pats_picks(df, seasons=[2024])[0].traded_to is None


def test_should_return_empty_list_when_no_pats_picks_in_class():
    df = _df([
        {"season": 2020, "round": 1, "pick": 1, "team": "CIN", "gsis_id": "00-X",
         "position": "QB", "pfr_player_name": "Joe Burrow"},
    ])
    assert normalize_pats_picks(df, seasons=[2020]) == []


def test_should_emit_one_output_row_per_input_row_no_dedupe():
    df = _df([
        {"season": 2024, "round": 1, "pick": 3, "team": "NWE", "gsis_id": "00-A",
         "position": "QB", "pfr_player_name": "Drake Maye"},
        {"season": 2024, "round": 2, "pick": 37, "team": "NWE", "gsis_id": "00-H",
         "position": "WR", "pfr_player_name": "Ja'Lynn Polk"},
    ])
    picks = normalize_pats_picks(df, seasons=[2024])
    assert [p.pick_overall for p in picks] == [3, 37]


def test_should_empty_trimmed_strings_to_none_for_optional_fields():
    df = _df([
        {"season": 2024, "round": 1, "pick": 3, "team": "NWE", "gsis_id": "   ",
         "position": "", "pfr_player_name": " Drake Maye "},
    ])
    p = normalize_pats_picks(df, seasons=[2024])[0]
    assert p.gsis_id is None
    assert p.position is None
    assert p.player_name == "Drake Maye"
