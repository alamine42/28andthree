import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEASON_SAMPLE_FLOOR,
  buildHistory,
  seasonRange,
  type TeamPhaseSeasonRow,
} from '../../lib/data/trends';
import { PHASES } from '../../lib/constants/phases';
import {
  EARLIEST_SEASON,
  isSeasonScopedPath,
  resolveSeasonRouting,
} from '../../lib/season-view';

// E12: the sample-floor rule is the whole credibility of this page. A
// barely-started season has a real row with a handful of plays and a
// meaningless EPA — plot it and the chart opens on a cliff that isn't
// real. SPEC §3.5a: season-to-date renders only once plays >= 30.

function row(over: Partial<TeamPhaseSeasonRow> = {}): TeamPhaseSeasonRow {
  return {
    phase: 'overall',
    season: 2023,
    plays: 1000,
    epaPerPlay: 0.08,
    successRate: 0.47,
    rank: 9,
    insufficientSample: false,
    ...over,
  };
}

function overallPoints(rows: TeamPhaseSeasonRow[], through: number) {
  const series = buildHistory(rows, through);
  const overall = series.find((s) => s.phase === 'overall');
  assert.ok(overall, 'overall series missing');
  return overall.points;
}

describe('lib/data/trends — seasonRange', () => {
  it('should_run_from_the_data_floor_to_the_requested_season', () => {
    assert.deepEqual(seasonRange(2022), [2020, 2021, 2022]);
    assert.equal(seasonRange(2026)[0], EARLIEST_SEASON);
  });

  it('should_be_empty_when_the_target_predates_the_data_floor', () => {
    assert.deepEqual(seasonRange(EARLIEST_SEASON - 1), []);
  });
});

describe('lib/data/trends — buildHistory shape', () => {
  it('should_return_one_series_per_phase_in_canonical_order', () => {
    const series = buildHistory([], 2026);
    assert.deepEqual(series.map((s) => s.phase), [...PHASES]);
  });

  it('should_emit_a_dense_series_so_all_charts_share_one_x_axis', () => {
    // Only 2023 has data; every season in range must still get a point.
    const series = buildHistory([row()], 2026);
    for (const s of series) {
      assert.deepEqual(
        s.points.map((p) => p.season),
        [2020, 2021, 2022, 2023, 2024, 2025, 2026],
        `${s.phase} series is not dense`,
      );
    }
  });

  it('should_leave_a_missing_season_null_rather_than_zero', () => {
    const points = overallPoints([row({ season: 2023 })], 2024);
    const missing = points.find((p) => p.season === 2020);
    assert.ok(missing);
    assert.equal(missing.epaPerPlay, null);
    assert.equal(missing.rank, null);
    assert.equal(missing.plays, 0);
    // A season we never loaded is not the same claim as "too thin".
    assert.equal(missing.insufficientSample, false);
  });
});

describe('lib/data/trends — SPEC §3.5a sample floor', () => {
  it('should_null_epa_and_rank_below_the_floor', () => {
    const points = overallPoints(
      [row({ season: 2026, plays: SEASON_SAMPLE_FLOOR - 1, epaPerPlay: -0.42, rank: 31 })],
      2026,
    );
    const thin = points.find((p) => p.season === 2026);
    assert.ok(thin);
    assert.equal(thin.epaPerPlay, null, 'sub-floor EPA must not reach the chart');
    assert.equal(thin.rank, null, 'sub-floor rank must not reach the chart');
    assert.equal(thin.successRate, null);
    assert.equal(thin.insufficientSample, true);
    // Plays survive so the UI can say "n=29" instead of just going blank.
    assert.equal(thin.plays, SEASON_SAMPLE_FLOOR - 1);
  });

  it('should_publish_a_season_exactly_at_the_floor', () => {
    const points = overallPoints([row({ season: 2026, plays: SEASON_SAMPLE_FLOOR })], 2026);
    const at = points.find((p) => p.season === 2026);
    assert.ok(at);
    assert.equal(at.epaPerPlay, 0.08);
    assert.equal(at.insufficientSample, false);
  });

  it('should_honour_the_etl_flag_even_when_the_play_count_clears_the_floor', () => {
    // The ETL owns the real per-phase rule; the floor here is a backstop.
    // Whichever source says "too thin" wins.
    const points = overallPoints(
      [row({ season: 2025, plays: 900, insufficientSample: true })],
      2025,
    );
    const flagged = points.find((p) => p.season === 2025);
    assert.ok(flagged);
    assert.equal(flagged.epaPerPlay, null);
    assert.equal(flagged.rank, null);
  });

  it('should_count_only_publishable_seasons', () => {
    const points = [
      row({ season: 2020 }),
      row({ season: 2021 }),
      row({ season: 2022, plays: 4 }),
      row({ season: 2023, insufficientSample: true }),
    ];
    const overall = buildHistory(points, 2023).find((s) => s.phase === 'overall');
    assert.ok(overall);
    assert.equal(overall.publishedCount, 2);
  });

  it('should_report_zero_published_for_a_team_with_no_rows', () => {
    for (const s of buildHistory([], 2026)) {
      assert.equal(s.publishedCount, 0, `${s.phase} should have nothing to publish`);
    }
  });
});

describe('lib/data/trends — phase isolation', () => {
  it('should_not_leak_one_phase_row_into_another_series', () => {
    const series = buildHistory([row({ phase: 'pass_offense', season: 2023, rank: 3 })], 2023);
    const pass = series.find((s) => s.phase === 'pass_offense');
    const rush = series.find((s) => s.phase === 'rush_offense');
    assert.equal(pass?.points.at(-1)?.rank, 3);
    assert.equal(rush?.points.at(-1)?.rank, null);
  });
});

// E12 architectural invariant. /trends spans every season at once, so it is
// the inverse of E11's per-season scoping. If someone adds it to
// SEASON_SCOPED_PATTERNS, the middleware starts rewriting it into
// /s/{season}/trends — a route that does not exist (404), and the header
// would stamp a HISTORICAL marker on a page showing all seasons.
describe('lib/data/trends — /trends stays season-agnostic', () => {
  it('should_not_be_matched_by_the_season_scoped_allowlist', () => {
    assert.equal(isSeasonScopedPath('/trends'), false);
  });

  it('should_pass_through_the_middleware_even_with_a_valid_season_param', () => {
    assert.equal(resolveSeasonRouting('/trends', '2023'), null);
  });
});
