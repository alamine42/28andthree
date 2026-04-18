import { z } from 'zod';
import { PHASES } from '@/lib/constants/phases';

export const minSeason = 2020;

/** Upper bound = current year + 1 so the schema stays valid during the
 * Aug–Dec overlap when a new NFL season has started but calendar-year math
 * on `new Date().getFullYear()` hasn't rolled over. Derived per-call so
 * tests remain forward-compatible without a manual bump every year. */
export function maxSeason(): number {
  return new Date().getFullYear() + 1;
}

export const queryParamSchema = z.object({
  phase: z.enum(PHASES, { message: 'phase must be a known slug' }),
  season: z.coerce
    .number()
    .int()
    .min(minSeason, { message: `season must be ≥ ${minSeason}` })
    .refine((n) => n <= maxSeason(), {
      message: 'season exceeds supported upper bound',
    }),
  week: z.coerce.number().int().min(1).max(22).optional(),
});

export type QueryParams = z.infer<typeof queryParamSchema>;
