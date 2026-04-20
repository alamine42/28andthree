import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeCoachSegments, type WeeklyCoachRow } from '../../lib/logic/coach-segments';

// Segmentation algorithm (plan §3.5):
//   - Group by coach_role
//   - Scan weeks ascending; close + open a segment when coach_id changes
//   - Fall back to normalized coach_name when coach_id is null

function row(
  week: number,
  role: 'HC' | 'OC' | 'DC',
  coachId: string | null,
  coachName: string,
): WeeklyCoachRow {
  return { week, coachRole: role, coachId, coachName };
}

describe('lib/logic/coach-segments — computeCoachSegments', () => {
  it('should_return_one_segment_per_role_when_season_is_stable', () => {
    const rows = [
      row(1, 'HC', 'vrabel01', 'Mike Vrabel'),
      row(1, 'OC', 'vanpelt01', 'Alex Van Pelt'),
      row(1, 'DC', 'flores01', 'Brian Flores'),
      row(2, 'HC', 'vrabel01', 'Mike Vrabel'),
      row(2, 'OC', 'vanpelt01', 'Alex Van Pelt'),
      row(2, 'DC', 'flores01', 'Brian Flores'),
      row(18, 'HC', 'vrabel01', 'Mike Vrabel'),
      row(18, 'OC', 'vanpelt01', 'Alex Van Pelt'),
      row(18, 'DC', 'flores01', 'Brian Flores'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 3);
    assert.equal(segments.filter((s) => s.role === 'HC').length, 1);
    assert.equal(segments.filter((s) => s.role === 'OC').length, 1);
    assert.equal(segments.filter((s) => s.role === 'DC').length, 1);
  });

  it('should_emit_segment_weekStart_1_and_weekEnd_18_for_full_season_coach', () => {
    const rows = [
      row(1, 'HC', 'vrabel01', 'Mike Vrabel'),
      row(18, 'HC', 'vrabel01', 'Mike Vrabel'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.weekStart, 1);
    assert.equal(segments[0]?.weekEnd, 18);
  });

  it('should_split_into_two_segments_when_coach_id_changes_mid_season', () => {
    const rows = [
      row(1, 'OC', 'mcdaniels01', 'Josh McDaniels'),
      row(2, 'OC', 'mcdaniels01', 'Josh McDaniels'),
      row(6, 'OC', 'mcdaniels01', 'Josh McDaniels'),
      row(7, 'OC', 'vanpelt01', 'Alex Van Pelt'),
      row(18, 'OC', 'vanpelt01', 'Alex Van Pelt'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.weekStart, 1);
    assert.equal(segments[0]?.weekEnd, 6);
    assert.equal(segments[0]?.coachName, 'Josh McDaniels');
    assert.equal(segments[1]?.weekStart, 7);
    assert.equal(segments[1]?.weekEnd, 18);
    assert.equal(segments[1]?.coachName, 'Alex Van Pelt');
  });

  it('should_fall_back_to_normalized_coach_name_when_coach_id_is_null', () => {
    // Feed only exposes names — normalized comparison keeps stable coach
    // on the same segment despite spelling drift ("Alex Van Pelt" vs
    // "Alex VanPelt"). Review finding #9.
    const rows = [
      row(1, 'OC', null, 'Alex Van Pelt'),
      row(2, 'OC', null, 'alex van pelt'),
      row(3, 'OC', null, 'Alex  VanPelt'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.weekStart, 1);
    assert.equal(segments[0]?.weekEnd, 3);
  });

  it('should_prefer_coach_id_over_coach_name_when_both_present', () => {
    // Same id, different display names (team issued new spelling) =
    // still one segment.
    const rows = [
      row(1, 'HC', 'vrabel01', 'Mike Vrabel'),
      row(2, 'HC', 'vrabel01', 'Michael Vrabel'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 1);
  });

  it('should_handle_three_coordinator_changes_correctly', () => {
    // Rare but tests the segment-close-and-open loop.
    const rows = [
      row(1, 'DC', 'a', 'Coach A'),
      row(4, 'DC', 'b', 'Coach B'),
      row(8, 'DC', 'c', 'Coach C'),
      row(14, 'DC', 'd', 'Coach D'),
      row(18, 'DC', 'd', 'Coach D'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 4);
  });

  it('should_sort_rows_by_week_ascending_before_segmenting', () => {
    // Caller might hand us rows in arbitrary order.
    const rows = [
      row(18, 'HC', 'b', 'Coach B'),
      row(1, 'HC', 'a', 'Coach A'),
      row(7, 'HC', 'b', 'Coach B'),
      row(6, 'HC', 'a', 'Coach A'),
    ];

    const segments = computeCoachSegments(rows);

    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.coachName, 'Coach A');
    assert.equal(segments[0]?.weekStart, 1);
    assert.equal(segments[0]?.weekEnd, 6);
    assert.equal(segments[1]?.coachName, 'Coach B');
    assert.equal(segments[1]?.weekStart, 7);
    assert.equal(segments[1]?.weekEnd, 18);
  });

  it('should_return_empty_array_for_empty_input', () => {
    const segments = computeCoachSegments([]);
    assert.deepEqual(segments, []);
  });

  it('should_handle_missing_coach_id_on_some_rows_but_not_others', () => {
    // Mixed data — some weeks feed has the id, others don't.
    const rows = [
      row(1, 'HC', null, 'Mike Vrabel'),
      row(2, 'HC', 'vrabel01', 'Mike Vrabel'),
      row(3, 'HC', 'vrabel01', 'Mike Vrabel'),
    ];

    const segments = computeCoachSegments(rows);

    // All 3 rows are Vrabel (by normalized name first + id later) — one segment.
    assert.equal(segments.length, 1);
  });
});
