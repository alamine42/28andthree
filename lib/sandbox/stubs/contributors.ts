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
    default:
      return UNIT_FALLBACK;
  }
}
