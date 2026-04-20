---
title: "Tailwind display utilities silently override the HTML `hidden` attribute"
category: "gotchas"
date: "2026-04-20"
tags: [tailwind, a11y, css, specificity, hidden]
files: [components/players/PlayerSearch.tsx]
---

# `hidden={!open}` on a `flex` element doesn't actually hide it

## Problem

E7 Players Hub combobox: the listbox `<ul role="listbox">` carried both the
`hidden` attribute (tied to React state — `hidden={!open || matches.length === 0}`)
and Tailwind classes `flex flex-col gap-px ...` for the layout when open.

Three E2E tests failed that all traced back to the same symptom: the listbox
stayed visually open after pressing Escape, after Enter-navigating, after the
query cleared. `toBeHidden()` reported "visible" even though the DOM clearly
had `hidden=""` set.

## Root Cause

The UA default stylesheet contains:

```css
[hidden] { display: none; }
```

Tailwind's `flex` utility compiles to:

```css
.flex { display: flex; }
```

`.flex` and `[hidden]` have **equal specificity** — both are one class/attribute
selector — so the rule declared later wins. Tailwind's preflight + generated
utilities load **after** the UA stylesheet, so `.flex` always beats `[hidden]`
when both apply to the same element.

Result: every `<div className="flex" hidden={condition}>` renders visible
regardless of the `hidden` prop. React dutifully sets the attribute; CSS
ignores it.

## Solution

**Conditionally render the element** instead of relying on the `hidden`
attribute when any Tailwind display utility is in play.

```tsx
// Broken — .flex wins, element is always visible
<ul hidden={!open} className="flex flex-col …">…</ul>

// Fixed — element is unmounted when closed
{open ? <ul className="flex flex-col …">…</ul> : null}
```

Unmounting also avoids a subtler ARIA bug: an `aria-activedescendant` reference
pointing at a `<li>` inside a "hidden" but still-present listbox is a dangling
reference that some screen readers still announce.

## Alternative fixes (when unmount is expensive)

- **Switch to `hidden:hidden` Tailwind variant** when supported by your setup
  (`<ul className="flex hidden:hidden" hidden={!open}>`). Requires Tailwind 3.4+.
- **Use `data-open={open}` + conditional classes**:
  `className={open ? 'flex ...' : 'hidden'}`. The `.hidden { display: none }`
  utility beats `.flex` only if declared later — Tailwind's preflight usually
  orders them such that `hidden` comes after display utilities, so this works,
  but it's fragile.
- **Compose with `sr-only` for SR-visible but visually-hidden content**. Not
  applicable to true dismissal.

Conditional rendering is the cleanest default.

## Prevention

- **Audit every element that uses both the `hidden` prop and any Tailwind
  display utility** (`flex`, `grid`, `block`, `inline-flex`, etc.). If both
  are present, pick one mechanism.
- **Prefer conditional rendering** over `hidden` for dismissable UI: less
  DOM, no zombie aria refs, no specificity traps.
- **Axe catches some cases** (aria-hidden on focusable descendants), but
  does NOT catch `display: none` + `hidden` attribute collisions because the
  element renders as visible — axe sees it correctly from the DOM/CSSOM.
  Only E2E visual assertions catch this class of bug.

## Related

- `components/players/PlayerSearch.tsx` — post-fix conditional render pattern
- `tests/e2e/e7.spec.ts` — three tests that initially failed, all passed after the fix
- MDN: [`[hidden]` specificity](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden#hiding_elements)
