---
title: "CSP nonce + ISR = dead hydration on every cache HIT"
category: "gotchas"
date: "2026-08-25"
tags: [csp, nonce, isr, hydration, middleware, next16, vercel]
files:
  - lib/security/csp.ts
  - middleware.ts
---

# CSP nonce + ISR = dead hydration on every cache HIT

## Symptom

Client components never mount in production, but only on ISR cache HITs.
The page looks fine (server HTML renders), but nothing interactive works:
Suspense boundaries stay on their fallbacks, buttons dead, `useEffect`
never runs. Console: "Executing inline script violates the following
Content Security Policy directive 'script-src 'self' 'nonce-…'
'unsafe-inline''". Local `next start` works (the middleware only attaches
CSP on Vercel), and cache MISSes work — which is why this shipped in
E6-09 and hid until E11 put a hydration-dependent control (the season
switcher) in the header of every page.

## Root cause

The middleware minted a fresh nonce per request and put it in the CSP
header. ISR serves cached HTML whose inline hydration scripts carry the
nonce baked at prerender time. Header nonce ≠ HTML nonce → every inline
script blocked. Per the CSP spec, the presence of any nonce makes the
browser ignore `'unsafe-inline'`, so the fallback in the same directive
did nothing.

Nonce-based CSP fundamentally requires dynamic rendering of every page.
This site is deliberately ISR-heavy; the two cannot coexist.

## Fix (commit 01fa349)

`buildCsp` no longer emits a nonce in any environment; production
script-src is `'self' 'unsafe-inline'` — which is what the file's own
design comment had already chosen. The `x-nonce` request-header plumbing
remains but is inert.

## How to not regress

- `tests/unit/csp.test.ts` asserts `'nonce-` does NOT appear in the
  policy — the test comment explains why.
- If Next ever ships a nonce-plus-static story, revisit; until then, any
  "tighten CSP with a nonce" change must first make every page dynamic.
- Verification that catches this class: a real-browser check against the
  deployed URL on a cache HIT (curl cannot see it — server HTML looks
  perfect). A one-spec Playwright run against prod found it here.
