import type { PositionBucket } from '@/lib/logic/draft-grade';

// Mirror of etl/transform/slot_ev.py POSITION_BUCKETS. Keep in sync — if the
// ETL bucket list ever changes, update both or the fit curve won't line up
// with the frontend lookup.
const POSITION_TO_BUCKET: Readonly<Record<string, PositionBucket>> = {
  QB: 'QB',
  RB: 'OFF_SKILL', HB: 'OFF_SKILL', FB: 'OFF_SKILL', WR: 'OFF_SKILL', TE: 'OFF_SKILL',
  C: 'OL', G: 'OL', OG: 'OL', T: 'OL', OT: 'OL', OL: 'OL',
  DT: 'DL', DE: 'DL', NT: 'DL', DL: 'DL',
  LB: 'LB', ILB: 'LB', OLB: 'LB', MLB: 'LB',
  CB: 'DB', S: 'DB', FS: 'DB', SS: 'DB', DB: 'DB',
  // K/P/LS/ST intentionally absent — map to 'ST' via the sentinel branch
  // so gradePick returns PENDING.
};

/** Map an nflverse position code to a bucket. Returns `null` for unknown +
 *  ST positions; callers treat that as ST (PENDING grade). */
export function bucketForPosition(position: string | null | undefined): PositionBucket | null {
  if (!position) return null;
  const b = POSITION_TO_BUCKET[position.toUpperCase()];
  return b ?? null;
}
