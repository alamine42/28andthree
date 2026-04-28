import type { ExtractorContext, NumericClaim } from './extractors/types';
import { PROPER_NOUN_ALLOWLIST, SINGLE_WORD_ALLOWLIST } from './factcheck-allowlist';

// Common English caps that begin sentences. Skip 2-word matches whose
// first word is one of these — they're "Article+Noun" not "FirstName+LastName".
const ENGLISH_STOP_CAPS: ReadonlySet<string> = new Set([
  'The', 'A', 'An', 'This', 'That', 'These', 'Those',
  'And', 'But', 'Or', 'So', 'If', 'When', 'Where', 'While', 'After',
  'Before', 'During', 'On', 'In', 'At', 'For', 'From', 'To', 'Of',
  'No', 'Not', 'All', 'Some', 'Most', 'Last', 'Next', 'New', 'Old',
  'One', 'Two', 'Three', 'Four', 'Five',
  'Mr', 'Mrs', 'Ms', 'Dr',
  'I', 'You', 'He', 'She', 'It', 'We', 'They',
  'My', 'Your', 'His', 'Her', 'Its', 'Our', 'Their',
  'Now', 'Then', 'Here', 'There', 'Yes', 'Maybe',
  'Wk', 'Week', 'Quarter', 'Half',
]);

// Hallucination guard. Per plan §3.7 (post-codex WARNING #2):
// - Numerics are cross-checked against the source's numericClaims with
//   ±0.005 rounding tolerance.
// - Player names are detected via a FirstName LastName(-LastName2) regex
//   and validated against the source's playerNames + an explicit allowlist
//   covering teams + cities + stadiums + coaches + football common nouns.
// - Free-form prose (qualitative claims, superlatives without a number) is
//   the human editor's job, not the guard's.

export type FactcheckFinding = {
  type: 'numeric_drift' | 'player_unknown';
  token: string;
  context: string;
  expected?: string | number;
};

export type FactcheckResult = {
  status: 'pass' | 'fail';
  findings: FactcheckFinding[];
};

const NUMERIC_TOLERANCE = 0.005;

// Numeric token: optional sign, digits, optional decimal, optional %.
// Negative lookbehind/ahead prevents matching inside identifiers like "k1d".
const NUMERIC_REGEX = /(?<![A-Za-z0-9._])-?\d+(?:\.\d+)?%?(?![A-Za-z0-9_])/g;

// FirstName LastName, optionally LastName-LastName2 (compound surnames).
// Two-word minimum prevents single-token false positives like "Buffalo".
const PERSON_REGEX = /\b[A-Z][a-z]+(?:[''][A-Z]?[a-z]+)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\b/g;

export function factcheck(
  markdown: string,
  ctx: ExtractorContext<unknown>,
): FactcheckResult {
  const findings: FactcheckFinding[] = [];
  findings.push(...checkNumerics(markdown, ctx.numericClaims));
  findings.push(...checkPlayerNames(markdown, ctx.playerNames));
  return { status: findings.length === 0 ? 'pass' : 'fail', findings };
}

function checkNumerics(markdown: string, claims: NumericClaim[]): FactcheckFinding[] {
  const findings: FactcheckFinding[] = [];
  // Normalize the U+2212 minus to ASCII before matching. Most drafts won't
  // contain U+2212 (skip the full string clone in that case).
  const normalized = markdown.includes('−') ? markdown.replace(/−/g, '-') : markdown;
  const claimedValues = claims.map((c) => c.value);

  for (const match of normalized.matchAll(NUMERIC_REGEX)) {
    const raw = match[0];
    const numeric = parseNumeric(raw);
    if (numeric === null) continue;
    if (!matchesAnyClaim(numeric, claimedValues)) {
      findings.push({
        type: 'numeric_drift',
        token: raw,
        context: contextSnippet(normalized, match.index ?? 0, raw.length),
      });
    }
  }
  return findings;
}

function parseNumeric(token: string): number | null {
  const stripped = token.endsWith('%') ? token.slice(0, -1) : token;
  const v = Number.parseFloat(stripped);
  return Number.isNaN(v) ? null : v;
}

function matchesAnyClaim(value: number, claimed: number[]): boolean {
  for (const c of claimed) {
    if (Math.abs(value - c) <= NUMERIC_TOLERANCE) return true;
  }
  return false;
}

// Multi-word allowlisted phrases sorted by length desc, used to mask out
// known compound proper nouns ("Hall of Fame", "Super Bowl") before the
// 2-word player-name scan. Without masking, the regex matches sub-spans
// like "Fame Super" inside "Hall of Fame Super Bowl".
function buildMultiWordAllowlist(): string[] {
  const multi = [...PROPER_NOUN_ALLOWLIST].filter((s) => s.includes(' '));
  return multi.sort((a, b) => b.length - a.length);
}

const MULTI_WORD_ALLOWLIST = buildMultiWordAllowlist();

function maskMultiWordAllowlist(text: string): string {
  let out = text;
  for (const phrase of MULTI_WORD_ALLOWLIST) {
    // Replace with same-length runs of underscores so substring offsets stay sane.
    // Underscore is excluded from PERSON_REGEX matching so it won't be re-detected.
    const replacement = '_'.repeat(phrase.length);
    out = out.split(phrase).join(replacement);
  }
  return out;
}

function checkPlayerNames(markdown: string, rosterNames: string[]): FactcheckFinding[] {
  const findings: FactcheckFinding[] = [];
  const rosterSet = new Set(rosterNames);
  const seen = new Set<string>();

  // Mask known multi-word phrases so sub-span 2-word matches don't false-flag.
  const masked = maskMultiWordAllowlist(markdown);

  for (const match of masked.matchAll(PERSON_REGEX)) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);

    // Whole-token matches against roster or the compound allowlist
    if (rosterSet.has(token)) continue;
    if (PROPER_NOUN_ALLOWLIST.has(token)) continue;

    // Decompose the 2-word match. If the first word is an English stop-cap
    // ("The Bills", "After Sunday"), the match is article+noun, not a name.
    // If either word individually is allowlisted, the match is non-player
    // (e.g. team-name + verb, "Bills Won").
    const parts = token.split(/\s+/);
    const first = parts[0] ?? '';
    const last = parts[parts.length - 1] ?? '';
    if (ENGLISH_STOP_CAPS.has(first)) continue;
    if (ENGLISH_STOP_CAPS.has(last)) continue;
    if (SINGLE_WORD_ALLOWLIST.has(first)) continue;
    if (SINGLE_WORD_ALLOWLIST.has(last)) continue;

    findings.push({
      type: 'player_unknown',
      token,
      context: contextSnippet(markdown, match.index ?? 0, token.length),
    });
  }
  return findings;
}

function contextSnippet(s: string, start: number, len: number): string {
  const before = Math.max(0, start - 20);
  const after = Math.min(s.length, start + len + 20);
  return s.slice(before, after).replace(/\s+/g, ' ').trim();
}
