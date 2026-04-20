"""E5: upsert helper for coaching_tendencies_weekly."""

from __future__ import annotations

from collections.abc import Sequence

import psycopg
from psycopg.types.json import Jsonb

from etl.transform.coaching_tendencies import CoachingRollup


def upsert_coaching_tendencies(
    conn: psycopg.Connection,
    rollups: Sequence[CoachingRollup],
) -> int:
    if not rollups:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO coaching_tendencies_weekly
                (team, season, week, coach_role, coach_id, coach_name,
                 pass_rate_1_short, pass_rate_1_mid, pass_rate_1_long,
                 pass_rate_2_short, pass_rate_2_mid, pass_rate_2_long,
                 pass_rate_3_short, pass_rate_3_mid, pass_rate_3_long,
                 shotgun_rate, play_action_rate, motion_rate, no_huddle_rate,
                 score_leading_big_pass_rate, score_leading_small_pass_rate,
                 score_tied_pass_rate, score_trailing_small_pass_rate,
                 score_trailing_big_pass_rate,
                 seconds_per_snap, personnel_top_groups, blitz_rate,
                 fourth_down_decisions, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,
                    %s,%s,
                    %s,
                    %s,%s,%s,
                    %s, now())
            ON CONFLICT (team, season, week, coach_role) DO UPDATE SET
                coach_id = EXCLUDED.coach_id,
                coach_name = EXCLUDED.coach_name,
                pass_rate_1_short = EXCLUDED.pass_rate_1_short,
                pass_rate_1_mid = EXCLUDED.pass_rate_1_mid,
                pass_rate_1_long = EXCLUDED.pass_rate_1_long,
                pass_rate_2_short = EXCLUDED.pass_rate_2_short,
                pass_rate_2_mid = EXCLUDED.pass_rate_2_mid,
                pass_rate_2_long = EXCLUDED.pass_rate_2_long,
                pass_rate_3_short = EXCLUDED.pass_rate_3_short,
                pass_rate_3_mid = EXCLUDED.pass_rate_3_mid,
                pass_rate_3_long = EXCLUDED.pass_rate_3_long,
                shotgun_rate = EXCLUDED.shotgun_rate,
                play_action_rate = EXCLUDED.play_action_rate,
                motion_rate = EXCLUDED.motion_rate,
                no_huddle_rate = EXCLUDED.no_huddle_rate,
                score_leading_big_pass_rate = EXCLUDED.score_leading_big_pass_rate,
                score_leading_small_pass_rate = EXCLUDED.score_leading_small_pass_rate,
                score_tied_pass_rate = EXCLUDED.score_tied_pass_rate,
                score_trailing_small_pass_rate = EXCLUDED.score_trailing_small_pass_rate,
                score_trailing_big_pass_rate = EXCLUDED.score_trailing_big_pass_rate,
                seconds_per_snap = EXCLUDED.seconds_per_snap,
                personnel_top_groups = EXCLUDED.personnel_top_groups,
                blitz_rate = EXCLUDED.blitz_rate,
                fourth_down_decisions = EXCLUDED.fourth_down_decisions,
                updated_at = now()
            """,
            [
                (
                    r.team, r.season, r.week, r.coach_role, r.coach_id, r.coach_name,
                    r.pass_rate_1_short, r.pass_rate_1_mid, r.pass_rate_1_long,
                    r.pass_rate_2_short, r.pass_rate_2_mid, r.pass_rate_2_long,
                    r.pass_rate_3_short, r.pass_rate_3_mid, r.pass_rate_3_long,
                    r.shotgun_rate, r.play_action_rate, r.motion_rate, r.no_huddle_rate,
                    r.score_leading_big_pass_rate, r.score_leading_small_pass_rate,
                    r.score_tied_pass_rate, r.score_trailing_small_pass_rate,
                    r.score_trailing_big_pass_rate,
                    r.seconds_per_snap,
                    Jsonb(r.personnel_top_groups),
                    r.blitz_rate,
                    Jsonb(r.fourth_down_decisions),
                )
                for r in rollups
            ],
        )
    return len(rollups)
