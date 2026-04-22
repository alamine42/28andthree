// E8-03: DAL stubs for lib/data/draft.ts.

import { draftRoi } from '../fixtures/draft';
import type { DraftRoiRow } from '@/lib/data/draft';

export async function getDraftRoiByClass(
  draftSeason: number,
  _currentSeason: number,
): Promise<DraftRoiRow[]> {
  return draftRoi[draftSeason] ?? [];
}
