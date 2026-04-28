# Format spec — Sunday Recap (free + paid)

The Sunday recap is the free-tier audience builder + paid-tier weekly anchor. Same content for both tiers in v1.

## Total length

~900–1100 words across six sections.

## Structure

The piece consists of six standardized sections in this fixed order:

```markdown
# Wk N: NE [W|L|T] OPP, score-home–score-away

## 1. Score and what mattered
## 2. Phase grades
## 3. Three things that worked
## 4. Three things that didn't
## 5. What changed in the rankings
## 6. Next week's frame
```

The H1 is the only place a `# ` heading appears in any content type.

## Per-section template

### 1. Score and what mattered
~150 words. What the box score doesn't say. One paragraph framing the structural story of the game (e.g., "the OL held up but the third-down package didn't"). Lede sentence states the thesis. End with the win-probability inflection point or the play that decided it (with the specific quarter/down/distance).

### 2. Phase grades
~120 words. Six grades in a markdown table:

```markdown
| Phase | Grade | EPA/play | League avg |
|---|---|---|---|
| Pass-O | A− | +0.18 | +0.05 |
| Run-O | C | −0.02 | −0.04 |
| Pass-D | B+ | −0.12 | +0.05 |
| Run-D | C+ | +0.01 | −0.04 |
| Special teams | C | −0.10 | 0.00 |
```

After the table, 1–2 sentences of context per outlier (anything ≥ ±2 grades from C). No commentary on grades that landed neutral.

### 3. Three things that worked
~200 words. Numbered list, exactly three items. Each: bold lede phrase, then a 2–3 sentence specific play or trend with EPA contribution. Drives the through-line of the recap (paired against §4).

### 4. Three things that didn't
~200 words. Same shape as §3, exactly three items.

### 5. What changed in the rankings
~150 words. Ranks that moved this week (offensive or defensive, by phase). Bullet list. Each bullet: bold rank delta + the cause. Rank moves of <2 positions are not worth listing (omit them).

### 6. Next week's frame
~130 words. One paragraph framing what to watch next. Names the next opponent, the most-leveraged matchup heading in, and a specific question the next preview will answer. Falsifiable in the sense that the next preview can validate or contradict the framing.

## Hard constraints

- H1 only at the top, with score. H2 for the six sections. No H3 in this content type.
- Real minus sign U+2212 ("−") for negative deltas.
- Every numeric tied to source data.
- No links in §1, §2, or §6. §3, §4, §5 may include dashboard links.
- §3 and §4 must be exactly three items each. Not two, not four.
- §5 may have zero items if no significant rank moves; in that case render `*No significant rank changes this week.*` and skip the bullet list.

## Length budgets per section

| Section | Words |
|---|---|
| 1. Score and what mattered | 130–170 |
| 2. Phase grades | 100–140 |
| 3. Three things that worked | 180–220 |
| 4. Three things that didn't | 180–220 |
| 5. What changed in the rankings | 130–170 |
| 6. Next week's frame | 110–150 |
| **Total** | **830–1090** |

## Voice exemplar

The opponent-preview exemplar in `prompts/voice-exemplars.md` is the canonical voice reference. A recap-specific exemplar is added in L1-03 (post-dogfood phase).
