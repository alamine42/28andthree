import type { DraftRoiRow } from '@/lib/data/draft';

// Sandbox fixture: 5 Pats classes (2021-2025) with a believable mix
// of HIT/FAIR/MISS/PENDING. Hand-picked to exercise every grade-badge
// path on /draft-roi: HIT (green), FAIR (muted), MISS (cranberry
// border), PENDING (dim, sub-2-season picks + ST + traded-out).

export const draftRoi: Record<number, DraftRoiRow[]> = {
  2025: [
    // 2025 = current season, all PENDING (rookie year, < 2 seasons)
    {
      draftSeason: 2025, round: 1, pickOverall: 4, gsisId: '00-2025-A',
      displayName: 'Will Campbell', position: 'OL', tradedTo: null,
      actualValue: null, expectedValue: 35.0, grade: 'PENDING',
    },
    {
      draftSeason: 2025, round: 2, pickOverall: 38, gsisId: '00-2025-B',
      displayName: 'TreVeyon Henderson', position: 'RB', tradedTo: null,
      actualValue: null, expectedValue: 18.0, grade: 'PENDING',
    },
    {
      draftSeason: 2025, round: 3, pickOverall: 69, gsisId: '00-2025-C',
      displayName: 'Kyle Williams', position: 'WR', tradedTo: null,
      actualValue: null, expectedValue: 12.5, grade: 'PENDING',
    },
  ],
  2024: [
    // 2024 = sophomore year, PENDING per maturation rule (< 2 seasons)
    {
      draftSeason: 2024, round: 1, pickOverall: 3, gsisId: '00-2024-A',
      displayName: 'Drake Maye', position: 'QB', tradedTo: null,
      actualValue: null, expectedValue: 76.95, grade: 'PENDING',
    },
    {
      draftSeason: 2024, round: 2, pickOverall: 37, gsisId: '00-2024-B',
      displayName: "Ja'Lynn Polk", position: 'WR', tradedTo: null,
      actualValue: null, expectedValue: 18.0, grade: 'PENDING',
    },
  ],
  2023: [
    // 2023 = matured. Mix of HIT + FAIR + MISS to exercise badge tiers.
    {
      draftSeason: 2023, round: 1, pickOverall: 17, gsisId: '00-2023-A',
      displayName: 'Christian Gonzalez', position: 'CB', tradedTo: null,
      actualValue: 58.0, expectedValue: 40.0, grade: 'HIT',
    },
    {
      draftSeason: 2023, round: 2, pickOverall: 46, gsisId: '00-2023-B',
      displayName: 'Keion White', position: 'DE', tradedTo: null,
      actualValue: 30.0, expectedValue: 28.0, grade: 'FAIR',
    },
    {
      draftSeason: 2023, round: 4, pickOverall: 112, gsisId: '00-2023-C',
      displayName: 'Demario Douglas', position: 'WR', tradedTo: null,
      actualValue: 6.0, expectedValue: 14.0, grade: 'MISS',
    },
  ],
  2022: [
    {
      draftSeason: 2022, round: 1, pickOverall: 29, gsisId: '00-2022-A',
      displayName: 'Cole Strange', position: 'OL', tradedTo: null,
      actualValue: 22.0, expectedValue: 30.0, grade: 'MISS',
    },
    {
      draftSeason: 2022, round: 2, pickOverall: 50, gsisId: '00-2022-B',
      displayName: 'Tyquan Thornton', position: 'WR', tradedTo: null,
      actualValue: 4.0, expectedValue: 16.0, grade: 'MISS',
    },
    {
      draftSeason: 2022, round: 3, pickOverall: 85, gsisId: '00-2022-C',
      displayName: 'Marcus Jones', position: 'CB', tradedTo: null,
      actualValue: 32.0, expectedValue: 22.0, grade: 'HIT',
    },
  ],
  2021: [
    {
      draftSeason: 2021, round: 1, pickOverall: 15, gsisId: '00-2021-A',
      displayName: 'Mac Jones', position: 'QB', tradedTo: null,
      actualValue: 35.0, expectedValue: 50.0, grade: 'MISS',
    },
    {
      draftSeason: 2021, round: 2, pickOverall: 38, gsisId: '00-2021-B',
      displayName: 'Christian Barmore', position: 'DT', tradedTo: null,
      actualValue: 48.0, expectedValue: 28.0, grade: 'HIT',
    },
    {
      draftSeason: 2021, round: 3, pickOverall: 96, gsisId: '00-2021-C',
      displayName: 'Ronnie Perkins', position: 'EDGE', tradedTo: null,
      actualValue: 10.0, expectedValue: 14.0, grade: 'FAIR',
    },
    {
      draftSeason: 2021, round: 6, pickOverall: 188, gsisId: null,
      displayName: null, position: 'P', tradedTo: 'JAX',
      actualValue: null, expectedValue: null, grade: 'PENDING',
    },
  ],
};
