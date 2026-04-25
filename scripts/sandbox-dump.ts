#!/usr/bin/env -S tsx
// E8-10: regenerate lib/sandbox/fixtures/*.ts from prod Neon (read-only).
//
// Why this exists: hand-curating four fixture files and keeping their
// shapes aligned with DAL evolution by memory is the #1 rot risk (codex
// F6). This script re-pulls real prod rows through the actual prod DAL
// readers, so any schema/DAL drift surfaces as a typecheck error during
// regeneration rather than weeks later when a sandbox page silently
// renders the wrong shape.
//
// Usage:
//   DATABASE_URL='postgres://app_read:...@host/db' pnpm sandbox:regenerate
//   DATABASE_URL='...' pnpm sandbox:regenerate -- --no-augment
//
// Flags:
//   --no-augment   skip edge-case overlays (mid-season OC split + sparkline
//                  gap). Use when you want a faithful prod snapshot.
//   --season=YYYY  override the season pulled (default: getCurrentSeason()).
//   --team=XXX     override team (default: NE).
//   --dry-run      print what would be written without touching disk.
//
// Safety: this script ONLY runs SELECT queries (it goes through the same
// DAL readers the live app uses, with isSandbox() returning false). Use
// the read-only role (app_read) as belt + suspenders.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import { PHASES, type Phase } from '@/lib/constants/phases';
import { getCurrentSeason } from '@/lib/data/current-season';
import {
  getRecentGames,
  getTeamSeasonOverview,
  type GameResult,
  type TeamSeasonOverview,
} from '@/lib/data/team';
import {
  getLeagueDistribution,
  getPatsPhaseSparklines,
  getPhaseDetail,
  getPhaseRankSnapshot,
  getPhaseWeeklyTrend,
  type DistributionRow,
  type PhaseDetail,
  type PhaseSnapshot,
  type SparklinePoint,
  type TrendPoint,
} from '@/lib/data/phases';
import { getDraftRoiByClass, type DraftRoiRow } from '@/lib/data/draft';
import {
  getCoachSegments,
  getFourthDownDecisions,
  type CoachSegmentWithRollup,
  type FourthDownDecision,
} from '@/lib/data/coaching';

// ---- CLI parsing -----------------------------------------------------------

type Args = {
  season: number | null;
  team: string;
  augment: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { season: null, team: 'NE', augment: true, dryRun: false };
  for (const a of argv) {
    if (a === '--no-augment') args.augment = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--season=')) args.season = Number(a.slice(9));
    else if (a.startsWith('--team=')) args.team = a.slice(7).toUpperCase();
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      printHelp();
      process.exit(1);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(
    [
      'sandbox-dump — regenerate lib/sandbox/fixtures/*.ts from prod Neon',
      '',
      'Required env: DATABASE_URL (read-only role recommended)',
      '',
      'Flags:',
      '  --no-augment    skip edge-case overlays (mid-season OC split, sparkline gap)',
      '  --season=YYYY   override season (default: latest in team_phase_weekly)',
      '  --team=XXX      override team (default: NE)',
      '  --dry-run       print sizes, do not write files',
    ].join('\n'),
  );
}

// ---- Augmenter sentinels ---------------------------------------------------
//
// When --augment is on the script injects these strings into the dumped
// fixtures so the .github/workflows/sandbox-isolation.yml grep can detect
// a fixture leak in the prod bundle. Each one is unique enough that it
// can only come from a fixture (no real prod row would carry it).
//
// If you change these, update SENTINELS[] in the workflow file too.

const SENTINEL_GAME_ID = '__SANDBOX_FIXTURE__tie_game';
const SENTINEL_COACH_NAME = '[augmented] mid-season replacement';
const SENTINEL_DRAFT_GSIS = '__SANDBOX_FIXTURE__draft_pick';
const SENTINEL_PHASE_TEAM = '__SANDBOX_FIXTURE__phase_team';

// ---- TS literal emitter ----------------------------------------------------

function ts(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    return String(value);
  }
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return `new Date('${value.toISOString()}')`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return (
      '[\n' +
      value.map((v) => `${childPad}${ts(v, indent + 1)}`).join(',\n') +
      `,\n${pad}]`
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return (
      '{\n' +
      entries
        .map(([k, v]) => `${childPad}${quoteKey(k)}: ${ts(v, indent + 1)}`)
        .join(',\n') +
      `,\n${pad}}`
    );
  }
  throw new Error(`Cannot serialize value of type ${typeof value}`);
}

function quoteKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = join(REPO_ROOT, 'lib', 'sandbox', 'fixtures');

function header(args: Args, source: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const augmentNote = args.augment
    ? '// Edge-case augmenter applied (--no-augment to disable next time).'
    : '// Raw prod dump — no edge-case overlays applied.';
  return [
    `// AUTO-GENERATED by scripts/sandbox-dump.ts on ${stamp}.`,
    '// Re-run: pnpm sandbox:regenerate',
    `// Source: prod Neon — team=${args.team}, season=${args.season}, table=${source}`,
    augmentNote,
    '',
  ].join('\n');
}

async function writeFixture(
  args: Args,
  filename: string,
  contents: string,
): Promise<void> {
  const path = join(FIXTURES_DIR, filename);
  if (args.dryRun) {
    console.log(`  [dry-run] ${path}  (${contents.length} bytes)`);
    return;
  }
  await mkdir(FIXTURES_DIR, { recursive: true });
  await writeFile(path, contents, 'utf8');
  console.log(`  wrote ${path}  (${contents.length} bytes)`);
}

// ---- Per-fixture dumpers ---------------------------------------------------

async function dumpTeam(args: Args, season: number): Promise<void> {
  const [overview, recent] = await Promise.all([
    getTeamSeasonOverview(args.team, season),
    getRecentGames(args.team, season, 6),
  ]);

  const overviewEmit: TeamSeasonOverview = overview;
  let recentEmit: GameResult[] = recent;

  // Augmenter: ensure at least one tie game so the third result-code path
  // renders (W/L/T). If prod has no tie, force the oldest game to a tie
  // and tag the gameId with a __SANDBOX__ marker so the CI sentinel grep
  // can detect a fixture leak.
  if (args.augment) {
    const hasTie = recentEmit.some((g) => g.teamScore != null && g.teamScore === g.oppScore);
    if (!hasTie && recentEmit.length > 0) {
      const oldest = recentEmit[recentEmit.length - 1];
      if (oldest) {
        recentEmit = [
          ...recentEmit.slice(0, -1),
          {
            ...oldest,
            gameId: SENTINEL_GAME_ID,
            teamScore: 20,
            oppScore: 20,
            teamEpaPerPlay: 0.05,
            oppEpaPerPlay: 0.05,
          },
        ];
      }
    }
  }

  const body = [
    header(args, 'team_phase_season + games'),
    `import type { TeamSeasonOverview, GameResult } from '@/lib/data/team';`,
    '',
    `export const teamOverview${season}: TeamSeasonOverview = ${ts(overviewEmit)};`,
    '',
    `export const recentGames${season}: GameResult[] = ${ts(recentEmit)};`,
    '',
  ].join('\n');

  await writeFixture(args, 'team.ts', body);
}

async function dumpPhases(args: Args, season: number): Promise<void> {
  let snapshot = await getPhaseRankSnapshot(args.team, season);
  const sparklinesMap = await getPatsPhaseSparklines(args.team, season);
  const detailsEntries = await Promise.all(
    PHASES.map(async (p) => [p, await getPhaseDetail(p, args.team, season)] as const),
  );
  const trendsEntries = await Promise.all(
    PHASES.map(async (p) => [p, await getPhaseWeeklyTrend(p, args.team, season)] as const),
  );
  const distEntries = await Promise.all(
    PHASES.map(async (p) => [p, await getLeagueDistribution(p, season)] as const),
  );

  const details: Record<Phase, PhaseDetail | null> = Object.fromEntries(detailsEntries) as Record<
    Phase,
    PhaseDetail | null
  >;
  const trends: Record<Phase, TrendPoint[]> = Object.fromEntries(trendsEntries) as Record<
    Phase,
    TrendPoint[]
  >;
  const distributions: Record<Phase, DistributionRow[]> = Object.fromEntries(distEntries) as Record<
    Phase,
    DistributionRow[]
  >;

  // Sparklines: Map<Phase, SparklinePoint[]>. Convert to a plain record for
  // emit; reconstitute as Map at the bottom of the emitted file.
  const sparklineRecord: Record<Phase, SparklinePoint[]> = {} as Record<Phase, SparklinePoint[]>;
  for (const p of PHASES) sparklineRecord[p] = sparklinesMap.get(p) ?? [];

  // Augmenter overlay: ensure at least one sparkline gap so the
  // gap-render path in <Sparkline /> is exercised. Pick special_teams
  // (matches the original hand-curation choice) and null its middle
  // point if every value is non-null.
  if (args.augment) {
    const st = sparklineRecord['special_teams'];
    if (st.length > 0 && st.every((p) => p.value !== null)) {
      const mid = Math.floor(st.length / 2);
      const target = st[mid];
      if (target) {
        sparklineRecord['special_teams'] = st.map((p, i) =>
          i === mid ? { week: target.week, value: null } : p,
        );
      }
    }
  }

  // Build phaseDetails with the edge-case insufficient-sample overlay if
  // none naturally exist. Pick explosive_defense (matches original).
  let detailsEmit: Record<Phase, PhaseDetail> = {} as Record<Phase, PhaseDetail>;
  for (const p of PHASES) {
    const d = details[p];
    detailsEmit[p] = d ?? {
      phase: p,
      plays: 0,
      epaPerPlay: null,
      successRate: null,
      rank: null,
      percentile: null,
      insufficientSample: true,
      totalQualified: 0,
    };
  }
  if (args.augment) {
    // Always force explosive_defense to be the insufficient-sample
    // exemplar — fixture-contract test asserts this exact phase + the
    // K<32 copy path needs a deterministic anchor.
    const ed = detailsEmit['explosive_defense'];
    detailsEmit = {
      ...detailsEmit,
      explosive_defense: {
        ...ed,
        insufficientSample: true,
        totalQualified: Math.min(28, ed.totalQualified > 0 ? ed.totalQualified - 4 : 28),
        rank: null,
        percentile: null,
      },
    };

    // Force a tied rank at 14 between rush_offense and special_teams so
    // the tiebreak display path renders. Re-rank below 14 by +1 to
    // preserve a valid ordering.
    const sortedByRank = [...snapshot]
      .filter((s) => s.rank !== null)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const augmented = new Map(snapshot.map((s) => [s.phase, { ...s }]));
    const rush = augmented.get('rush_offense');
    const st = augmented.get('special_teams');
    if (rush && st) {
      rush.rank = 14;
      st.rank = 14;
      // Bump every phase strictly below 14 down by one to leave room for
      // the tie. (Matches the hand-curated fixture's tiebreak shape.)
      for (const s of sortedByRank) {
        if (s.phase === 'rush_offense' || s.phase === 'special_teams') continue;
        const a = augmented.get(s.phase);
        if (a && a.rank !== null && a.rank > 14) a.rank = a.rank + 1;
      }
    }
    snapshot = PHASES.map((p) => augmented.get(p) ?? snapshot.find((s) => s.phase === p)!).filter(
      (s): s is PhaseSnapshot => Boolean(s),
    );
  }

  // Augmenter: append a synthetic team row to one phase's distribution so
  // the CI sentinel grep has a fixture-only string to detect leaks.
  if (args.augment) {
    const target = distributions['pass_offense'];
    distributions['pass_offense'] = [
      ...target,
      {
        team: SENTINEL_PHASE_TEAM,
        plays: 0,
        epaPerPlay: null,
        rank: null,
        insufficientSample: true,
      },
    ];
  }

  // Sparkline emit as a plain Record + reconstituted Map at the bottom so
  // the file stays diff-friendly and the `new Map` ceremony is one line.
  const body = [
    header(args, 'team_phase_season + team_phase_weekly'),
    `import type {`,
    `  PhaseSnapshot,`,
    `  PatsSparklines,`,
    `  PhaseDetail,`,
    `  TrendPoint,`,
    `  DistributionRow,`,
    `  SparklinePoint,`,
    `} from '@/lib/data/phases';`,
    `import { PHASES, type Phase } from '@/lib/constants/phases';`,
    '',
    `export const phaseSnapshot${season}: PhaseSnapshot[] = ${ts(snapshot)};`,
    '',
    `const sparklineData${season}: Record<Phase, SparklinePoint[]> = ${ts(sparklineRecord)};`,
    '',
    `export const sparklines${season}: PatsSparklines = new Map<Phase, SparklinePoint[]>(`,
    `  PHASES.map((p) => [p, sparklineData${season}[p] ?? []]),`,
    `);`,
    '',
    `export const phaseDetails${season}: Record<Phase, PhaseDetail> = ${ts(detailsEmit)};`,
    '',
    `const trendData${season}: Record<Phase, TrendPoint[]> = ${ts(trends)};`,
    '',
    `export function phaseTrend${season}(phase: Phase): TrendPoint[] {`,
    `  return trendData${season}[phase] ?? [];`,
    `}`,
    '',
    `const distributionData${season}: Record<Phase, DistributionRow[]> = ${ts(distributions)};`,
    '',
    `export function phaseDistribution${season}(phase: Phase): DistributionRow[] {`,
    `  return distributionData${season}[phase] ?? [];`,
    `}`,
    '',
    `export { PHASES };`,
    '',
  ].join('\n');

  await writeFixture(args, 'phases.ts', body);
}

async function dumpDraft(args: Args, currentSeason: number): Promise<void> {
  // Five most recent classes (matches existing hand-curation: 2021–2025).
  const classSeasons = [
    currentSeason - 4,
    currentSeason - 3,
    currentSeason - 2,
    currentSeason - 1,
    currentSeason,
  ];

  const entries: Array<[number, DraftRoiRow[]]> = [];
  for (const s of classSeasons) {
    const rows = await getDraftRoiByClass(s, currentSeason);
    entries.push([s, rows]);
  }

  // Emit as plain object with numeric keys. ts() quotes numeric keys via
  // JSON.stringify naturally, but Record<number, T> accepts string keys
  // too — TypeScript collapses them.
  const draftRoi: Record<number, DraftRoiRow[]> = {};
  for (const [s, rows] of entries) draftRoi[s] = rows;

  // Augmenter: ensure the fixture exercises every grade-badge path the
  // /draft-roi page renders, plus the traded-out slot (gsisId=null +
  // tradedTo set). Real prod data may not contain a traded-out pick or
  // a HIT this early in the rebuild. Append synthetic rows tagged with
  // the CI sentinel string so the isolation workflow can detect leaks.
  if (args.augment) {
    const cur = draftRoi[currentSeason] ?? [];
    const allPicks = Object.values(draftRoi).flat();
    const extras: DraftRoiRow[] = [];

    if (!allPicks.some((p) => p.grade === 'HIT')) {
      extras.push({
        draftSeason: currentSeason,
        round: 7,
        pickOverall: 999,
        gsisId: SENTINEL_DRAFT_GSIS + '_hit',
        displayName: '[augmented] sentinel hit',
        position: 'P',
        tradedTo: null,
        actualValue: 50,
        expectedValue: 10,
        grade: 'HIT',
      });
    }

    if (!allPicks.some((p) => p.gsisId === null && p.tradedTo !== null)) {
      extras.push({
        draftSeason: currentSeason,
        round: 6,
        pickOverall: 188,
        gsisId: null,
        displayName: null,
        position: 'P',
        tradedTo: 'JAX',
        actualValue: null,
        expectedValue: null,
        grade: 'PENDING',
      });
    }

    // Always append a sentinel marker row even if HIT/traded-out already
    // exist, so CI grep has a deterministic string to look for.
    extras.push({
      draftSeason: currentSeason,
      round: 7,
      pickOverall: 998,
      gsisId: SENTINEL_DRAFT_GSIS,
      displayName: '[augmented] sentinel marker',
      position: null,
      tradedTo: null,
      actualValue: null,
      expectedValue: null,
      grade: 'PENDING',
    });

    draftRoi[currentSeason] = [...cur, ...extras];
  }

  const body = [
    header(args, 'draft_picks + draft_expected_value + skill_season + qb_season'),
    `import type { DraftRoiRow } from '@/lib/data/draft';`,
    '',
    `export const draftRoi: Record<number, DraftRoiRow[]> = ${ts(draftRoi)};`,
    '',
  ].join('\n');

  await writeFixture(args, 'draft.ts', body);
}

async function dumpCoaching(args: Args, season: number): Promise<void> {
  let segments = await getCoachSegments(args.team, season);
  let decisions = await getFourthDownDecisions(args.team, season);

  // Augmenter: ensure §3.5a (mid-season coordinator change) is exercised.
  // If no role has 2+ segments, split the OC role in half so the
  // two-segment render path is exercised. Synthetic name + null coachId
  // make the augmentation obvious in code review and double as the
  // CI sentinel string for coaching.ts.
  if (args.augment) {
    const roleCounts = new Map<string, number>();
    for (const s of segments) roleCounts.set(s.role, (roleCounts.get(s.role) ?? 0) + 1);
    const hasSplit = Array.from(roleCounts.values()).some((c) => c >= 2);
    if (!hasSplit) {
      const oc = segments.find((s) => s.role === 'OC');
      if (oc && oc.weekEnd > oc.weekStart) {
        const mid = Math.floor((oc.weekStart + oc.weekEnd) / 2);
        const first: CoachSegmentWithRollup = { ...oc, weekEnd: mid };
        const second: CoachSegmentWithRollup = {
          ...oc,
          coachId: null,
          coachName: SENTINEL_COACH_NAME,
          weekStart: mid + 1,
        };
        segments = [
          ...segments.filter((s) => s !== oc),
          first,
          second,
        ];
      }
    } else {
      // Already has a split; still need the sentinel string. Tag the
      // alphabetically-last OC segment's coachName.
      const ocs = segments.filter((s) => s.role === 'OC');
      const last = ocs[ocs.length - 1];
      if (last) {
        segments = segments.map((s) => (s === last ? { ...s, coachName: SENTINEL_COACH_NAME } : s));
      }
    }

    // Populate fourth-down decisions if empty so /coaching renders the
    // FourthDownLedger module instead of falling back to "Model pending".
    if (decisions.length === 0) {
      decisions = [
        { week: 5, wpBoostGo: 0.018, wentForIt: true, goRecommended: true, resultYards: 7 },
        { week: 9, wpBoostGo: 0.011, wentForIt: true, goRecommended: true, resultYards: -2 },
        { week: 13, wpBoostGo: -0.012, wentForIt: true, goRecommended: false, resultYards: 3 },
        { week: 15, wpBoostGo: 0.057, wentForIt: true, goRecommended: true, resultYards: 12 },
      ];
    }
  }

  // Sort segments deterministically: by role then weekStart. Keeps the
  // emitted output stable across runs even if the DAL changes its order.
  const ROLE_ORDER: Record<string, number> = { HC: 0, OC: 1, DC: 2, ST: 3 };
  segments = [...segments].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.weekStart - b.weekStart;
  });

  const segmentsEmit: CoachSegmentWithRollup[] = segments;
  const decisionsEmit: FourthDownDecision[] = decisions;

  const body = [
    header(args, 'coaching_tendencies_weekly'),
    `import type {`,
    `  CoachSegmentWithRollup,`,
    `  FourthDownDecision,`,
    `} from '@/lib/data/coaching';`,
    '',
    `export const coachSegments${season}: CoachSegmentWithRollup[] = ${ts(segmentsEmit)};`,
    '',
    `export const fourthDownDecisions${season}: FourthDownDecision[] = ${ts(decisionsEmit)};`,
    '',
    // Re-export the rollup shape so callers can see it through the same
    // module path as the existing hand-curated fixture.
    `export type { TendencyRollup } from '@/lib/data/coaching';`,
    '',
  ].join('\n');

  await writeFixture(args, 'coaching.ts', body);
}

// ---- Entry point -----------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (use the app_read role).');
    process.exit(1);
  }
  // Belt + suspenders: refuse to run if NEXT_PUBLIC_SANDBOX_MODE is set.
  // The DAL would short-circuit to stubs and we'd dump fixtures from
  // fixtures, which is both wrong and confusing.
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE === '1') {
    console.error('NEXT_PUBLIC_SANDBOX_MODE=1 is set — unset it before dumping (or you will dump the fixtures back into themselves).');
    process.exit(1);
  }

  // Use a dedicated pool we can close cleanly. The DAL's getDb()
  // singleton would leak the pool beyond the script's lifetime.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  // Force the DAL's drizzle client to use this pool by pre-warming the
  // singleton. We import the schema lazily to keep the bundle small.
  const schema = await import('@/db/schema');
  const _drizzle = drizzle(pool, { schema });
  void _drizzle;

  // The DAL uses its own pool via getDb(). Our pool here is just to
  // confirm the connection string works before we kick off readers.
  await pool.query('SELECT 1');

  const season = args.season ?? (await getCurrentSeason());
  args.season = season;
  console.log(`sandbox-dump: team=${args.team} season=${season} augment=${args.augment} dry-run=${args.dryRun}`);

  console.log('dumping team.ts ...');
  await dumpTeam(args, season);
  console.log('dumping phases.ts ...');
  await dumpPhases(args, season);
  console.log('dumping draft.ts ...');
  await dumpDraft(args, season);
  console.log('dumping coaching.ts ...');
  await dumpCoaching(args, season);

  await pool.end();
  console.log('done. Review the diff in lib/sandbox/fixtures/ and run pnpm typecheck.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
