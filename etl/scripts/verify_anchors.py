"""Independent check of the golden-value anchors against raw nflverse data.

This script shares NO code with the rest of `etl/`. It reads the nflverse
play-by-play parquet release straight from GitHub, applies the filters in
`docs/phase-definitions.md` with pyarrow, and ranks in plain Python. If its
ranks agree with `etl/tests/golden_values.yml`, the agreement means something.
Re-recording golden values from our own ETL output would not — that is how
bd patsbythenumbers-78e survived four months.

Usage (from the repo root):

    cd etl && uv run python -m etl.scripts.verify_anchors             # every golden season
    cd etl && uv run python -m etl.scripts.verify_anchors 2022 2023   # selected seasons

Parquet files cache in `etl/.cache/pbp/` (about 20 MB per season). Delete a
file to force a fresh download. Exit code 1 on any mismatch.

Why this works when the 2026-09-12 draft hung: the draft called `.read()` on
the whole response with a 180 s socket timeout. This version streams in 1 MB
chunks to a temp file with a 60 s per-chunk timeout, so a stalled transfer
fails loudly instead of sitting forever.
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq
import yaml

URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
)
CACHE = Path(__file__).resolve().parents[1] / ".cache" / "pbp"
GOLDEN = Path(__file__).resolve().parents[1] / "tests" / "golden_values.yml"
COLS = [
    "season_type",
    "posteam",
    "defteam",
    "rush_attempt",
    "qb_dropback",
    "qb_kneel",
    "qb_spike",
    "two_point_attempt",
    "play_type",
    "epa",
]
SEASON_MIN_PLAYS = 30  # docs/phase-definitions.md §3.5a
PHASES = ("pass_offense", "rush_offense", "overall", "pass_defense", "run_defense")


def fetch(season: int) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / f"play_by_play_{season}.parquet"
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    tmp = dest.with_suffix(".part")
    print(f"downloading {season} ...", file=sys.stderr, flush=True)
    with urllib.request.urlopen(URL.format(season=season), timeout=60) as r, tmp.open("wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.rename(dest)
    return dest


def load(season: int) -> tuple[dict, dict[str, list[bool]]]:
    """Apply the global rules (§1): REG only, drop kneels/spikes/2pt/no_play, epa not null."""
    t = pq.read_table(fetch(season), columns=COLS)

    def flag(col: str):
        return pc.fill_null(pc.cast(t[col], "bool"), False)

    keep = pc.equal(t["season_type"], "REG")
    for col in ("qb_kneel", "qb_spike", "two_point_attempt"):
        keep = pc.and_(keep, pc.invert(flag(col)))
    keep = pc.and_(keep, pc.fill_null(pc.not_equal(t["play_type"], "no_play"), True))
    keep = pc.and_(keep, pc.is_valid(t["epa"]))
    d = t.filter(keep).to_pydict()

    drop = [bool(q) for q in d["qb_dropback"]]  # §2.1: dropbacks, scrambles included
    # §2.2: designed runs only. A scramble is rush_attempt AND qb_dropback.
    rush = [bool(r) and not q for r, q in zip(d["rush_attempt"], drop, strict=True)]
    either = [r or q for r, q in zip(rush, drop, strict=True)]  # §2.3
    return d, {"rush": rush, "drop": drop, "either": either}


def average(d: dict, mask: list[bool], col: str) -> dict[str, tuple[float, int]]:
    total: dict[str, float] = {}
    count: dict[str, int] = {}
    for i, keep in enumerate(mask):
        if not keep:
            continue
        team = d[col][i]
        if team is None:
            continue
        total[team] = total.get(team, 0.0) + d["epa"][i]
        count[team] = count.get(team, 0) + 1
    return {k: (total[k] / count[k], count[k]) for k in total if count[k] >= SEASON_MIN_PLAYS}


def rank(avg: dict[str, tuple[float, int]], asc: bool) -> dict[str, int]:
    # SPEC §3.5a: metric rounded to 6 dp, tiebreak on plays DESC.
    sign = 1 if asc else -1
    order = sorted(avg, key=lambda k: (sign * round(avg[k][0], 6), -avg[k][1]))
    return {k: i + 1 for i, k in enumerate(order)}


def season_ranks(season: int) -> dict[str, tuple[dict[str, int], dict[str, tuple[float, int]]]]:
    d, m = load(season)
    po = average(d, m["drop"], "posteam")
    ro = average(d, m["rush"], "posteam")
    pd_ = average(d, m["drop"], "defteam")
    rd = average(d, m["rush"], "defteam")
    oo = average(d, m["either"], "posteam")
    od = average(d, m["either"], "defteam")
    diff = {k: (oo[k][0] - od[k][0], oo[k][1] + od[k][1]) for k in oo if k in od}
    return {
        "pass_offense": (rank(po, asc=False), po),
        "rush_offense": (rank(ro, asc=False), ro),
        "overall": (rank(diff, asc=False), diff),
        "pass_defense": (rank(pd_, asc=True), pd_),
        "run_defense": (rank(rd, asc=True), rd),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("seasons", nargs="*", type=int, help="default: every season in the golden file")
    ap.add_argument("--golden", type=Path, default=GOLDEN)
    args = ap.parse_args()

    entries = yaml.safe_load(args.golden.read_text())["entries"]
    seasons = set(args.seasons) or {e["season"] for e in entries}
    computed = {s: season_ranks(s) for s in sorted(seasons)}

    mismatches = 0
    for e in entries:
        if e["season"] not in seasons or e["phase"] not in PHASES:
            continue
        ranks, avg = computed[e["season"]][e["phase"]]
        team = e["team"]
        got = ranks.get(team)
        metric, n = avg.get(team, (float("nan"), 0))
        ok = got == e["expected_rank"]
        mismatches += not ok
        ext = f" rbsdm={e['rbsdm_rank']:>2}" if "rbsdm_rank" in e else ""
        print(
            f"{'OK  ' if ok else 'DIFF'} {e['season']} {e['phase']:13s} {team} "
            f"golden={e['expected_rank']:>2} nflverse={got!s:>2}{ext} "
            f"metric={metric:+.4f} plays={n} teams={len(ranks)}"
        )
    print(f"\n{mismatches} mismatch(es)")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
