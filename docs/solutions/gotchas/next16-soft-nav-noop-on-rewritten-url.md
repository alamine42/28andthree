---
title: "Next 16 silently no-ops soft navigation from a rewritten URL to its clean pathname"
category: "gotchas"
date: "2026-08-25"
tags: [next16, app-router, link, rewrite, middleware, e2e, flaky]
files:
  - components/HistoricalMarker.tsx
  - components/SeasonSwitcher.tsx
  - lib/season-view.ts
---

# Next 16 silently no-ops soft navigation from a rewritten URL to its clean pathname

## Symptom

On `/?season=2023` (middleware-rewritten to `/s/2023`), clicking a
`<Link href="/">` does nothing: no request, no URL change, no error.
Navigation to a *different* pathname works; a hard navigation
(`location.href`) works. The e2e test for this ("back to current") had
passed earlier — because the click sometimes landed before hydration,
when the anchor was still a plain link and hard-navigated. A
hydration-timing race masquerading as a green test.

## Root cause

App-router soft navigation from a rewritten `?season=` URL to the same
pathname's clean URL is treated as a same-URL no-op by the Next 16
client router (the target resolves to the same cache node and the URL is
never pushed).

## Fix (E11 code review pass 2 follow-through)

Back-to-current targets render as plain `<a>` anchors, not `<Link>`:
the HistoricalMarker's "Back to {current}" link and the SeasonSwitcher's
current-season menu item. A real browser navigation always lands; the
cost is one full page load on an action that changes the entire page
anyway.

## Lessons

- A UI test that depends on click-vs-hydration timing can pass for the
  wrong reason. When a navigation test flakes, trace with
  `page.on('request')` — zero events after a click means the router
  swallowed it, not that the server misbehaved.
- Anywhere a middleware rewrite serves the same pathname under different
  query params, treat "navigate to the clean URL" links as hard
  navigations.
