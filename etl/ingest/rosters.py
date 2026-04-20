"""nflverse roster ingest. Feeds the `players` + `roster_snapshots` tables.

Roster data changes shape across seasons — a player can change teams, jersey,
or position. We store both:
  - `players` : one row per gsis_id, "current" metadata (latest season wins).
  - `roster_snapshots` : one row per (gsis_id, season, team), so historical
    pages (2020 QB deep dive) render 2020 jersey + team, not 2025 FA status.

nflreadpy returns roster rows with `gsis_id`, `full_name`, `position`,
`team`, `jersey_number`, `rookie_year`, `headshot_url`, `first_name`,
`last_name`, `season`. Pure transform; network I/O sits in fetch_rosters.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

import polars as pl

from etl.constants import normalize_team_abbr


@dataclass(frozen=True)
class PlayerRow:
    gsis_id: str
    display_name: str
    first_name: str | None
    last_name: str | None
    position: str | None
    current_team: str | None
    current_jersey_number: int | None
    rookie_year: int | None
    headshot_url: str | None


@dataclass(frozen=True)
class RosterSnapshotRow:
    gsis_id: str
    season: int
    team: str
    jersey_number: int | None
    position: str | None
    display_name: str
    headshot_url: str | None


def fetch_rosters(seasons: Iterable[int]) -> pl.DataFrame:
    """Fetch nflverse rosters for the given seasons."""
    import nflreadpy

    return nflreadpy.load_rosters(seasons=tuple(seasons))


def normalize_snapshots(df: pl.DataFrame) -> list[RosterSnapshotRow]:
    """One RosterSnapshotRow per (gsis_id, season, team) in the frame."""
    keep = [
        c for c in ("gsis_id", "season", "team", "jersey_number", "position",
                     "full_name", "headshot_url")
        if c in df.columns
    ]
    if "gsis_id" not in keep:
        return []
    records = df.select(keep).drop_nulls(subset=["gsis_id", "season", "team"]).to_dicts()

    out: list[RosterSnapshotRow] = []
    seen: set[tuple[str, int, str]] = set()
    for r in records:
        gsis_id = r.get("gsis_id")
        # nflverse sometimes emits empty-string or whitespace-only gsis_ids
        # for players without a stable league ID (undrafted signees, etc.).
        # Skip — they'd fail the players FK anyway.
        if not gsis_id or not gsis_id.strip():
            continue
        team = normalize_team_abbr(r.get("team"))
        if team is None:
            continue
        key = (gsis_id, int(r["season"]), team)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            RosterSnapshotRow(
                gsis_id=r["gsis_id"],
                season=int(r["season"]),
                team=team,
                jersey_number=_safe_int(r.get("jersey_number")),
                position=r.get("position"),
                display_name=r.get("full_name") or r["gsis_id"],
                headshot_url=r.get("headshot_url"),
            )
        )
    return out


def normalize_current_players(df: pl.DataFrame) -> list[PlayerRow]:
    """Collapse roster rows to one-per-gsis_id using the most-recent season's
    values. Used to populate the `players` table with current identity."""
    if "gsis_id" not in df.columns:
        return []
    # Sort so the newest-season row is first per player, then take first.
    sorted_df = df.sort("season", descending=True)
    keep = [
        c for c in ("gsis_id", "full_name", "first_name", "last_name",
                     "position", "team", "jersey_number", "rookie_year",
                     "headshot_url")
        if c in sorted_df.columns
    ]
    latest = sorted_df.select(keep).unique(subset=["gsis_id"], keep="first").to_dicts()

    out: list[PlayerRow] = []
    for r in latest:
        gsis_id = r.get("gsis_id")
        if not gsis_id or not gsis_id.strip():
            continue
        out.append(
            PlayerRow(
                gsis_id=r["gsis_id"],
                display_name=r.get("full_name") or r["gsis_id"],
                first_name=r.get("first_name"),
                last_name=r.get("last_name"),
                position=r.get("position"),
                current_team=normalize_team_abbr(r.get("team")),
                current_jersey_number=_safe_int(r.get("jersey_number")),
                rookie_year=_safe_int(r.get("rookie_year")),
                headshot_url=r.get("headshot_url"),
            )
        )
    return out


def _safe_int(v: object) -> int | None:
    if v is None:
        return None
    try:
        # nflverse sometimes emits floats for jersey numbers (NaN for missing).
        if isinstance(v, float) and not (v == v):  # NaN check
            return None
        return int(v)
    except (TypeError, ValueError):
        return None
