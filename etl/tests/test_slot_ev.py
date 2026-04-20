"""Unit tests for the slot-expected-value fit (E5-02b).

Contract-style: the fit output must be strictly non-increasing within each
position bucket (plan §4.3 contract #21). Plus a handful of behavioral tests
on the input-to-output pipeline.
"""

from __future__ import annotations

import pytest

from etl.ingest.drafts import HistoricalDraftOutcome
from etl.transform.slot_ev import (
    BUCKETS,
    MAX_PICK_OVERALL,
    POSITION_BUCKETS,
    bucket_for,
    fit,
)


def _outcome(season: int, slot: int, position: str, epa: float | None, seasons: int | None = None) -> HistoricalDraftOutcome:
    return HistoricalDraftOutcome(
        draft_season=season,
        pick_overall=slot,
        gsis_id=f"00-{slot:07d}",
        position=position,
        team="NE",
        career_epa=epa,
        career_seasons=seasons,
    )


def test_bucket_for_maps_QB_to_QB() -> None:
    assert bucket_for("QB") == "QB"


def test_bucket_for_maps_RB_HB_FB_WR_TE_to_OFF_SKILL() -> None:
    for p in ("RB", "HB", "FB", "WR", "TE"):
        assert bucket_for(p) == "OFF_SKILL", p


def test_bucket_for_maps_all_OL_codes_to_OL() -> None:
    for p in ("C", "G", "OG", "T", "OT", "OL"):
        assert bucket_for(p) == "OL", p


def test_bucket_for_maps_DL_and_LB_and_DB_buckets() -> None:
    for p in ("DT", "DE", "NT", "DL"):
        assert bucket_for(p) == "DL", p
    for p in ("LB", "ILB", "OLB", "MLB"):
        assert bucket_for(p) == "LB", p
    for p in ("CB", "S", "FS", "SS", "DB"):
        assert bucket_for(p) == "DB", p


def test_bucket_for_returns_None_for_ST_so_no_fit_emitted() -> None:
    # ST is excluded per review finding #7. POSITION_BUCKETS intentionally
    # doesn't include K/P/LS, so they fall through to None.
    assert bucket_for("K") is None
    assert bucket_for("P") is None
    assert bucket_for("LS") is None


def test_bucket_for_returns_None_on_null_input() -> None:
    assert bucket_for(None) is None
    assert bucket_for("") is None


def test_bucket_for_is_case_insensitive() -> None:
    assert bucket_for("qb") == "QB"


def test_POSITION_BUCKETS_does_not_include_ST_codes() -> None:
    # Contract finding #25: no draft_expected_value rows emitted for ST.
    for st_code in ("K", "P", "LS", "KR", "PR", "RS", "ST"):
        assert st_code not in POSITION_BUCKETS, st_code


def test_fit_emits_non_increasing_curve_within_each_bucket() -> None:
    # Arrange: synthetic outcomes where EPA roughly decays with slot,
    # plus a few outliers to exercise the PAV smoothing.
    outcomes = []
    for season in (2015, 2016, 2017, 2018):
        for slot in range(1, 100):
            # Noisy decreasing signal: base * (1 - slot/100) + noise
            base_epa = max(0.0, 200.0 - slot * 1.8 + (7.0 if slot % 13 == 0 else 0.0))
            outcomes.append(_outcome(season, slot, "QB", base_epa))

    # Act
    result = fit(outcomes)

    # Assert: strictly non-increasing within each bucket (contract #21).
    by_bucket: dict[str, list[float]] = {}
    for r in result:
        by_bucket.setdefault(r.position_bucket, []).append(r.expected_value)
    for bucket, values in by_bucket.items():
        for i in range(1, len(values)):
            assert values[i] <= values[i - 1], (
                f"{bucket} violates non-increasing at slot {i}: "
                f"{values[i - 1]} -> {values[i]}"
            )


def test_fit_emits_260_slots_per_populated_bucket() -> None:
    outcomes = [_outcome(2018, s, "QB", 100.0 - s * 0.2) for s in range(1, 50)]
    result = fit(outcomes)
    qb_rows = [r for r in result if r.position_bucket == "QB"]
    assert len(qb_rows) == MAX_PICK_OVERALL


def test_fit_uses_career_seasons_fallback_when_epa_missing() -> None:
    # Pre-PBP-era outcomes with only longevity signal.
    outcomes = [
        _outcome(2015, 1, "QB", None, seasons=10),
        _outcome(2015, 50, "QB", None, seasons=6),
        _outcome(2015, 100, "QB", None, seasons=3),
    ]
    result = fit(outcomes)
    qb_rows = [r for r in result if r.position_bucket == "QB"]
    # 260 slots emitted; slot 1 value >= slot 100 value (non-increasing).
    assert len(qb_rows) == MAX_PICK_OVERALL
    assert qb_rows[0].expected_value >= qb_rows[99].expected_value


def test_fit_emits_no_rows_for_ST_bucket() -> None:
    # Even if we somehow pass a ST position through (mislabeled), the fit
    # should drop it.
    outcomes = [_outcome(2018, s, "K", 50.0) for s in range(1, 20)]
    result = fit(outcomes)
    st_rows = [r for r in result if r.position_bucket == "ST"]
    assert st_rows == []


def test_fit_skips_buckets_with_no_data() -> None:
    # Only QB data supplied; OFF_SKILL/OL/DL/LB/DB should emit zero rows.
    outcomes = [_outcome(2018, s, "QB", 100.0 - s * 0.2) for s in range(1, 10)]
    result = fit(outcomes)
    assert all(r.position_bucket == "QB" for r in result)


def test_fit_version_defaults_to_1() -> None:
    outcomes = [_outcome(2018, s, "QB", 100.0 - s * 0.2) for s in range(1, 10)]
    result = fit(outcomes)
    assert all(r.fit_version == 1 for r in result)


def test_BUCKETS_excludes_ST_by_design() -> None:
    assert "ST" not in BUCKETS
