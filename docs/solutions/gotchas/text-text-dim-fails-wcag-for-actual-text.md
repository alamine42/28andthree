# `text-text-dim` fails WCAG AA — use it for chart fills only, not text

## Symptom

Axe flags a `color-contrast` violation on a page that uses `text-text-dim` for
small mono text (labels, captions, hints). Contrast ratio is ~3.1:1 on
`--surface` and ~3.3:1 on `--bg` — both below the 4.5:1 AA threshold for normal
text.

```
[serious] color-contrast: Elements must meet minimum color contrast ratio thresholds
```

## Why

Design tokens in `app/globals.css`:

- `--text-dim` = `#5F6E80` (luminance ~0.14)
- `--bg` = `#0B1520` (luminance ~0.007)
- `--surface` = `#121E2B` (luminance ~0.011)

`text-dim` on `surface` is 3.11:1. `text-dim` on `bg` is 3.33:1. Both pass WCAG
AA *Large* (3:1 for ≥24px text or ≥18.67px bold), but fail AA *Normal* (4.5:1).

Everything in the app uses the site's mono eyebrow size — `text-2xs` (11px) or
`text-xs` (12px) — which is normal text by WCAG definition.

## Convention

**Only one correct use of `text-text-dim` in this codebase:** SVG chart fills
and strokes where the element is `aria-hidden` or decorative.

```tsx
// ✅ OK — chart stroke, not text
<line className="fill-current text-text-dim" />
```

**For text use `text-text-muted` instead** (`#8A96A3` at 5.25:1 on surface, 6.10:1
on bg — passes AA).

```tsx
// ❌ axe will flag
<p className="font-mono text-2xs text-text-dim">caption</p>

// ✅ passes AA
<p className="font-mono text-2xs text-text-muted">caption</p>
```

## Related

- `lib/color/rank.ts` top comment: ranks route negative-tier through adjacent
  sparkline, not text color, for the same reason (`--negative` is 2.84:1).
- `DESIGN.md` tokens table marks `--text-dim` as "tertiary, disclaimers" —
  interpret that literally as footer disclaimers that are large-enough text,
  not mono caption lines.

## Discovered

2026-04-20 during E5 /fullreview when axe flagged `/draft-roi` + `/coaching`
after a new empty-state card used `text-text-dim` for a mono caption. Fixed by
sweeping all `text-text-dim` text usages in new components to `text-text-muted`.
