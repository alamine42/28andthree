# Design System — 28 and Three

## Product Context
- **What this is:** An advanced analytics web app for New England Patriots fans, covering team- and player-level EPA / CPOE / PFF-style metrics, comparative league rankings across phases of play, draft ROI, and coaching tendencies.
- **Who it's for:** Hardcore analytics-literate Patriots fans. People who read the box score twice.
- **Space/industry:** Sports analytics (NFL). Peers: FTN, Sumer Sports, rbsdm, Football Outsiders, Pro Football Reference.
- **Project type:** Data-dense web app with editorial marketing pages. Dashboard + article hybrid.

## Aesthetic Direction
- **Direction:** Analyst-terminal editorial. Bloomberg-terminal density meets sports-desk back-page. Not "fan blog," not "enterprise dashboard" — a specialist's instrument.
- **Decoration level:** Minimal-intentional. No gradients, no patterns, no illustrations, no stock photography. The decoration IS the typography and the data.
- **Mood:** Serious. Considered. Quiet confidence. The site is named after a historic comeback — the design carries that weight without being sentimental.
- **Reference sites:** sumersports.com (premium dark), rbsdm.com (chart-legibility gold standard), FTN (tabular density), Pro Football Reference (utilitarian data).

## Typography
- **Display:** Cabinet Grotesk Bold — wordmark, hero, section heads, stat values. Geometric modern grotesk, confident at large sizes, not overused in this category.
- **Body / UI:** Geist — 15px body at line-height 1.7. Current best-in-class neutral sans, designed for numerical UI.
- **Data / Tables:** Geist Mono — tabular-nums on. All ranks, EPA values, times, deltas.
- **Code (documentation):** Geist Mono.
- **Loading:**
  - Cabinet Grotesk via Fontshare: `https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&display=swap`
  - Geist + Geist Mono via Google Fonts.
- **Scale (px):** `text-2xs` 11 / `xs` 12 / `sm` 13 / `base` 15 / `lg` 18 / `xl` 22 / `2xl` 30 / `3xl` 36 / `display` 56 / `hero` 72–88 (responsive).
- **Letter-spacing:** Display `-0.015em` to `-0.025em` at hero sizes; body `+0.005em`; uppercase mono labels `+0.14em`.
- **Line-height:** body 1.7, display 1.02–1.1, mono 1.9.

### Wordmark
`28 and Three` — Cabinet Grotesk Bold. The word **and** is set italic (regular weight) in `--positive` (green). This is the only styled departure in the mark and it ties every page back to the positive signal used everywhere else on the site. The mark never sits on a Patriots logo.

## Color

- **Approach:** Restrained. One accent (Pats red), one positive signal (green), neutrals for everything else.
- **Dark is default.** Light mode is optional and redesigned, not a simple invert.

### Dark mode (default)
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0B1520` | Page background. Deep ink navy, subtly on-brand without uniform-cosplay. |
| `--surface` | `#121E2B` | Cards, table rows on hover, panels. |
| `--surface-2` | `#19273A` | Elevated surfaces, dropdowns. |
| `--border` | `#1F2D3D` | Default borders, table row separators. |
| `--border-strong` | `#2C3E55` | Emphasized borders, header separators. |
| `--text` | `#E8E6E1` | Primary text. Warm bone, never pure white. |
| `--text-muted` | `#8A96A3` | Labels, metadata, secondary. |
| `--text-dim` | `#5F6E80` | Tertiary, disclaimers. |
| `--accent` | `#C81E36` | Patriots red, tuned for dark bg. **Background pairings only** (CTA buttons, live-indicator dot fill) — `text-text` on `bg-accent` lands at 4.56:1 (AA Normal). Do not use as a text color: against `--bg` it sits at 3.23:1 (AA-Large only). |
| `--accent-dim` | `#A23A4A` | Button hover (`bg-accent-dim` + `text-text` = 5.20:1), accent borders. Background-only, same rules as `--accent`. |
| `--positive` | `#1ABE58` | **Green.** "Up / ranked well / improving." Muted editorial green — not neon. Luminance tuned to pass WCAG AA Normal (4.5:1) on *both* `--bg` (7.3:1) and `--surface` (6.0:1), so positive text stays readable in card-hover + nested-card contexts. |
| `--positive-dim` | `#0E5E2A` | Positive borders on badges. |
| `--negative` | `#D9707F` | Down trends, bottom-tier ranks. Muted cranberry-pink (lightened from `#A23A4A` to clear WCAG AA Normal as text). 5.76:1 on `--bg`, 5.28:1 on `--surface`, 4.72:1 on `--surface-2`. Use freely as text or border; for `bg-negative` pair with `text-bg`, not `text-text`. |
| `--chart-neutral` | `#5F6E80` | League median lines, neutral series in charts. |

### Light mode
Redesigned surfaces, not inverted. Reduces saturation on accents by ~15%.
| Token | Hex |
|---|---|
| `--bg` | `#F6F4EE` (warm paper) |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#ECE8DE` |
| `--border` | `#D9D3C4` |
| `--border-strong` | `#B8AF99` |
| `--text` | `#0B1520` |
| `--text-muted` | `#4D5A6B` |
| `--text-dim` | `#7B8594` |
| `--accent` | `#B0152D` |
| `--positive` | `#0E6B2F` |
| `--negative` | `#8A2238` |

### Semantic mapping
- Better-than-average, rank top-10, up-trend → `--positive`
- Worse-than-average, rank bottom-10, down-trend → `--negative`
- Neutral (middle 12 ranks, no change) → `--text-muted` or `--chart-neutral`
- We use green for positive. The shade is a muted editorial green (`#1ABE58` on dark bg, `#0E6B2F` on warm paper); not neon, not sports-fluorescent.

## Spacing
- **Base unit:** 4px.
- **Density:** Dense. Analyst-tool density — this is not a consumer app, and the home page in particular should read like a Bloomberg terminal rather than a marketing site.
- **Scale:** 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 60 / 80 / 120.
- **Section rhythm:** 60px between top-level sections on data-dense pages (home, phase detail, coaching, draft). 120px reserved for editorial / about pages. 40px within section before content.
- **Table row padding:** 12–18px vertical, 16px horizontal.
- **Card padding:** 16–20px standard; 24–28px only for hero-level cards.

## Layout
- **Approach:** Hybrid. Editorial for team overview, phase intros, and marketing / about pages (asymmetric, generous whitespace, big display type). Grid-disciplined for tables, dashboards, player pages, draft ROI.
- **Grid:** 12-col at ≥1024px. 6-col at 640–1023. Single-col below 640.
- **Max content width:** 1240px. Tables may extend wider with horizontal scroll on small screens.
- **Border radius:** 2px default (`--radius-sm`). 4px for card groupings (`--radius-md`). 9999px for pills only. No uniform bubbly radii — this is not a toy UI.
- **Phase-rank grids, QB stat grids:** 1px gap over a border background (creates flat hairline dividers without double-borders).

## Motion
- **Approach:** Minimal-functional. No entrance animations, no scroll choreography, no bounces.
- **Easing:** `ease-out` for entering, `ease-in` for exiting, `cubic-bezier(0.16, 1, 0.3, 1)` for transforms.
- **Duration:** micro 100ms (hover color change) / short 150–250ms (buttons, toggles) / medium 250–400ms (theme change) / no long-duration animations.
- **Pulse animation** is allowed only for the "live data fresh" dot in the footer.

## Components (conventions)

- **Rank card:** phase name (mono, muted, uppercase) → big numeric rank in Cabinet Grotesk Bold (colored by tier: top-third green, middle neutral, bottom-third cranberry) → sparkline → hairline divider → metric name + value in mono.
- **Stat block:** label in mono uppercase (`--text-muted`) → value in Cabinet Grotesk Bold (30–56px) → context line in mono.
- **Table:** mono uppercase headers, muted. Mono numeric cells right-aligned. Geist left-aligned cells for names. Hover fills the row with `--surface`.
- **Rank badge:** mono 11px, tracked +0.08em, bordered pill. `.top` gets positive color, `.bot` gets negative, default is muted.
- **Delta:** mono 11px, `▲` / `▼` glyph prefix, positive/negative color by sign.
- **Buttons:** primary = solid `--accent`, secondary = ghost with `--border-strong`, ghost = text-only `--text-muted` hovering to `--text`. Small radius (2px), never pill.
- **Callout:** `--surface` bg with 2px `--positive` left border, no icon, no color flood. Reserved for methodology notes and data-integrity callouts.
- **Live dot:** 6px circle, `--positive` bg, 2s pulse animation.
- **Season switcher (header):** mono 11px bordered pill (`--border-strong`, 2px radius), season number + caret. Border and text flip to `--positive`/`--text` while a past season is in view. Menu is a `--surface-2` disclosure of links (newest first, `CURRENT`/`FINAL` status column); items ≥40px tall.
- **Historical marker:** mono 11px bordered chip `HISTORICAL · {year}` + underlined "Back to {current}" link, in the page-header block of season-scoped pages. Never render historical data without it.

## Content conventions
- **Numerics:** always tabular-nums. Always signed for deltas and EPA (`+0.08`, `−0.02`). Use the real minus sign `−` (U+2212) not hyphen.
- **Ranks:** English ordinal suffix (`1st`, `12th`, `22nd`, `32nd`). The teen exceptions (11/12/13) take `th` regardless of last digit. `formatRank()` is the single source of truth.
- **Percentages:** no space before `%` (`58%`).
- **Dates:** `Tue 10:06 AM ET` or `Wk 14 · 2025`. Lean terminal-style.
- **Copy voice:** terse, specific, no exclamation points, no hype. The data does the talking.

## Anti-patterns (do not ship)
- Neon or sports-fluorescent green for "up/good." Our positive green is `#1ABE58` — muted, editorial.
- Amber/gold anywhere as a positive signal. That was the original call; we reversed it 2026-04-21 (see Decisions Log).
- Pure-white text on pure-black bg. We use bone on deep ink.
- Uniform rounded-corners everywhere. We use 2px default.
- Purple or violet anywhere on the site.
- Gradient buttons, gradient hero backgrounds, gradient anything.
- Stock photography, 3D renders, illustrated mascots.
- Emoji in UI (acceptable in editorial/article copy only if quoted).
- Inter, Roboto, Arial, Helvetica, Montserrat, Poppins as primary fonts.
- NFL or Patriots logos, team wordmarks, or uniform imagery in site chrome.

## Footer / Disclaimer
Every page must include a disclaimer in the footer:

> 28 and Three — Independent fan project. Not affiliated with, endorsed by, or sponsored by the New England Patriots, the NFL, or any of its teams.

Set in Geist Mono 11px, `--text-muted`, uppercase, tracked +0.14em.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-14 | Initial design system created | From /design-consultation. Research references: sumersports.com, rbsdm.com, NGS. Category synthesis + first-principles fit for "fan instrument for a historic franchise." |
| 2026-04-14 | Amber-for-positive instead of green | Terminal/trophy/scoreboard associations; category-distinctive; ties to the site's comeback-score name. **Reversed 2026-04-21 — see below.** |
| 2026-04-14 | All-sans typography (Cabinet Grotesk + Geist) | Serif-based display tried in v1 preview; read as too dense. All-sans with breathing room landed better. |
| 2026-04-14 | Deep ink navy `#0B1520` instead of pure black | Quiet Patriots reference without uniform-cosplay; gentler on eyes for long tables. |
| 2026-04-21 | Green-for-positive (`#1ABE58`) replaces amber | User preference after living with the site for a week: amber read as alert/warning in adjacent-context glances (ESPN-like). Green is the audience's default expectation for "good" in sports analytics; the visual cost of being less category-distinctive is worth the cognitive-load saving. Shade chosen muted (`#1ABE58` on dark bg, 6.0:1 AA; `#0E6B2F` on warm paper) so it reads editorial rather than neon. Wordmark "and" flips to green too. |
| 2026-04-21 | Density increased across home + phase + coaching + draft | Section gap 120→60px, card padding 24-28→16-20px, phase-card min-height 148-172→100-120px. Dense/analyst-terminal read vs. marketing-site breathing room. Editorial pages (methodology, future about) keep the 120px rhythm. |
| 2026-04-21 | Rank format: ordinal suffix (`1st`, `22nd`) instead of zero-pad (`01`, `22`) | Fans scan league rankings with natural-language ordinals. Zero-pad was a terminal-density stylistic choice that read as "database key" rather than "standing". Ordinal suffix keeps monospace tabular-nums alignment (all strings are 3–4 chars) while reading like a sports-page ranking. |
| 2026-04-21 | Phase-card: sparkline inline with rank | Column stack (label → rank → sparkline → EPA) spent a full row on a 20px-tall trend chart. Inlining the sparkline to the right of the rank saves ~25% card height while keeping the trend glanceable. Home page at 11 such cards drops measurably in vertical scroll. |
| 2026-04-26 | `--accent` darkened (`#D21F3C`→`#C81E36`); `--negative` lightened (`#A23A4A`→`#D9707F`) | Codex E9 adversarial review (bd-2w1): old values failed WCAG AA on dark surfaces — accent at 3.50:1 on `--bg`, negative at 2.84:1. The two tokens have opposing constraints on a dark UI: `--accent` lives under `text-text` overlays (so it must stay *darker* than the bone text — 4.56:1 with bone on top), while `--negative` is used *as* text (so it must stay *lighter* than `--bg` — 5.76:1). Resolving both pulled the colors apart hue/luminance-wise; they are no longer the same hex. Usage rule: `--accent` is background/border only, `--negative` is freely usable as text. |
| 2026-08-25 | Historical season browsing: header switcher pill + `?season=` URLs | E11. Variant B UI (one consistent header spot on every screen) chosen over eyebrow-inline control after three prototype rounds; URL params over a cookie so views stay shareable/cacheable (cookie kills shared-cache keying). Menu items are links, not buttons — open-in-new-tab is the era-comparison affordance. See docs/plans/e11-historical-seasons-plan.md. |
