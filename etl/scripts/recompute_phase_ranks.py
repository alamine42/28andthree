"""One-off: recompute team_phase_weekly + team_phase_season for every season.

Written for bd patsbythenumbers-78e (defensive ranks were inverted league-wide).
Re-aggregates from the existing `plays` table only — no ingest, no network.
The upserts are idempotent (ON CONFLICT DO UPDATE), so re-running is safe.

  ETL_DATABASE_URL='<prod etl_writer>' uv run python -m etl.scripts.recompute_phase_ranks
"""

from __future__ import annotations

import os
import sys

import psycopg

from etl.transform.phases import recompute_season, recompute_weekly

EARLIEST = 2020


def main() -> int:
    url = os.environ.get("ETL_DATABASE_URL")
    if not url:
        print("ETL_DATABASE_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT max(season) FROM plays")
            latest = cur.fetchone()[0]
        if latest is None:
            print("no plays rows found", file=sys.stderr)
            return 1

        for season in range(EARLIEST, latest + 1):
            weekly = recompute_weekly(conn, season=season)
            seasonal = recompute_season(conn, season=season)
            conn.commit()
            print(f"{season}: {weekly:>6} weekly rows, {seasonal:>4} season rows")

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
