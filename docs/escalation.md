# E0 Escalation Routes

Pre-authorized responses to the three failure modes E0 is most likely to hit. Defined before E0-02 runs so the brand-check doesn't stall while we debate what to do about a hit.

---

## Scenario 1 — Trademark hit (E0-02 USPTO TESS check)

**Triggers:**
- Any live registered mark on `28 AND THREE`, `28 and 3`, `28-3`, or a phonetically-similar variant in classes 041 (entertainment / information services) or 009 (software).
- Any pending application in the same classes filed within the last 12 months.
- Ambiguous common-law use by a visible fan/media property (blog, podcast, merch store) discoverable via Google within 3 pages of results.

**Action:**
1. **Stop all E0 work.** Do not register domain (E0-01). Do not create GitHub repo with the name (E0-08). Do not commission any artwork using the wordmark.
2. Archive the TESS search PDF + any discovered common-law evidence into `/docs/preflight/e0-02-tess-hits/`.
3. Engage IP counsel for a written opinion on:
   - Likelihood of confusion in our class.
   - Common-law risk tier.
   - Whether a limited-use disclaimer ("independent fan project") offers durable protection.
4. Budget **pre-authorized: $500** for an initial consult. If counsel recommends a full clearance search ($1,500-$3,500), escalate back to project owner for explicit approval.

**Owner:** Project owner (you) decides GO/NO-GO after counsel opinion.

**Timeline:** Pause E0 for up to 10 business days. If no clean path by day 10, pivot to a backup name (candidates: "Foxboro Analytics," "Route 1 Analytics," "Minuteman Metrics"). Backup name goes through its own E0-02 check.

---

## Scenario 2 — License ambiguity (E0-03 nflverse / E0-04 Fontshare+Google Fonts / E0-06 NFL CDN headshots)

**Triggers:**
- License text is silent on commercial-style use for a public site.
- License is explicit but not machine-readable (e.g., a README paragraph rather than an SPDX identifier).
- Terms appear to have changed recently (GitHub history shows a license file modification in the last 90 days).

**Action:**
1. **Default to the most conservative interpretation.** If a font's ToS is unclear on public-site embedding, self-host the WOFF2 with purchased license OR swap to a Google Fonts alternative that's unambiguous.
2. **Document the assumption in writing.** One paragraph in `/docs/licenses.md` per resource, naming: (a) the exact URL of the license retrieved, (b) the date retrieved, (c) our interpretation, (d) the conservative fallback if we're wrong.
3. **Proceed.** Do not block E0 on ambiguity that's been documented conservatively.
4. If the ambiguity resolves against us post-launch (e.g., nflverse changes terms), the fallback plan activates on a 7-day timeline.

**Owner:** Project owner decides when "conservative fallback" is materially worse (e.g., downgrading from Cabinet Grotesk to a Google Fonts substitute) and whether to pay for a commercial license instead.

**Pre-authorized budget:** $200 for one font / asset commercial license if conservative interpretation blocks a design-critical resource.

---

## Scenario 3 — Cost-budget overrun (E0-09 cost budget document)

**Triggers:**
- Estimated monthly cost > $50 after E0-05 account provisioning (v1 target is < $25/mo).
- Any single service jumps > 2x its pre-E0-05 estimate.
- Free-tier limit on Neon (0.5 GB storage) won't fit 6 seasons × league PBP + indexes + player rollups.

**Action:**
1. **Renegotiate scope, not timeline.** First reductions (in order):
   - Drop 2020 + 2021 seasons from the ingest (saves ~200K plays). History depth becomes 2022–2025. Update `SPEC.md` §2.
   - Drop Firefox from the Playwright matrix (saves CI minutes). Keep chromium + webkit + mobile-chrome.
   - Drop Sentry preview-env event ingestion (saves event quota). Prod-only Sentry.
2. **Only then consider paid tiers.** Neon Launch tier ($19/mo) is the first likely upgrade. Document in `/docs/budget.md` as a scheduled "month 2" decision rather than an E0 blocker.
3. **Never extend the timeline** to stay in free tier. The cost of delay > the cost of $19/mo.

**Owner:** Project owner signs off on any single-service cost > $30/mo.

**Pre-authorized:** Up to $40/mo total across all services without further approval. Anything above requires written sign-off.

---

## Meta: escalation log

All three escalation scenarios log their activation in `/docs/preflight.md` under the affected task's row. Escalation closure (whether GO, pivot, or fallback) is captured before the task is marked PASS.
