import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSparklinePath } from '../../components/charts/sparkline-path';

describe('components/charts/sparkline-path — buildSparklinePath', () => {
  it('should_return_empty_path_when_given_empty_array', () => {
    assert.equal(buildSparklinePath([], { width: 60, height: 20 }), '');
  });

  it('should_render_single_point_as_a_dot_path', () => {
    const d = buildSparklinePath([0.5], { width: 60, height: 20 });
    // One "M x,y" command, no L's.
    assert.match(d, /^M[\d.]+,[\d.]+$/);
  });

  it('should_skip_null_values_with_gap', () => {
    // Line series with null in middle → path breaks into two `M ... L ...`
    // segments (rather than connecting through the null).
    const d = buildSparklinePath([0.1, 0.2, null, 0.3, 0.4], { width: 100, height: 20 });
    // Should contain two `M`s (one for each continuous run).
    const mCount = (d.match(/M/g) || []).length;
    assert.equal(mCount, 2);
  });

  it('should_place_first_point_at_x_equals_zero_and_last_at_x_equals_width', () => {
    const d = buildSparklinePath([0.1, 0.5], { width: 100, height: 20 });
    // First coord must start at x=0.
    assert.match(d, /^M0,/);
    // Last point must end near x=100. Parse just the last number pair.
    const lastPair = d.match(/L([\d.]+),([\d.]+)$/);
    assert.ok(lastPair, 'expected at least one L command');
    assert.equal(Number(lastPair[1]), 100);
  });

  it('should_map_max_value_to_y_equals_zero_top_edge', () => {
    // Higher y values render at the BOTTOM in SVG; a max-value point renders at top (y=0).
    const d = buildSparklinePath([1.0, 0.5], { width: 100, height: 20 });
    // First point is the max; its y should be 0. (Followed by the L command.)
    assert.match(d, /^M0,0(?=[LM ]|$)/);
  });

  it('should_map_min_value_to_y_equals_height_bottom_edge', () => {
    const d = buildSparklinePath([1.0, 0.0], { width: 100, height: 20 });
    // Last point is the min; its y should be 20 (height).
    assert.match(d, /L100,20$/);
  });

  it('should_handle_all_identical_values_by_drawing_horizontal_centerline', () => {
    // When min === max, a naive (v-min)/(max-min) would divide by zero. Expect
    // a horizontal line at the vertical middle instead.
    const d = buildSparklinePath([0.3, 0.3, 0.3], { width: 60, height: 20 });
    // All y values should be 10 (center).
    const yValues = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
    for (const y of yValues) assert.equal(y, 10);
  });
});
