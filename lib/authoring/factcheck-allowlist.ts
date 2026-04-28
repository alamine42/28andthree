// Allowlists for the hallucination guard. Codex WARNING #2: bare
// capitalization-based proper-noun detection would have flagged "Bills",
// "Buffalo", "AFC" as fabricated player names. Lists below partition the
// proper-noun space so player-name detection only flags real
// FirstName-LastName patterns that aren't accounted for elsewhere.

// Cities + nicknames + alternate forms for all 32 NFL teams. Synthesized
// once; refresh annually. Ordered by team code for diff readability.
const TEAM_NICKNAMES: readonly string[] = [
  // ARI
  'Cardinals', 'Arizona',
  // ATL
  'Falcons', 'Atlanta',
  // BAL
  'Ravens', 'Baltimore',
  // BUF
  'Bills', 'Buffalo',
  // CAR
  'Panthers', 'Carolina',
  // CHI
  'Bears', 'Chicago',
  // CIN
  'Bengals', 'Cincinnati',
  // CLE
  'Browns', 'Cleveland',
  // DAL
  'Cowboys', 'Dallas',
  // DEN
  'Broncos', 'Denver',
  // DET
  'Lions', 'Detroit',
  // GB
  'Packers', 'Green Bay',
  // HOU
  'Texans', 'Houston',
  // IND
  'Colts', 'Indianapolis',
  // JAX
  'Jaguars', 'Jacksonville',
  // KC
  'Chiefs', 'Kansas City',
  // LAC
  'Chargers', 'Los Angeles Chargers',
  // LAR
  'Rams', 'Los Angeles Rams',
  // LV
  'Raiders', 'Las Vegas',
  // MIA
  'Dolphins', 'Miami',
  // MIN
  'Vikings', 'Minnesota',
  // NE
  'Patriots', 'New England',
  // NO
  'Saints', 'New Orleans',
  // NYG
  'Giants', 'New York Giants',
  // NYJ
  'Jets', 'New York Jets',
  // PHI
  'Eagles', 'Philadelphia',
  // PIT
  'Steelers', 'Pittsburgh',
  // SEA
  'Seahawks', 'Seattle',
  // SF
  'Niners', 'Forty Niners', 'San Francisco',
  // TB
  'Buccaneers', 'Bucs', 'Tampa Bay',
  // TEN
  'Titans', 'Tennessee',
  // WAS
  'Commanders', 'Washington',
];

// Common football nouns + multi-word allowlisted phrases. Things that
// would otherwise look like FirstName-LastName patterns to the regex.
const FOOTBALL_NOUNS: readonly string[] = [
  'Pro Bowl',
  'Super Bowl',
  'Wild Card',
  'Divisional Round',
  'Conference Championship',
  'Hall of Fame',
  'Senior Bowl',
  'Pro Day',
  'Combine',
  'Training Camp',
  'OTAs',
  'Mini Camp',
  'Free Agency',
  'Salary Cap',
  'Trade Deadline',
  'AFC East',
  'AFC North',
  'AFC South',
  'AFC West',
  'NFC East',
  'NFC North',
  'NFC South',
  'NFC West',
  'Big Ben', // historical references possible
];

// Stadiums — hand-curated. Refresh annually.
const STADIUMS: readonly string[] = [
  'Gillette Stadium',
  'Highmark Stadium',
  'Arrowhead Stadium',
  'Lambeau Field',
  'MetLife Stadium',
  'AT&T Stadium',
  'SoFi Stadium',
  'Lumen Field',
  'Levi Stadium',
  'Mercedes Benz Stadium',
  'Lucas Oil Stadium',
  'M&T Bank Stadium',
  'Hard Rock Stadium',
  'Bank of America Stadium',
  'Soldier Field',
  'Ford Field',
  'US Bank Stadium',
  'Heinz Field', // historical
  'Acrisure Stadium',
  'Empower Field',
  'Caesars Superdome',
  'Raymond James Stadium',
  'EverBank Stadium',
  'Lincoln Financial Field',
  'NRG Stadium',
  'Paycor Stadium',
  'GEHA Field',
  'State Farm Stadium',
  'Allegiant Stadium',
  'Northwest Stadium',
  'Cleveland Browns Stadium',
];

// Notable head coaches + coordinators. Hand-curated; refresh annually.
// Names listed without "Coach" prefix; the FirstName-LastName regex matches
// on bare names. Includes anyone who may surface in Patriots-context writing.
const COACHES: readonly string[] = [
  // NE-relevant
  'Mike Vrabel',
  'Bill Belichick',
  'Jerod Mayo',
  'Josh McDaniels',
  'Alex Van Pelt',
  'Demarcus Covington',
  'Steve Belichick',
  // AFC East rivals
  'Sean McDermott',
  'Joe Brady',
  'Bobby Babich',
  'Aaron Glenn',
  'Mike McDaniel',
  'Frank Smith',
  'Anthony Weaver',
  // High-profile around the league (in case writing references them)
  'Andy Reid',
  'Patrick Mahomes', // QBs that are widely referenced — but they will also be roster-validated when the matchup involves them
  'Sean McVay',
  'Kyle Shanahan',
  'Doug Pederson',
  'Nick Sirianni',
  'Mike Tomlin',
  'John Harbaugh',
  'Jim Harbaugh',
  'Dan Campbell',
  'Matt LaFleur',
  'Pete Carroll',
  'Sean Payton',
  'DeMeco Ryans',
  'Mike McCarthy',
  'Brian Daboll',
  'Robert Saleh',
  'Jeff Ulbrich',
];

// Multi-word and single-word allowlists combined into a single Set for
// fast lookup at factcheck time.
function buildAllowlist(): Set<string> {
  const set = new Set<string>();
  for (const list of [TEAM_NICKNAMES, FOOTBALL_NOUNS, STADIUMS, COACHES]) {
    for (const item of list) {
      set.add(item);
    }
  }
  return set;
}

export const PROPER_NOUN_ALLOWLIST: ReadonlySet<string> = buildAllowlist();

// Single-word allowlist subset — for performance, factcheck checks single
// capitalized words against this before invoking the FirstName-LastName regex.
export const SINGLE_WORD_ALLOWLIST: ReadonlySet<string> = new Set(
  [...PROPER_NOUN_ALLOWLIST].filter((s) => !s.includes(' ')),
);
