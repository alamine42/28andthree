// Shared types + validators for authoring extractors.
//
// An extractor reads from the existing DAL (lib/data/*) and shapes a
// content-type-specific structured object plus pre-extracted reference
// arrays for the hallucination guard. Each extractor is pure: same
// inputs → same outputs, no side effects beyond DB reads.

export const CONTENT_TYPES = [
  'recap',
  'opponent_preview',
  'deep_dive_draft',
  'deep_dive_retrospective',
  'deep_dive_schedule_reaction',
  'deep_dive_camp',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** A stat the LLM is allowed to reference. The factcheck guard cross-
 * references every numeric in the draft against this list with rounding
 * tolerance. `rank` is optional context; `unit` is informational only. */
export type NumericClaim = {
  label: string;
  value: number;
  rank?: number;
  unit?: string;
};

/** Structured input passed to the LLM. Generic over `data` so each
 * content type can shape its own; the wrapper carries metadata that's
 * consistent across types. */
export type ExtractorContext<T> = {
  contentType: ContentType;
  contextKey: string;
  data: T;
  numericClaims: NumericClaim[];
  playerNames: string[];
  generatedAt: Date;
};

/** Throws if any claim is malformed. Run before passing claims to the
 * factcheck guard so we fail fast on bad extractor output. */
export function validateNumericClaims(claims: NumericClaim[]): void {
  for (const claim of claims) {
    if (typeof claim.label !== 'string' || claim.label.length === 0) {
      throw new Error(`numeric claim missing label: ${JSON.stringify(claim)}`);
    }
    if (typeof claim.value !== 'number' || Number.isNaN(claim.value)) {
      throw new Error(`numeric claim has NaN value: ${JSON.stringify(claim)}`);
    }
  }
}

/** Throws if any name is malformed. */
export function validatePlayerNames(names: string[]): void {
  for (const name of names) {
    if (typeof name !== 'string') {
      throw new Error(`player name must be a string: ${JSON.stringify(name)}`);
    }
    if (name.length === 0) {
      throw new Error(`player name must not be empty`);
    }
  }
}
