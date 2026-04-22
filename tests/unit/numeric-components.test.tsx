import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Delta, MetricValue, RankNumber } from '../../components/numeric';
import { formatEpa } from '../../lib/format/number';

// These are the three wrappers every rendered metric flows through so the
// bad-number crawler's `data-numeric="true"` attribute never gets forgotten.
// See adversarial-review finding #10.

describe('components/numeric — RankNumber', () => {
  it('should_emit_data_numeric_attribute_on_a_known_rank', () => {
    const html = renderToStaticMarkup(<RankNumber rank={4} />);
    assert.match(html, /data-numeric="true"/);
  });

  it('should_render_ordinal_suffix_via_formatRank', () => {
    const html = renderToStaticMarkup(<RankNumber rank={4} />);
    assert.match(html, />4th</);
  });

  it('should_render_em_dash_when_rank_is_null', () => {
    const html = renderToStaticMarkup(<RankNumber rank={null} />);
    assert.match(html, />\u2014</);
  });

  it('should_emit_data_tier_attribute_positive_for_rank_4', () => {
    const html = renderToStaticMarkup(<RankNumber rank={4} />);
    assert.match(html, /data-tier="positive"/);
  });

  it('should_emit_data_tier_neutral_for_null_rank', () => {
    const html = renderToStaticMarkup(<RankNumber rank={null} />);
    assert.match(html, /data-tier="neutral"/);
  });
});

describe('components/numeric — MetricValue', () => {
  it('should_emit_data_numeric_attribute', () => {
    const html = renderToStaticMarkup(<MetricValue value={0.3} format={formatEpa} />);
    assert.match(html, /data-numeric="true"/);
  });

  it('should_render_formatted_output', () => {
    const html = renderToStaticMarkup(<MetricValue value={0.3} format={formatEpa} />);
    assert.match(html, />\+0\.30</);
  });

  it('should_render_em_dash_for_null', () => {
    const html = renderToStaticMarkup(<MetricValue value={null} format={formatEpa} />);
    assert.match(html, />\u2014</);
  });
});

describe('components/numeric — Delta', () => {
  it('should_emit_data_numeric_attribute', () => {
    const html = renderToStaticMarkup(<Delta value={3} />);
    assert.match(html, /data-numeric="true"/);
  });

  it('should_render_up_triangle_for_positive_delta', () => {
    const html = renderToStaticMarkup(<Delta value={3} />);
    assert.match(html, /▲/);
  });

  it('should_render_middle_dot_for_zero_delta', () => {
    const html = renderToStaticMarkup(<Delta value={0} />);
    assert.match(html, />·</);
  });

  it('should_render_nothing_when_value_is_null', () => {
    const html = renderToStaticMarkup(<Delta value={null} />);
    // Empty span still renders but contains empty string.
    assert.match(html, /><\/span>|>\s*<\/span>/);
  });
});
