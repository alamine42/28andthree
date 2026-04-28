# Authoring Conventions — 28 and Three

This is the long-form voice + content guideline document for AI-generated newsletter content. It is loaded verbatim into the system prompt of every authoring call, alongside `DESIGN.md` (typography + color) and `CLAUDE.md` (project conventions).

## Voice

The voice is **format-and-depth with a narrative through-line.** Calibrated against voice exemplars in `prompts/voice-exemplars.md`. The discipline:

### Each section has a lede sentence

A lede sentence states the section's thesis, not a restatement of the heading. "Setup" should not start with "In the setup section..." It should start with the *claim* the setup is making.

### Connective tissue, not transition words

Paragraphs connect by causation or implication, not by phrases like *Furthermore*, *Additionally*, *Moreover*, *In addition*, *Also worth noting*. Those are filler. The next paragraph should follow because the previous one made it necessary.

### Editorial frames carry the through-line

A frame is a phrase that names a tension. "The post-snap puzzle of extra rusher, fewer windows, less time" is a frame. "The staff can dictate, not react" is a frame. They are concrete, specific, and they make subsequent claims feel inevitable rather than randomly assembled.

### Falsifiable closing thesis

A section closes by synthesizing what came before into a strategic hypothesis grounded in the prior claims. Not a vague prediction.

- ✓ "McDermott is daring Maye to be a rookie. The film says he should answer with the slot."
- ✗ "It will come down to who controls the line of scrimmage and minimizes mistakes."
- ✗ "The Patriots will need to execute at a high level."

Falsifiable means: a reader could check whether the hypothesis was right after the game.

### Numbers are tied to claims

Every numeric token in the output must appear in the structured input. Every claim of league rank ("24th", "8th") must be derivable from source. The hallucination guard (`lib/authoring/factcheck.ts`) enforces this; the voice rule is that we don't even draft a number we can't source.

## Banned phrasings

The hallucination guard does not catch these — they are voice failures, not factual ones. The Phase 2.5 quality gate is the human catch.

- "Certainly", "potentially", "arguably" — hedging adverbs
- "You have to wonder", "you might think" — second-person hedge
- "Can the Patriots find a way?" — rhetorical questions
- "Establish the run", "execute at a high level", "win in the trenches" — football clichés
- "Ultimately", "at the end of the day", "when all is said and done" — vague closings
- "Furthermore", "Additionally", "Moreover" — transition filler
- "Has shown flashes" — anything-goes hedge
- Exclamation points — the data does the talking

## Numeric conventions (mirrors `DESIGN.md`)

- Tabular numerics with units always
- Real minus sign (U+2212, "−") not hyphen
- Signed deltas: `+0.08`, `−0.02`
- Percentages: `58%` (no space)
- Ranks: ordinal suffix (`1st`, `12th`, `22nd`, `32nd`)

## Section structure per content type

Format specs live in `prompts/format-<content_type>.md`. The format spec is the source of truth; the prompt template implements it. To change a section heading, edit the format spec and regenerate prompts; do not edit prompts directly.

### Opponent preview (Wednesday, paid)

Four phase-specific sections, bundled as one piece (~1200–1600 words total):
1. **Pass-O vs Pass-D** — ~300–400 words, Setup/Signal/Counterpoint/What to watch
2. **Run-O vs Run-D** — ~300–400 words, same structure
3. **Pass-D vs Pass-O** — ~300–400 words, same structure
4. **Run-D vs Run-O** — ~300–400 words, same structure

Each phase section follows the locked Setup-Signal-Counterpoint-What-to-watch template (see `prompts/format-opponent-preview.md`).

### Sunday recap (free + paid)

Six standardized sections (~1000 words total):
1. **Score and what mattered** — what the box score doesn't say
2. **Phase grades** — pass-O / run-O / pass-D / run-D / special-teams in a table
3. **Three things that worked** — specific plays + EPA contribution
4. **Three things that didn't** — specific plays + EPA cost
5. **What changed in the rankings** — ranks moved this week + why
6. **Next week's frame** — one paragraph framing what to watch next

See `prompts/format-recap.md`.

### Other content types

Defined as we ship them. Each new content type requires its own format spec doc.

## Editorial review checklist

Before approving a draft, the operator should verify:

- [ ] Every numeric matches source (factcheck guard does this automatically; check the bar is green)
- [ ] No banned phrasings (voice guard is the human; scan for them)
- [ ] Each section has a real lede sentence (not a heading restatement)
- [ ] Each section closes with a falsifiable thesis (or is explicitly framed as a question with a hypothesis offered)
- [ ] No filler paragraphs (each paragraph either advances a claim or is cut)
- [ ] Length matches the format spec budget (±10%)
- [ ] One link per claim that asserts a stat — link to the dashboard cell

If anything fails: regenerate the section (editor has per-section regenerate) or hand-edit the markdown directly.
