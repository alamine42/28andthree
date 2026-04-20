"""E5-08b: nfl4th 4th-down model wrapper.

Per the decision doc at
`docs/solutions/architecture/nfl4th-rpy2-vs-python-port-decision.md`, we
ship behind the Python port. If the upstream package isn't installed
(build or dev machine without the dep), or the env-flag `DISABLE_NFL4TH=1`
is set, the ETL skips the scoring step and the weekly rollups carry an
empty `fourth_down_decisions` array. The /coaching page then shows a
"Model pending" callout — same UX as a deliberate disable.

E5-08c feature toggle is the env var; E5-08b is this wrapper.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from dataclasses import dataclass

import polars as pl


@dataclass(frozen=True, slots=True)
class FourthDownDecision:
    """A single 4th-down decision, model-scored."""
    game_id: str
    play_id: int
    season: int
    week: int
    team: str
    wp_boost_go: float       # model-predicted WP gain if go-for-it vs. kick
    went_for_it: bool        # coach actually went
    go_recommended: bool     # wp_boost_go > 0
    result_yards: int | None # yards gained on the attempt (None if kicked)


def is_disabled() -> bool:
    return os.getenv("DISABLE_NFL4TH", "").strip() == "1"


def score_fourth_downs(plays_df: pl.DataFrame) -> list[FourthDownDecision]:
    """Score every 4th-down play in `plays_df`.

    Returns `[]` when the port is unavailable OR the disable flag is set —
    callers interpret empty as "model pending" and render accordingly.
    """
    if is_disabled():
        return []
    port = _load_port()
    if port is None:
        return []

    fourth = plays_df.filter(pl.col("down") == 4)
    if fourth.is_empty():
        return []

    out: list[FourthDownDecision] = []
    for row in fourth.iter_rows(named=True):
        # The Python port's API takes a dict-ish record with the usual
        # nflverse fields; we pass through the columns it needs.
        score = port.go_boost(row)
        if score is None:
            continue
        out.append(
            FourthDownDecision(
                game_id=row["game_id"],
                play_id=int(row["play_id"]),
                season=int(row["season"]),
                week=int(row["week"]),
                team=row.get("posteam") or "",
                wp_boost_go=float(score),
                went_for_it=bool(row.get("went_for_it", False)),
                go_recommended=score > 0,
                result_yards=(
                    int(row["yards_gained"]) if row.get("yards_gained") is not None else None
                ),
            )
        )
    return out


# ---- Port loader (guarded import) ------------------------------------------

def _load_port() -> "_PortProtocol | None":
    """Import the Python port only if installed. Return None on any failure."""
    try:
        import py4thdown  # type: ignore[import-not-found]
    except ImportError:
        return None
    return py4thdown  # type: ignore[no-any-return]


class _PortProtocol:  # pragma: no cover — for type docs only
    def go_boost(self, row: dict) -> float | None: ...


# ---- Reference line (pre-computed league averages) -------------------------

def compute_league_reference_line(
    scored_decisions: Sequence[FourthDownDecision],
    buckets: int = 10,
) -> list[dict]:
    """League-average go rate binned by wp_boost_go.

    Review finding #8 resolved by pre-computing a reference curve rather
    than storing league-wide decisions. The UI overlays this as a smooth
    line behind the Pats dots.
    """
    if not scored_decisions:
        return []
    mins = min(d.wp_boost_go for d in scored_decisions)
    maxs = max(d.wp_boost_go for d in scored_decisions)
    if mins == maxs:
        return []
    width = (maxs - mins) / buckets
    buckets_out: list[dict] = []
    for i in range(buckets):
        lo = mins + i * width
        hi = lo + width
        in_bucket = [
            d for d in scored_decisions
            if lo <= d.wp_boost_go < (hi if i < buckets - 1 else hi + 1e-9)
        ]
        if not in_bucket:
            continue
        go_rate = sum(1 for d in in_bucket if d.went_for_it) / len(in_bucket)
        buckets_out.append(
            {
                "wp_boost_lo": lo,
                "wp_boost_hi": hi,
                "go_rate": go_rate,
                "n": len(in_bucket),
            }
        )
    return buckets_out
