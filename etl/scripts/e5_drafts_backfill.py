"""E5-02a + E5-02b: one-shot orchestrator.

Pulls league-wide draft picks 2015-2024 from nflreadpy, computes per-player
career EPA from our plays table (for 2020+ careers) and career_seasons from
nflverse roster history (for pre-2020 careers), upserts rows into
`draft_outcomes_historical`, then fits the slot-expected-value curve and
upserts into `draft_expected_value`.

Usage (env must carry ETL_DATABASE_URL):

    cd etl
    uv run python -m scripts.e5_drafts_backfill

Idempotent. Re-running is safe; rows upsert on (draft_season, pick_overall)
and (pick_overall, position_bucket) respectively.
"""

from __future__ import annotations

import logging
import os
import sys
from collections import defaultdict

import nflreadpy as nfl
import psycopg

from etl.ingest.drafts import HistoricalDraftOutcome, fetch_draft_picks, normalize_historical
from etl.load.drafts import upsert_historical_draft_outcomes, upsert_slot_expected_value
from etl.transform.slot_ev import fit as fit_slot_ev

SEASONS = tuple(range(2015, 2025))  # 2015-2024 inclusive; matches drafts.py docstring

log = logging.getLogger("e5-drafts")


def _career_epa_by_gsis(conn: psycopg.Connection) -> dict[str, float]:
    """Aggregate career offensive EPA per gsis from the plays table.

    Offensive carriers of EPA are passer + rusher + receiver. We sum EPA on
    plays where the gsis appears in any of those roles. Season coverage is
    whatever we've backfilled (2020+). Pre-2020 careers have no row here and
    fall back to career_seasons in the downstream outcome builder.
    """
    sql = """
      SELECT gsis_id, SUM(epa) AS career_epa
      FROM (
        SELECT passer_player_id  AS gsis_id, epa FROM plays WHERE passer_player_id  IS NOT NULL AND epa IS NOT NULL
        UNION ALL
        SELECT rusher_player_id  AS gsis_id, epa FROM plays WHERE rusher_player_id  IS NOT NULL AND epa IS NOT NULL
        UNION ALL
        SELECT receiver_player_id AS gsis_id, epa FROM plays WHERE receiver_player_id IS NOT NULL AND epa IS NOT NULL
      ) t
      GROUP BY gsis_id
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    return {gsis: float(epa) for gsis, epa in rows if gsis and epa is not None}


def _career_seasons_by_gsis(seasons: tuple[int, ...]) -> dict[str, int]:
    """Career-length proxy from nflverse rosters: count of distinct seasons
    a player appeared on a roster. Covers pre-2020 careers where plays data
    is absent."""
    years = tuple(range(min(seasons), 2025))  # include through most recent filled season
    log.info("loading rosters for %d seasons via nflreadpy", len(years))
    df = nfl.load_rosters(seasons=years)
    if df.is_empty():
        return {}
    # nflreadpy 0.1.x rosters expose gsis_id + season
    gsis_col = "gsis_id" if "gsis_id" in df.columns else None
    season_col = "season" if "season" in df.columns else None
    if gsis_col is None or season_col is None:
        log.warning("rosters missing expected columns; got %s", df.columns)
        return {}
    counts: dict[str, set[int]] = defaultdict(set)
    for row in df.iter_rows(named=True):
        g = row.get(gsis_col)
        s = row.get(season_col)
        if g and s is not None:
            counts[str(g)].add(int(s))
    return {k: len(v) for k, v in counts.items()}


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    url = os.environ.get("ETL_DATABASE_URL")
    if not url:
        log.error("ETL_DATABASE_URL not set")
        return 2

    log.info("pulling draft picks for seasons %s via nflreadpy", SEASONS)
    draft_df = fetch_draft_picks(SEASONS)
    log.info("draft rows: %d", draft_df.height)

    with psycopg.connect(url) as conn:
        log.info("aggregating career EPA from plays")
        career_epa = _career_epa_by_gsis(conn)
        log.info("career EPA covers %d gsis_ids", len(career_epa))

        career_seasons = _career_seasons_by_gsis(SEASONS)
        log.info("career seasons covers %d gsis_ids", len(career_seasons))

        outcomes: list[HistoricalDraftOutcome] = normalize_historical(
            draft_df,
            career_epa_by_gsis=career_epa,
            career_seasons_by_gsis=career_seasons,
        )
        log.info("normalized outcomes: %d", len(outcomes))

        n_outcomes = upsert_historical_draft_outcomes(conn, outcomes)
        log.info("upserted historical outcomes: %d", n_outcomes)

        slot_ev_rows = fit_slot_ev(outcomes)
        log.info("slot-EV rows fit: %d", len(slot_ev_rows))

        n_ev = upsert_slot_expected_value(conn, slot_ev_rows)
        log.info("upserted slot EV: %d", n_ev)

        conn.commit()
        log.info("committed.")

    print(
        f"\nDone. historical_outcomes={n_outcomes}  "
        f"slot_expected_values={n_ev}  "
        f"career_epa_covered={len(career_epa)}  "
        f"career_seasons_covered={len(career_seasons)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
