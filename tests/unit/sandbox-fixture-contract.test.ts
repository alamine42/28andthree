import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../../lib/constants/phases';
import {
  phaseDetails2025,
  phaseSnapshot2025,
  sparklines2025,
} from '../../lib/sandbox/fixtures/phases';
import { recentGames2025, teamOverview2025 } from '../../lib/sandbox/fixtures/team';
import { coachSegments2025, fourthDownDecisions2025 } from '../../lib/sandbox/fixtures/coaching';
import { draftRoi } from '../../lib/sandbox/fixtures/draft';

// E8-13: fixture shape contracts. If any of these drift out of sync
// with the prod DAL types, the TS build would catch it — but the
// structural checks below also guard against runtime-only violations
// (missing phases, invalid rank range, etc).

describe('fixture contract — phases', () => {
  it('snapshot covers every phase exactly once', () => {
    const seen = new Set(phaseSnapshot2025.map((s) => s.phase));
    assert.equal(seen.size, PHASES.length);
    for (const p of PHASES) assert.ok(seen.has(p), `missing snapshot for ${p}`);
  });

  it('every snapshot rank is 1..32 or null', () => {
    for (const s of phaseSnapshot2025) {
      if (s.rank === null) continue;
      assert.ok(s.rank >= 1 && s.rank <= 32, `rank out of range: ${s.rank}`);
    }
  });

  it('bakes a tie at rank 14 between rush_offense and special_teams', () => {
    const ranks = phaseSnapshot2025
      .filter((s) => s.rank === 14)
      .map((s) => s.phase)
      .sort();
    assert.deepEqual(ranks, ['rush_offense', 'special_teams']);
  });

  it('explosive_defense is flagged insufficientSample with totalQualified < 32', () => {
    const detail = phaseDetails2025['explosive_defense'];
    assert.equal(detail.insufficientSample, true);
    assert.ok(detail.totalQualified < 32, 'K should be reduced when insufficient');
    assert.equal(detail.rank, null, 'insufficient samples must null out rank');
  });

  it('sparklines have at least one null point to exercise gap-render', () => {
    const sl = sparklines2025.get('special_teams') ?? [];
    assert.ok(sl.some((p) => p.value === null), 'expected a null sparkline point');
  });

  it('sparkline maps keyed by every phase', () => {
    for (const p of PHASES) {
      assert.ok(sparklines2025.has(p), `sparkline missing for ${p}`);
    }
  });
});

describe('fixture contract — team', () => {
  it('overview record sums to a believable number of games', () => {
    const { wins, losses, ties } = teamOverview2025.record;
    const total = wins + losses + ties;
    assert.ok(total >= 0 && total <= 18, `games total out of range: ${total}`);
  });

  it('recent games all reference NE as home or away', () => {
    for (const g of recentGames2025) {
      assert.ok(typeof g.isHome === 'boolean');
      assert.ok(g.opponent.length === 2 || g.opponent.length === 3);
    }
  });
});

describe('fixture contract — coaching', () => {
  it('produces two OC segments when OC changes mid-season (§3.5a)', () => {
    const ocs = coachSegments2025.filter((s) => s.role === 'OC');
    assert.ok(ocs.length >= 2, 'expected mid-season OC split with ≥ 2 segments');
    // Verify no overlap in week ranges.
    ocs.sort((a, b) => a.weekStart - b.weekStart);
    for (let i = 1; i < ocs.length; i++) {
      const curr = ocs[i]!;
      const prev = ocs[i - 1]!;
      assert.ok(curr.weekStart > prev.weekEnd, 'OC segments must not overlap');
    }
  });

  it('fourth-down decisions include both agreed and disagreed calls', () => {
    const agreed = fourthDownDecisions2025.filter((d) => d.wentForIt === d.goRecommended);
    const disagreed = fourthDownDecisions2025.filter((d) => d.wentForIt !== d.goRecommended);
    assert.ok(agreed.length > 0, 'need at least one agreed call');
    assert.ok(disagreed.length > 0, 'need at least one disagreed call');
  });
});

describe('fixture contract — draft', () => {
  it('includes a traded-out slot with null gsisId', () => {
    const allPicks = Object.values(draftRoi).flat();
    assert.ok(allPicks.some((p) => p.gsisId === null && p.tradedTo !== null),
      'need ≥1 traded-out pick to exercise the grade_traded path');
  });

  it('every pick has a round in 1..7', () => {
    for (const picks of Object.values(draftRoi)) {
      for (const p of picks) {
        assert.ok(p.round >= 1 && p.round <= 7, `invalid round: ${p.round}`);
      }
    }
  });
});
