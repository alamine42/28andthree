---
title: "display: contents on a <Link> wrapper hides its focus ring"
category: "gotchas"
date: "2026-04-18"
tags: [a11y, wcag, tailwind, next-link, focus-visible]
files: [components/TopContributorCard.tsx]
---

# `<Link className="contents">` strips the focus-visible outline (WCAG 2.4.7)

## Problem

`TopContributorCard` wrapped a styled flex container in a `next/link`
whose `className` was `"contents"` so that the child div could own all
the visual layout. The child had the `focus-visible:outline-*` classes.
Tabbing to the card showed no focus ring at all — the component looked
unfocusable even though the anchor was in the tab order. Axe flagged it
as a WCAG 2.4.7 (Focus Visible) violation.

## Root Cause

`display: contents` removes the element's own box from the render tree
while keeping its children. Two consequences:

1. The focusable element (the `<a>`) has **no visual box**, so any
   styles applied to it — including browser-default or Tailwind
   `focus-visible:outline` — have nowhere to paint.
2. Putting `focus-visible:*` classes on a *child* of the anchor doesn't
   help: `focus-visible` only triggers on the focused element itself
   (and in limited cases via `:focus-within`, which Tailwind exposes
   separately). The child isn't focused; the anchor is.

Result: keyboard users can tab through the card with no visual feedback.
Screen-reader users are fine (the link is announced), but sighted
keyboard users are shut out — exactly the population WCAG 2.4.7 protects.

## Solution

Move focus/hover styles onto the **actual focusable element** and drop
`display: contents`. For cards that sometimes aren't clickable, branch
on the href and render a plain `<div>` in the non-clickable case so
the class list can stay identical:

```tsx
const shared =
  'flex flex-col items-start gap-3 bg-bg p-5 transition-colors ' +
  'hover:bg-surface focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-positive';

if (href === '#') {
  return <div className={shared}>{Body}</div>;
}
return <Link href={href} className={shared}>{Body}</Link>;
```

The `<a>` now has its own box and paints the amber 2px outline on
keyboard focus. Axe passes; manual tab test confirms visible ring.

## Prevention

- **Never pair `display: contents` with a focusable element.** If you
  need the anchor to be "invisible" structurally, the answer is a
  different layout (grid children, `position: absolute` stretched link),
  not `contents`.
- **Axe smoke test every new clickable component.** Our Playwright
  `@axe-core/playwright` sweep catches this class of bug at build time —
  add the page to `tests/e2e/a11y.spec.ts` before shipping any new
  interactive card.
- **Tab through it yourself.** One second of manual keyboard testing
  catches this even without axe.

## Related

- `components/TopContributorCard.tsx` — post-fix version
- `tests/e2e/a11y.spec.ts` — axe sweep that would catch a regression
- WCAG 2.4.7 (Focus Visible, Level AA)
- MDN: [display: contents accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/display#accessibility_concerns)
