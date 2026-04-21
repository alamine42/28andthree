"""E5: draft data ingest.

Two concerns:
  - Historical league-wide outcomes 2015-2024, used to fit the slot-EV curve.
    Covers 10 draft classes × ~257 picks ≈ 2,500 rows.
  - Pats picks 2021-current, for ROI evaluation. Seeded from nflreadpy's
    draft picks feed + manual augmentation for trade-out slots (see
    `etl.load.drafts.upsert_draft_picks`).

Career-value metric rules (plan §3.2, review finding #6):
  - PBP-era careers that overlap 2020+ → career_epa from our plays table.
  - Pre-2020 careers → career_seasons as a longevity proxy.

Downstream: `etl.transform.slot_ev` fits the curve and writes into
`draft_expected_value`.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

import nflreadpy as nfl
import polars as pl

from etl.constants import normalize_pfr_team_abbr


@dataclass(frozen=True, slots=True)
class HistoricalDraftOutcome:
    draft_season: int
    pick_overall: int
    gsis_id: str | None
    position: str | None
    team: str | None
    career_epa: float | None
    career_seasons: int | None


@dataclass(frozen=True, slots=True)
class PatsDraftPick:
    draft_season: int
    round: int
    pick_overall: int
    gsis_id: str | None
    position: str | None
    traded_to: str | None
    player_name: str | None


# ---- Historical outcomes (2015-2024) ---------------------------------------

def fetch_draft_picks(seasons: Iterable[int]) -> pl.DataFrame:
    """Wrapper around nflreadpy.load_draft_picks for easy mocking in tests."""
    return nfl.load_draft_picks(seasons=tuple(seasons))


def normalize_historical(
    draft_df: pl.DataFrame,
    career_epa_by_gsis: dict[str, float],
    career_seasons_by_gsis: dict[str, int],
) -> list[HistoricalDraftOutcome]:
    """Build one HistoricalDraftOutcome per (season, pick_overall).

    `career_epa_by_gsis` comes from aggregating our plays table.
    `career_seasons_by_gsis` comes from nflreadpy roster history.
    """
    out: list[HistoricalDraftOutcome] = []
    needed = {"season", "pick", "gsis_id", "position", "team"}
    missing = needed - set(draft_df.columns)
    if missing:
        msg = f"draft df missing columns: {missing}"
        raise ValueError(msg)

    for row in draft_df.iter_rows(named=True):
        gsis = _nullable_str(row.get("gsis_id"))
        out.append(
            HistoricalDraftOutcome(
                draft_season=int(row["season"]),
                pick_overall=int(row["pick"]),
                gsis_id=gsis,
                position=_nullable_str(row.get("position")),
                team=normalize_pfr_team_abbr(_nullable_str(row.get("team"))),
                career_epa=career_epa_by_gsis.get(gsis) if gsis else None,
                career_seasons=career_seasons_by_gsis.get(gsis) if gsis else None,
            )
        )

    # Dedupe on (season, pick_overall) keeping the most recent row — rare,
    # but nflverse occasionally emits multi-row slots for forfeited picks.
    by_key: dict[tuple[int, int], HistoricalDraftOutcome] = {}
    for o in out:
        by_key[(o.draft_season, o.pick_overall)] = o
    return list(by_key.values())


# ---- Pats picks (2021+) -----------------------------------------------------

def normalize_pats_picks(
    draft_df: pl.DataFrame,
    seasons: Sequence[int],
) -> list[PatsDraftPick]:
    """Filter the league-wide draft feed to picks the Pats made (or traded).

    `team` column in nflreadpy is the team that USED the pick post-trade; we
    additionally want the "original" slots the Pats held so ROI can reflect
    traded-away assets. Handling trade-out annotations is curator work.

    nflreadpy.load_draft_picks ships PFR team codes ("NWE", "NOR", ...) rather
    than nflfastR's PBP codes ("NE", "NO", ...) — we normalize both the
    filter and the stored value so downstream joins line up.
    """
    out: list[PatsDraftPick] = []
    for row in draft_df.iter_rows(named=True):
        season = int(row["season"]) if row.get("season") is not None else None
        if season is None or season not in seasons:
            continue
        team = normalize_pfr_team_abbr(_nullable_str(row.get("team")))
        if team != "NE":
            continue
        out.append(
            PatsDraftPick(
                draft_season=season,
                round=int(row["round"]) if row.get("round") is not None else 0,
                pick_overall=int(row["pick"]),
                gsis_id=_nullable_str(row.get("gsis_id")),
                position=_nullable_str(row.get("position")),
                traded_to=None,
                player_name=_nullable_str(row.get("full_name") or row.get("pfr_player_name")),
            )
        )
    return out


def _nullable_str(value: object) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None
