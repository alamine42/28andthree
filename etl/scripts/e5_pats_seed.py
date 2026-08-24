"""E5-03: seed Pats draft picks 2021-2025 into draft_picks.

One-shot. Pulls the same nflreadpy feed the historical backfill uses,
filters to team == NE, upserts into `draft_picks` via the existing load
helper. Traded-out slot curation is a follow-up (HANDOVER \u00A75) — not in
scope here; this script captures picks Pats *used*.

Usage:
    cd etl
    ETL_DATABASE_URL=<prod> PYTHONPATH=.. \\
        uv run --project . python -m scripts.e5_pats_seed
"""

from __future__ import annotations

import logging
import os
import sys

import psycopg

from etl.ingest.drafts import fetch_draft_picks, normalize_pats_picks
from etl.load.drafts import upsert_draft_picks

SEASONS = (2021, 2022, 2023, 2024, 2025, 2026)

log = logging.getLogger("e5-pats-seed")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    url = os.environ.get("ETL_DATABASE_URL")
    if not url:
        log.error("ETL_DATABASE_URL not set")
        return 2

    log.info("pulling draft picks for seasons %s via nflreadpy", SEASONS)
    df = fetch_draft_picks(SEASONS)
    log.info("raw league-wide picks: %d", df.height)

    picks = normalize_pats_picks(df, seasons=SEASONS)
    log.info("filtered to NE picks: %d", len(picks))

    if not picks:
        log.warning("no Pats picks found — refusing to upsert empty set")
        return 1

    with psycopg.connect(url) as conn:
        n = upsert_draft_picks(conn, picks)
        conn.commit()
        log.info("upserted Pats picks: %d", n)

    # Report a quick per-class summary for the operator
    by_season: dict[int, int] = {}
    for p in picks:
        by_season[p.draft_season] = by_season.get(p.draft_season, 0) + 1
    print("\nSeeded per class:")
    for s in sorted(by_season):
        print(f"  {s}: {by_season[s]} picks")
    print(f"\nTotal: {len(picks)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
