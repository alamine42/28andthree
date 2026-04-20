"""E5-02b: Slot-expected-value curve fit.

Isotonic regression per position bucket. Not machine learning — just the
pool-adjacent-violators algorithm enforcing "value is non-increasing as pick
number grows" within each bucket.

Input: career_epa (preferred) or career_seasons (longevity-proxy fallback)
for every (draft_season, pick_overall) we have data for, 2015-2024.
Output: ~260 slots × 6 buckets = 1,560 rows of smoothed expected value.

Bucket logic:
    QB         -> QB
    RB/HB/FB/WR/TE -> OFF_SKILL
    C/G/OG/T/OT/OL -> OL
    DT/DE/NT/DL -> DL
    LB/ILB/OLB/MLB -> LB
    CB/S/FS/SS/DB -> DB
    (ST is excluded per review finding #7 — no fit emitted.)

Contract tested: the emitted curve is strictly non-increasing within every
bucket. See etl/tests/test_slot_ev.py.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from etl.ingest.drafts import HistoricalDraftOutcome


POSITION_BUCKETS: dict[str, str] = {
    "QB": "QB",
    "RB": "OFF_SKILL", "HB": "OFF_SKILL", "FB": "OFF_SKILL",
    "WR": "OFF_SKILL", "TE": "OFF_SKILL",
    "C": "OL", "G": "OL", "OG": "OL", "T": "OL", "OT": "OL", "OL": "OL",
    "DT": "DL", "DE": "DL", "NT": "DL", "DL": "DL",
    "LB": "LB", "ILB": "LB", "OLB": "LB", "MLB": "LB",
    "CB": "DB", "S": "DB", "FS": "DB", "SS": "DB", "DB": "DB",
    # Intentionally no ST — excluded from grading per review finding #7.
}

BUCKETS: tuple[str, ...] = ("QB", "OFF_SKILL", "OL", "DL", "LB", "DB")
MAX_PICK_OVERALL = 260
ROLLING_WINDOW = 5
FIT_VERSION = 1


@dataclass(frozen=True, slots=True)
class SlotExpectedValue:
    pick_overall: int
    position_bucket: str
    expected_value: float
    fit_version: int


def bucket_for(position: str | None) -> str | None:
    if not position:
        return None
    return POSITION_BUCKETS.get(position.upper())


def _raw_value(outcome: HistoricalDraftOutcome) -> float | None:
    """Prefer career EPA; fall back to career_seasons × 10 (rough scale)."""
    if outcome.career_epa is not None:
        return outcome.career_epa
    if outcome.career_seasons is not None:
        return outcome.career_seasons * 10.0
    return None


def _group_by_bucket(
    outcomes: Sequence[HistoricalDraftOutcome],
) -> dict[str, dict[int, list[float]]]:
    """bucket -> {pick_overall: [values]}"""
    by_bucket: dict[str, dict[int, list[float]]] = {b: {} for b in BUCKETS}
    for o in outcomes:
        b = bucket_for(o.position)
        if b is None:
            continue
        v = _raw_value(o)
        if v is None:
            continue
        slot = o.pick_overall
        if slot < 1 or slot > MAX_PICK_OVERALL:
            continue
        by_bucket[b].setdefault(slot, []).append(v)
    return by_bucket


def _rolling_median(values: list[float], window: int) -> list[float]:
    """Centered rolling median; edge slots get trimmed windows."""
    out: list[float] = []
    half = window // 2
    n = len(values)
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        subset = sorted(values[lo:hi])
        mid = len(subset) // 2
        if len(subset) % 2 == 0:
            out.append((subset[mid - 1] + subset[mid]) / 2.0)
        else:
            out.append(subset[mid])
    return out


def _pool_adjacent_violators(values: list[float]) -> list[float]:
    """Enforce non-increasing sequence via PAV.

    Given a sequence, walk left-to-right; when v[i] > v[i-1] (i.e., a later
    slot somehow has higher value — a violation) pool the offending segment
    with the prior segment by averaging.
    """
    if not values:
        return []
    # Represent pooled segments as (sum, count) pairs so averages are exact.
    stack: list[tuple[float, int]] = []
    for v in values:
        stack.append((v, 1))
        # Merge while a later segment's mean is greater than (or equal to)
        # the previous segment's mean — we want strictly non-increasing.
        while len(stack) >= 2:
            sum_b, count_b = stack[-1]
            sum_a, count_a = stack[-2]
            mean_a = sum_a / count_a
            mean_b = sum_b / count_b
            if mean_b >= mean_a:
                stack.pop()
                stack.pop()
                stack.append((sum_a + sum_b, count_a + count_b))
            else:
                break
    out: list[float] = []
    for sum_v, count in stack:
        mean = sum_v / count
        out.extend([mean] * count)
    return out


def fit(
    outcomes: Sequence[HistoricalDraftOutcome],
    fit_version: int = FIT_VERSION,
) -> list[SlotExpectedValue]:
    """Fit one curve per bucket. Returns 260 slots × 6 buckets = 1,560 rows."""
    by_bucket = _group_by_bucket(outcomes)

    out: list[SlotExpectedValue] = []
    for bucket in BUCKETS:
        slot_to_values = by_bucket[bucket]
        if not slot_to_values:
            continue

        # Slot-median over the rows we have. Holes get filled by interpolation
        # (previous-value fill) so rolling median / PAV can operate on a
        # contiguous sequence.
        slot_medians: list[float | None] = []
        for slot in range(1, MAX_PICK_OVERALL + 1):
            vals = slot_to_values.get(slot, [])
            if vals:
                s = sorted(vals)
                mid = len(s) // 2
                if len(s) % 2 == 0:
                    slot_medians.append((s[mid - 1] + s[mid]) / 2.0)
                else:
                    slot_medians.append(s[mid])
            else:
                slot_medians.append(None)

        filled = _forward_fill(slot_medians)
        # Slots before any data in the bucket get back-filled from first known.
        filled = _backfill_leading_nones(filled)
        # If a bucket has zero data, skip it.
        if not filled or all(v is None for v in filled):
            continue

        smoothed = _rolling_median([v for v in filled if v is not None], ROLLING_WINDOW)
        monotone = _pool_adjacent_violators(smoothed)

        for slot_idx, value in enumerate(monotone, start=1):
            out.append(
                SlotExpectedValue(
                    pick_overall=slot_idx,
                    position_bucket=bucket,
                    expected_value=float(value),
                    fit_version=fit_version,
                )
            )

    return out


def _forward_fill(values: list[float | None]) -> list[float | None]:
    out: list[float | None] = []
    last: float | None = None
    for v in values:
        if v is not None:
            last = v
        out.append(last)
    return out


def _backfill_leading_nones(values: list[float | None]) -> list[float | None]:
    first_known: float | None = None
    for v in values:
        if v is not None:
            first_known = v
            break
    if first_known is None:
        return values
    return [first_known if v is None else v for v in values]
