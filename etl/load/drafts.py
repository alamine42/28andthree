"""E5: upsert helpers for draft tables."""

from __future__ import annotations

from collections.abc import Sequence

import psycopg
from psycopg.types.json import Jsonb  # noqa: F401  (kept for future coaching loader)

from etl.ingest.drafts import HistoricalDraftOutcome, PatsDraftPick
from etl.transform.slot_ev import SlotExpectedValue


def upsert_historical_draft_outcomes(
    conn: psycopg.Connection,
    outcomes: Sequence[HistoricalDraftOutcome],
) -> int:
    if not outcomes:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO draft_outcomes_historical
                (draft_season, pick_overall, gsis_id, position, team,
                 career_epa, career_seasons, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (draft_season, pick_overall) DO UPDATE SET
                gsis_id = EXCLUDED.gsis_id,
                position = EXCLUDED.position,
                team = EXCLUDED.team,
                career_epa = EXCLUDED.career_epa,
                career_seasons = EXCLUDED.career_seasons,
                updated_at = now()
            """,
            [
                (
                    o.draft_season,
                    o.pick_overall,
                    o.gsis_id,
                    o.position,
                    o.team,
                    o.career_epa,
                    o.career_seasons,
                )
                for o in outcomes
            ],
        )
    return len(outcomes)


def upsert_draft_picks(
    conn: psycopg.Connection,
    picks: Sequence[PatsDraftPick],
) -> int:
    if not picks:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO draft_picks
                (draft_season, round, pick_overall, gsis_id, position,
                 traded_to, player_name, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (draft_season, pick_overall) DO UPDATE SET
                round = EXCLUDED.round,
                gsis_id = EXCLUDED.gsis_id,
                position = EXCLUDED.position,
                traded_to = EXCLUDED.traded_to,
                player_name = EXCLUDED.player_name,
                updated_at = now()
            """,
            [
                (
                    p.draft_season,
                    p.round,
                    p.pick_overall,
                    p.gsis_id,
                    p.position,
                    p.traded_to,
                    p.player_name,
                )
                for p in picks
            ],
        )
    return len(picks)


def upsert_slot_expected_value(
    conn: psycopg.Connection,
    rows: Sequence[SlotExpectedValue],
) -> int:
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO draft_expected_value
                (pick_overall, position_bucket, expected_value, fit_version, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (pick_overall, position_bucket) DO UPDATE SET
                expected_value = EXCLUDED.expected_value,
                fit_version = EXCLUDED.fit_version,
                updated_at = now()
            """,
            [
                (r.pick_overall, r.position_bucket, r.expected_value, r.fit_version)
                for r in rows
            ],
        )
    return len(rows)
