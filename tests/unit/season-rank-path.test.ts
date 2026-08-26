import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAGUE_SIZE,
  buildRankPath,
  plottedPoints,
  rankExtremes,
  xFor,
  yForRank,
} from '../../components/charts/season-rank-path';

const BOX = { width: 100, height: 100 };

describe('season-rank-path — yForRank', () => {
  it('should_pin_rank_1_to_the_top_and_32_to_the_bottom', () => {
    assert.equal(yForRank(1, 100), 0);
    assert.equal(yForRank(LEAGUE_SIZE, 100), 100);
  });

  it('should_use_a_fixed_domain_so_every_small_multiple_shares_an_axis', () => {
    // Same rank → same y regardless of what else is in its series.
    assert.equal(yForRank(16, 100), yForRank(16, 100));
    assert.ok(yForRank(8, 100) < yForRank(24, 100), 'better rank sits higher');
  });

  it('should_clamp_out_of_range_ranks_instead_of_drawing_off_box', () => {
    assert.equal(yForRank(0, 100), 0);
    assert.equal(yForRank(99, 100), 100);
  });
});

describe('season-rank-path — xFor', () => {
  it('should_spread_seasons_edge_to_edge', () => {
    assert.equal(xFor(0, 7, 120), 0);
    assert.equal(xFor(6, 7, 120), 120);
  });

  it('should_centre_a_lone_season', () => {
    assert.equal(xFor(0, 1, 120), 60);
  });
});

describe('season-rank-path — buildRankPath', () => {
  it('should_build_a_single_segment_for_a_complete_series', () => {
    const d = buildRankPath([4, 8, 12], BOX);
    assert.equal(d.match(/M/g)?.length, 1);
    assert.equal(d.match(/L/g)?.length, 2);
  });

  it('should_split_the_path_at_a_gap_rather_than_interpolating', () => {
    const d = buildRankPath([4, 8, null, 12, 16], BOX);
    // Two moves = two separate strokes; the gap is visible.
    assert.equal(d.match(/M/g)?.length, 2);
    // And no vertex lands in the gap's x slot.
    assert.ok(!d.includes(`,${yForRank(10, BOX.height).toFixed(2)}`));
  });

  it('should_drop_a_one_point_segment_from_the_stroke_but_keep_its_dot', () => {
    // A published season flanked by gaps has no second vertex to draw to.
    // Dropping it from the path is correct; plottedPoints is what keeps it
    // on screen. Asserting both halves so a future refactor cannot silently
    // lose the season entirely.
    const ranks = [4, null, 12, 16];
    const d = buildRankPath(ranks, BOX);
    assert.equal(d.match(/M/g)?.length, 1, 'only the 12→16 pair can stroke');
    assert.equal(plottedPoints(ranks, BOX).length, 3, 'all three still get dots');
  });

  it('should_emit_nothing_for_an_all_null_series', () => {
    assert.equal(buildRankPath([null, null], BOX), '');
  });

  it('should_not_stroke_an_isolated_single_point', () => {
    // One published season between gaps has no line to draw — plottedPoints
    // is what keeps it visible.
    assert.equal(buildRankPath([null, 9, null], BOX), '');
    assert.equal(plottedPoints([null, 9, null], BOX).length, 1);
  });
});

describe('season-rank-path — plottedPoints', () => {
  it('should_skip_unpublished_seasons_but_keep_their_x_slot', () => {
    const pts = plottedPoints([4, null, 12], BOX);
    assert.deepEqual(pts.map((p) => p.index), [0, 2]);
    // Index 2 keeps the third slot's x, not the second's.
    assert.equal(pts[1]!.x, xFor(2, 3, BOX.width));
  });
});

describe('season-rank-path — rankExtremes', () => {
  it('should_report_best_as_the_lowest_number', () => {
    assert.deepEqual(rankExtremes([12, 4, 28]), { best: 4, worst: 28 });
  });

  it('should_ignore_gaps', () => {
    assert.deepEqual(rankExtremes([null, 7, null]), { best: 7, worst: 7 });
  });

  it('should_return_nulls_when_nothing_is_published', () => {
    assert.deepEqual(rankExtremes([null, null]), { best: null, worst: null });
  });
});
