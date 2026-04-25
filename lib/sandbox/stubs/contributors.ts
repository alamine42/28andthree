// E8-03: DAL stub for lib/data/contributors.ts.
// Top contributors per phase. Offensive phases yield named player cards;
// defensive / special-teams phases use the unit-card fallback so render
// parity with prod holds.

import type { ContributorCard } from '@/lib/data/contributors';
import type { Phase } from '@/lib/constants/phases';

const QB: ContributorCard = {
  gsisId: '00-2024-MAYE',
  displayName: 'Drake Maye',
  position: 'QB',
  headshotUrl: null,
  primaryStat: '+0.18',
  primaryStatLabel: 'EPA/dropback',
  role: 'qb',
};

const RUSHERS: ContributorCard[] = [
  {
    gsisId: '00-2025-HEN',
    displayName: 'TreVeyon Henderson',
    position: 'RB',
    headshotUrl: null,
    primaryStat: '4.9 ypc',
    primaryStatLabel: '214 carries',
    role: 'skill',
  },
  {
    gsisId: '00-2024-STEV',
    displayName: 'Rhamondre Stevenson',
    position: 'RB',
    headshotUrl: null,
    primaryStat: '4.1 ypc',
    primaryStatLabel: '156 carries',
    role: 'skill',
  },
];

const RECEIVERS: ContributorCard[] = [
  {
    gsisId: '00-2025-KYW',
    displayName: 'Kyle Williams',
    position: 'WR',
    headshotUrl: null,
    primaryStat: '27%',
    primaryStatLabel: 'Target share',
    role: 'skill',
  },
  {
    gsisId: '00-2024-POLK',
    displayName: "Ja'Lynn Polk",
    position: 'WR',
    headshotUrl: null,
    primaryStat: '19%',
    primaryStatLabel: 'Target share',
    role: 'skill',
  },
  {
    gsisId: '00-2024-HNRY',
    displayName: 'Hunter Henry',
    position: 'TE',
    headshotUrl: null,
    primaryStat: '16%',
    primaryStatLabel: 'Target share',
    role: 'skill',
  },
];

const UNIT_FALLBACK: ContributorCard[] = [
  {
    gsisId: '',
    displayName: 'Unit metrics',
    position: null,
    headshotUrl: null,
    primaryStat: 'See team page \u2192',
    primaryStatLabel: 'Defensive unit',
    role: 'unit',
  },
];

// E4-follow (39d.19): defender leaderboard fixtures. Synthetic gsisIds so
// the sandbox build remains data-pure; CI sentinel grep keys off the
// fixture-only marker added by sandbox-dump.
const DEFENDER_CAVEAT =
  'Based on nflverse participation data; no pass-coverage credit ' +
  '(individual ratings deferred per methodology).';

const PASS_DEFENDERS: ContributorCard[] = [
  {
    gsisId: '00-2023-GONZ',
    displayName: 'Christian Gonzalez',
    position: 'CB',
    headshotUrl: null,
    primaryStat: '14',
    primaryStatLabel: 'Sacks + pressures',
    role: 'defender',
    caveat: DEFENDER_CAVEAT,
  },
  {
    gsisId: '00-2021-BARM',
    displayName: 'Christian Barmore',
    position: 'DT',
    headshotUrl: null,
    primaryStat: '12',
    primaryStatLabel: 'Sacks + pressures',
    role: 'defender',
    caveat: DEFENDER_CAVEAT,
  },
  {
    gsisId: '00-2023-WHIT',
    displayName: 'Keion White',
    position: 'DE',
    headshotUrl: null,
    primaryStat: '10',
    primaryStatLabel: 'Sacks + pressures',
    role: 'defender',
    caveat: DEFENDER_CAVEAT,
  },
];

const RUN_DEFENDERS: ContributorCard[] = [
  {
    gsisId: '00-2021-BARM',
    displayName: 'Christian Barmore',
    position: 'DT',
    headshotUrl: null,
    primaryStat: '22',
    primaryStatLabel: 'Stops at/behind LOS',
    role: 'defender',
    caveat: DEFENDER_CAVEAT,
  },
  {
    gsisId: '00-2025-FARM',
    displayName: 'Joshua Farmer',
    position: 'DT',
    headshotUrl: null,
    primaryStat: '17',
    primaryStatLabel: 'Stops at/behind LOS',
    role: 'defender',
    caveat: DEFENDER_CAVEAT,
  },
];

export async function getTopContributors(
  phase: Phase,
  _team: string,
  _season: number,
  limit = 3,
): Promise<ContributorCard[]> {
  switch (phase) {
    case 'pass_offense':
    case 'third_down_offense':
    case 'overall':
      return [QB].slice(0, limit);
    case 'rush_offense':
      return RUSHERS.slice(0, limit);
    case 'redzone_offense':
      return RECEIVERS.map((r) => ({
        ...r,
        primaryStat: '4 RZ targets',
        primaryStatLabel: 'Red-zone usage',
      })).slice(0, limit);
    case 'explosive_offense':
      return RECEIVERS.slice(0, limit);
    case 'pass_defense':
    case 'third_down_defense':
      return PASS_DEFENDERS.slice(0, limit);
    case 'run_defense':
      return RUN_DEFENDERS.slice(0, limit);
    case 'redzone_defense':
    case 'explosive_defense':
      return PASS_DEFENDERS.map((c) => ({
        ...c,
        primaryStat: phase === 'redzone_defense' ? '38' : '92',
        primaryStatLabel:
          phase === 'redzone_defense' ? 'Red-zone snaps' : 'Snaps without an explosive',
      })).slice(0, limit);
    default:
      return UNIT_FALLBACK;
  }
}
