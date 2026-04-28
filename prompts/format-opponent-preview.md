# Format spec — Opponent Preview (Wednesday, paid)

The Wednesday opponent preview is the format-and-depth flagship piece of the paid tier. It is **four phase-specific deep dives bundled as one email.**

## Total length

~1200–1600 words across four sections, ~300–400 words per section.

## Structure

The piece consists of four phase-specific sections in this order:

1. `## Pass-O vs Pass-D — Wk N: NE @ OPP` (or `vs OPP` for home)
2. `## Run-O vs Run-D — Wk N: NE @ OPP`
3. `## Pass-D vs Pass-O — Wk N: NE @ OPP`
4. `## Run-D vs Run-O — Wk N: NE @ OPP`

The week + opponent in the heading is parameterized; the rest is fixed.

## Per-section template

Every phase-specific section follows this exact four-subsection structure:

```markdown
### Setup
[1 paragraph, ~60–90 words. Lede sentence stating the section's thesis,
then the numerical anchor: NE rank in this phase vs. OPP rank in the
matched phase. Set up the question the section will answer.]

### Signal
[1–2 paragraphs, ~120–180 words. The dominant axis of the matchup,
identified by 1–2 specific stats. This is where the through-line begins.
Each numeric must be in the source data.]

### Counterpoint
[Bulleted list of 1–2 cuts that flatter NE (or that the analysis would
otherwise miss). Each bullet is one tight paragraph (~40–60 words).
Bold the lede phrase of each bullet.]

### What to watch
[Bulleted list of 3 testable in-game signals. Each line: a bold metric
name, then a thesis on what to look for. Below the list, a 2–3 sentence
closing thesis that synthesizes the section into a strategic frame.
Falsifiable. No vague predictions.]
```

## Hard constraints

- Heading levels: `## ` for section, `### ` for subsection. Never `# `.
- Real minus sign U+2212 ("−") for negative deltas.
- Each numeric anchored to a rank or comparison — bare numbers banned.
- No links inside Setup or Signal. Counterpoint and What to watch may include dashboard links.
- The closing thesis (last 2–3 sentences of "What to watch") must be falsifiable. A reader could check whether the thesis was right after the game.

## Length budgets per subsection

Soft, but anything more than ±15% over the budget is too long.

| Subsection | Words |
|---|---|
| Setup | 60–90 |
| Signal | 120–180 |
| Counterpoint | 80–120 (1–2 bullets, ~40–60 each) |
| What to watch | 100–140 (3 bullets + 2–3 sentence thesis) |
| **Section total** | **360–530** |
| **Bundle total (4 sections)** | **1440–2120** |

The bundle total is allowed to drift below 1200 if a phase has insufficient data — output the section heading and `*Insufficient data this week.*` for that subsection.

## What goes in each subsection

### Setup
- The lede sentence. State the section's thesis.
- Numerical anchor: `NE pass offense: −0.12 EPA/dropback (24th). BUF pass defense: −0.08 allowed (8th).`
- Set up the question. "On paper, edge BUF — but the way that edge gets pressed is the actual story."

### Signal
- The dominant axis. Identify *which* aspect of the matchup matters most this week.
- 1–2 specific stats with rank. Tie them to a story ("Maye is league-average under pressure. The number that should keep Vrabel awake is...").
- An editorial frame ("the post-snap puzzle of extra rusher, fewer windows, less time").

### Counterpoint
- 1–2 cuts that flatter NE or undermine the Setup thesis.
- Each cut is a specific stat or trend — not a vibe.
- Bold the lede phrase of each bullet for scanability.

### What to watch
- 3 in-game signals that will tell us whether the thesis held.
- Each is a metric we will be able to check live or post-game.
- Below the bullets: 2–3 sentence closing thesis. The thesis names a strategic decision-point and offers a hypothesis. Falsifiable.

## Section ordering rationale

Pass-O before Run-O: pass game is dominant for modern NFL; opens with the most leveraged matchup.

Phase-D after both Phase-O sections: the symmetry teaches the reader to read both sides of each phase.

## Voice exemplar

See `prompts/voice-exemplars.md` § Exemplar #1 for a fully-realized Pass-O vs Pass-D section.
