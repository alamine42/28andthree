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
`28 and Three` — Cabinet Grotesk Bold. The word **and** is set italic (regular weight) in `--positive` (amber). This is the only styled departure in the mark and it ties every page back to the name's origin. Never replace the amber "and" with another color. The mark never sits on a Patriots logo.

## Color

- **Approach:** Restrained. One accent (Pats red), one distinctive positive signal (amber), neutrals for everything else.
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
| `--accent` | `#D21F3C` | Patriots red, desaturated for dark bg. **Used rarely** — live indicators, primary CTAs, critical alerts. |
| `--accent-dim` | `#A23A4A` | Accent borders, hover states. |
| `--positive` | `#E0B44A` | **Amber/gold.** Replaces green for "up / ranked well / improving." Trophy/terminal/scoreboard associations. |
| `--positive-dim` | `#8B6F2E` | Positive borders on badges. |
| `--negative` | `#A23A4A` | Down trends, bottom-tier ranks. Muted cranberry, not screaming red. |
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
| `--positive` | `#8A6B1F` |
| `--negative` | `#8A2238` |

### Semantic mapping
- Better-than-average, rank top-10, up-trend → `--positive`
- Worse-than-average, rank bottom-10, down-trend → `--negative`
- Neutral (middle 12 ranks, no change) → `--text-muted` or `--chart-neutral`
- Never use green for positive. The amber choice is deliberate and category-differentiating.

## Spacing
- **Base unit:** 4px.
- **Density:** Compact. Analyst-tool density — this is not a consumer app.
- **Scale:** 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 120.
- **Section rhythm:** 120px between top-level sections. 40px within section before content.
- **Table row padding:** 18px vertical, 16px horizontal.
- **Card padding:** 24–28px.

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

- **Rank card:** phase name (mono, muted, uppercase) → big numeric rank in Cabinet Grotesk Bold (colored by tier: top-third amber, middle neutral, bottom-third cranberry) → sparkline → hairline divider → metric name + value in mono.
- **Stat block:** label in mono uppercase (`--text-muted`) → value in Cabinet Grotesk Bold (30–56px) → context line in mono.
- **Table:** mono uppercase headers, muted. Mono numeric cells right-aligned. Geist left-aligned cells for names. Hover fills the row with `--surface`.
- **Rank badge:** mono 11px, tracked +0.08em, bordered pill. `.top` gets positive color, `.bot` gets negative, default is muted.
- **Delta:** mono 11px, `▲` / `▼` glyph prefix, positive/negative color by sign.
- **Buttons:** primary = solid `--accent`, secondary = ghost with `--border-strong`, ghost = text-only `--text-muted` hovering to `--text`. Small radius (2px), never pill.
- **Callout:** `--surface` bg with 2px `--positive` left border, no icon, no color flood. Reserved for methodology notes and data-integrity callouts.
- **Live dot:** 6px circle, `--positive` bg, 2s pulse animation.

## Content conventions
- **Numerics:** always tabular-nums. Always signed for deltas and EPA (`+0.08`, `−0.02`). Use the real minus sign `−` (U+2212) not hyphen.
- **Ranks:** two-digit zero-padded when displayed large (`04`, not `4`). One-digit in inline text.
- **Percentages:** no space before `%` (`58%`).
- **Dates:** `Tue 10:06 AM ET` or `Wk 14 · 2025`. Lean terminal-style.
- **Copy voice:** terse, specific, no exclamation points, no hype. The data does the talking.

## Anti-patterns (do not ship)
- Green for "up/good." We use amber.
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
| 2026-04-14 | Amber-for-positive instead of green | Terminal/trophy/scoreboard associations; category-distinctive; ties to the site's comeback-score name. |
| 2026-04-14 | All-sans typography (Cabinet Grotesk + Geist) | Serif-based display tried in v1 preview; read as too dense. All-sans with breathing room landed better. |
| 2026-04-14 | Deep ink navy `#0B1520` instead of pure black | Quiet Patriots reference without uniform-cosplay; gentler on eyes for long tables. |
