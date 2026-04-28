# Voice Exemplars — 28 and Three

These are user-marked sample pieces that establish the voice. The LLM sees these as few-shot examples on every authoring call.

When adding new exemplars: keep them short, specific, and pointed. The point is to show the *shape* of an argument, not to give the model an entire piece to imitate. 1–3 paragraphs per exemplar.

---

## Exemplar #1 — Opponent preview, pass-offense vs pass-defense

*User-approved 2026-04-26. Hypothetical Wk 8 NE @ BUF; numbers illustrative.*

> ## Pass-O vs Pass-D — Wk 8: NE @ BUF
>
> ### Setup
> The numbers say this is a bad matchup for New England. NE pass offense: −0.12 EPA/dropback (24th). BUF pass defense: −0.08 allowed (8th). On paper, edge BUF — but the way that edge gets pressed is the actual story.
>
> ### Signal
> Maye is league-average under pressure (12.4% pressure-to-sack rate). The number that should keep Vrabel awake is his EPA when blitzed: −0.31, second-worst among QBs with 100+ blitz dropbacks this season. He has not yet solved the post-snap puzzle of extra rusher, fewer windows, less time.
>
> That's the matchup. Buffalo blitzes 33% of dropbacks (5th-most), and McDermott has spent the last decade weaponizing exactly this kind of rookie soft spot. The OL holding up was last week's question; this week's question is whether Maye can read it pre-snap and get the ball out fast.
>
> ### Counterpoint
> Two things that flatter New England, both lifted from recent tape:
>
> 1. **Pop Douglas, the slot answer.** His slot rate has climbed to 71% over the last three games (48% Wk 1–4). Slot routes beat blitz looks because the timing is shorter; the throw arrives before the rusher does. NE saw the matchup coming.
> 2. **Play-action, the early-down lever.** NE play-action EPA is +0.18 (12th). BUF defends play-action at +0.04 (3rd-worst). One of the few spots where the staff can dictate, not react.
>
> ### What to watch
> - **First-half blitz rate.** If BUF opens >35%, Maye's clean-pocket throws — or lack of them — become the tell.
> - **Douglas target share.** Over 25% means NE built the gameplan around the slot.
> - **3rd-and-medium (5–7 yds).** NE 32% conversion, BUF 38% allowed. The most-leveraged down-distance bucket; the matchup probably turns here.
>
> The way to lose this game is to play it 1985-style — pocket throws, downfield routes, extended dropbacks. The way to win it is short, fast, structured. McDermott is daring Maye to be a rookie. The film says he should answer with the slot.

### What this exemplar teaches the model

- Lede sentence per section ("The numbers say this is a bad matchup for New England", "Two things that flatter New England", etc.) — not a restatement of the heading.
- Editorial frames: "the post-snap puzzle of extra rusher, fewer windows, less time"; "the staff can dictate, not react"; "1985-style". Concrete, specific, threaded through the argument.
- Each numeric is anchored to a rank or comparison — never bare.
- Counterpoint creates tension instead of a both-sides nod.
- Falsifiable closing thesis: "McDermott is daring Maye to be a rookie. The film says he should answer with the slot." A reader can check whether this was right after the game.
- No "execute at a high level", no "find a way", no "ultimately come down to".

---

## Counter-example — what the AI should NOT produce

*This is the failure mode. The hallucination guard does not catch this; only the operator + Phase 2.5 reader panel does.*

> When we look at the matchup between the Patriots offense and the Bills defense this week, there's certainly a lot to break down. New England has been struggling to find consistency in the passing game, and Buffalo has one of the better secondaries in the AFC. Drake Maye has shown flashes, but he'll need to be at his best to move the ball through the air. EPA per dropback for the Patriots sits at −0.12 on the season, while the Bills allow −0.08 to opposing offenses. Can New England find a way to establish the pass and control tempo? It's hard to say. Everything starts up front, and if the OL can give Maye time, there's a chance he can hit on some big plays. The Patriots will need to execute at a high level, especially on third down. Ultimately, this game could come down to who controls the line of scrimmage and minimizes mistakes in key situations.

### Why this is bad

- "When we look at the matchup..." — filler intro
- "Certainly", "you have to wonder", "it's hard to say" — hedging
- Long paragraphs without argument units
- Numbers listed with vague tie-ins ("EPA per dropback for the Patriots sits at...", no rank, no comparison)
- "Has shown flashes" — banned hedge
- Rhetorical questions ("Can New England find a way?")
- "Ultimately... this game could come down to..." — vague closing
- Could be written about literally any matchup. No specificity.
