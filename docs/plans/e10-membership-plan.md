# E10 (cp4): Membership — Technical Plan

**Status:** v2 (post-codex adversarial review — 1 CRITICAL + 3 WARNINGs + 1 SUGGESTION incorporated)
**Beads issue:** `patsbythenumbers-cp4`
**Companion epic:** `patsbythenumbers-lnv` (E10b — AI Authoring Studio; engineering centerpiece)
**Sprint:** offseason 2026 (May–Aug build, Sept 3 free-tier go-live, Oct/Nov paid flip)
**Review doc:** `e10-membership-plan-adversarial-review.md`

> **v2 delta vs v1**:
> - **CRITICAL fix (codex):** Beehiiv webhook handler now scrubs subscriber PII before any Sentry emission. §3.5 rewritten — only event-type counts + timestamps reach Sentry. Per-address triage stays inside Beehiiv.
> - **WARNING fix (codex):** Direct Beehiiv form replaced with a Next.js proxy route (`/api/membership/signup`). Solves three problems simultaneously: gives us first-party success/error UX (warning #1), provides a fallback path during Beehiiv outages (warning #2), and gives us explicit control over segment/tag assignment for the paid waitlist (warning #3). §3.3 rewritten.
> - **SUGGESTION fix (codex):** Added a deploy-time price-parity check between `PRICING` constant and Beehiiv plan metadata. P1-04 acceptance updated.
> - PRAISE preserved: §3.9 Phase 2.5 quality gate kept as-is.

---

## 1. Context

### Problem

The site has a real audience-of-one product (Patriots dashboards) but no audience and no monetization path. SPEC.md §11 originally deferred paid tiers — a defensible v1 stance, but one that leaves no tested path from "site exists" to "site sustains itself." This epic establishes that path.

The newsletter wrapper (vs. selling data tools direct) does three jobs simultaneously:

1. **Audience builder.** A free Sunday recap converts dashboard visitors into a list we own (or lease, via Beehiiv).
2. **Revenue layer.** A paid Wednesday opponent preview + year-round deep dives turn that list into recurring revenue at $5–7/mo or ~$50/yr.
3. **Legal armor.** Editorial use of nflverse-derived stats is First Amendment journalism; selling data access for $5/mo is unlicensed sports-data vending. The newsletter wrapping is the legal posture, not just a marketing choice.

### Audience

- **Free tier audience:** Patriots fans who already use the dashboards, plus the broader "we read the box score twice" cohort the site is positioned for.
- **Paid tier audience:** subset of free-tier readers who want the deeper, structurally-consistent take. Estimated TAM: 1–3% of the hardcore Patriots-analytics population (~50–100k worldwide), so 500–3000 realistic ceiling.

### Why now

- The 2026 season opener (Sept 3) is the natural launch beat. Building during the offseason lets us land the free Sunday recap on Week 1 and validate cadence before flipping the paid tier.
- Site fundamentals (E1–E9) have stabilized. Schedule-aware ETL (E9) gives us the infrastructure to drive cron-scheduled content generation off the games table.
- Revenue runway needs to start before site costs cross the $50/mo red-line. Budget review (`docs/budget.md`) projects month-6 costs at $20–$74/mo; a paid tier pulling even 50 subs at $5 covers that.

### Success (qualitative)

- A free reader gets a clean, format-consistent Sunday recap in their inbox without thinking about how it got there.
- A paid reader gets four phase-specific Wednesday previews per opponent that read as a single coherent product, not four AI dumps stapled together.
- Operator (you) doesn't need to context-switch between dashboard, prompt files, and Beehiiv to ship a piece — the studio (E10b) handles the workflow.
- Site stays free, no auth, no paywall on existing routes. SPEC §11 is amended honestly to reflect this reversal of stance.

### Success (quantitative acceptance)

Mirrored in §8 task acceptance + cp4 acceptance criteria 1–13:

1. SPEC.md §11 amended; IMPLEMENTATION.md gains E10 + E10b rows.
2. Beehiiv account live with `mail.28andthree.com` (or alternative verified subdomain), DESIGN.md-aligned email template.
3. `/membership` page deployed; renders pricing, what's included, working signup CTA.
4. Free-tier signup CTA on footer + nav, converting visitors to Beehiiv free list.
5. ≥4 consecutive Sunday recaps shipped via the AI pipeline (E10b) before paid flip.
6. Phase 2.5 quality gate run; ≥5/10 trusted readers say they would pay $5/mo for sample content.
7. Paid tier enabled at locked pricing (`docs/pricing.md`); ≥1 paid Wednesday preview shipped during 2026 season.
8. Year-round content calendar published at `docs/content-calendar.md`.
9. Beehiiv → Sentry-equivalent failure alerting verified.
10. No auth, paywall, or member-state code added to 28andthree.com (out-of-scope guard).

---

## 2. UX

This epic adds **one new page**, **two new touchpoints on existing chrome**, and **no auth flow on the site**. Everything else (drafting, scheduling, publishing) lives in the studio (E10b) or on Beehiiv.

### 2.1 `/membership` marketing page

A single Server Component page. Layout follows DESIGN.md conventions — analyst-terminal editorial, dense, zero gradients. Sections top to bottom:

```
┌─────────────────────────────────────────────────────┐
│ Eyebrow: MEMBERSHIP                                 │  ← font-mono text-2xs uppercase
│                                                     │
│ The Patriots inbox.                                 │  ← Cabinet Grotesk 56–72px
│ Once a week free. Twice a week paid.                │
│                                                     │
│ <copy paragraph: positioning>                       │  ← Geist body 15px
│                                                     │
│ ┌──────────────────┐ ┌──────────────────┐         │
│ │  FREE            │ │  PAID            │         │
│ │  $0/mo           │ │  $X/mo · $X/yr   │         │
│ │                  │ │                  │         │
│ │  Sunday recap    │ │  Sunday recap    │         │
│ │  Year-round      │ │  + Wed preview   │         │
│ │                  │ │  + offseason     │         │
│ │                  │ │    deep dives    │         │
│ │                  │ │                  │         │
│ │  [Get free →]    │ │  [Subscribe →]   │         │
│ └──────────────────┘ └──────────────────┘         │
│                                                     │
│ — Sample piece —                                    │
│ <truncated voice exemplar (Sample B+ structure):    │
│  Setup / Signal / Counterpoint / What to watch>     │
│                                                     │
│ — Cadence —                                         │
│ Sunday: weekly during the season; monthly offseason │
│ Wednesday: weekly during the season (paid only)     │
│ Deep dives: 6–10 per year, paid only                │
│                                                     │
│ — Q&A —                                             │
│ <FAQ: refunds, cancel, archive access, data sources>│
│                                                     │
│ <Final CTA — duplicate of the paid card>            │
└─────────────────────────────────────────────────────┘
```

Primary CTAs link to Beehiiv signup forms (or open an inline Beehiiv form widget — decision §3.2). Secondary CTA on the FREE card opens an inline `<form>` that POSTs to the Beehiiv embed endpoint — no client-side JS required for the happy path.

**Mobile**: stack everything single-column. Pricing cards stack with a hairline divider, not a card-on-card stack. CTA buttons full-width.

**Empty state**: pre-paid-flip, the PAID card shows `Coming October — join the waitlist` and the CTA captures email into a "paid waitlist" Beehiiv segment instead of a paid plan.

### 2.2 Header treatment

Add `Membership` to `NAV_LINKS` in `components/SiteHeader.tsx`. Position last. No styled differently — keeps the analyst-terminal restraint. Mobile nav inherits this automatically.

```ts
const NAV_LINKS = [
  { label: 'Team', href: '/' },
  { label: 'Phases', href: '/#phases' },
  { label: 'Players', href: '/players' },
  { label: 'Draft', href: '/draft-roi' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Membership', href: '/membership' },  // ← new
];
```

### 2.3 Footer treatment

Add a single `Subscribe` line above the existing disclaimer block. Same mono-uppercase voice; links to `/membership`. NO inline email-capture form in the footer — it competes with the freshness indicator and would clutter the rhythm. The footer's job is to point at `/membership`, not to convert there.

```
SUBSCRIBE — FREE WEEKLY OR PAID DEEP-DIVE → mail.28andthree.com
DATA: NFLVERSE · METHODOLOGY                          ● <freshness line>
28 AND THREE — INDEPENDENT FAN PROJECT...
```

### 2.4 Confirmation flow

Beehiiv handles the double-opt-in confirmation email. After a successful POST, we redirect to `/membership/thanks` — a thin Server Component page that:
- Confirms "check your email"
- Shows what to expect next (cadence, when first piece ships)
- Links back to `/`

No JS-only success state. Keeps analytics + screen-readers honest.

### 2.5 Anti-goals

- **No modal popups.** DESIGN.md motion conventions ban entrance animations and friction-y interruptions.
- **No "free trial" of paid content** in v1. Adds copy + payment-flow complexity for unclear conversion lift.
- **No social-proof testimonials in v1.** We don't have any yet; faking them would corrode trust.
- **No fancy iconography.** Pricing cards are typography + hairline borders, not iconified.

---

## 3. Technical architecture

### 3.1 Beehiiv platform setup

Pre-build (one-time, not a code task):

- Create Beehiiv publication. Free tier covers up to 2.5k subs.
- Custom subdomain: `mail.28andthree.com`. DNS records (CNAME + TXT verification) added to existing 28andthree.com nameservers. Verify with Beehiiv's domain-check.
- Email template: dark mode by default to match site (DESIGN.md §Color). Beehiiv's template editor allows custom CSS within bounds; we map only the essentials:
  - Background `#0B1520`, surface `#121E2B`, body `#E8E6E1`, accent `#C81E36` (post-bd-2w1).
  - Typography: Geist Mono for the meta line; Geist for body; Cabinet Grotesk substitution if Beehiiv supports it (otherwise system bold serif fallback documented).
  - The dashboard-link pattern: every numeric claim links to the source dashboard cell.
- Segments: `free`, `paid_monthly`, `paid_annual`, `paid_waitlist`. Set during account configuration.
- Webhooks: configured to POST to `/api/beehiiv/webhook` for delivery-failure and bounce events (§3.5 alerting).

### 3.2 `/membership` page implementation

`app/membership/page.tsx` — Server Component. No fetches, no auth, no DB reads. Pure static-with-tokens. Renders at build time.

Pricing values come from a single source-of-truth file:

```ts
// lib/membership/pricing.ts
export const PRICING = {
  free: { monthly: 0, annual: 0 },
  paid: {
    monthly: 7,        // locked per /pricing-strategy in P0-04
    annual: 50,        // ~30% discount vs 12 × monthly
    currency: 'USD',
  },
  paidLive: false,     // toggled true at paid flip
} as const;
```

`paidLive=false` → PAID card renders waitlist copy + waitlist CTA. `paidLive=true` → renders paid CTA pointing at Beehiiv subscription URL. Single boolean flips the entire UX.

**Why a constant, not env var:** the value of `paidLive` is part of the audit trail (commit message + diff). Env var would be invisible. Trade: requires a deploy to flip; we accept (deploys are <2 min on Vercel).

### 3.3 Signup CTA + proxy route

**v2 (post-codex):** signup goes through a Next.js proxy route, not directly to Beehiiv. This was originally a direct form post — codex flagged three problems with that:
1. Beehiiv's embed redirect-on-success behavior is unverified; relying on it means our `/membership/thanks` UX may never render
2. Beehiiv outages or 4xx/5xx responses strand the user on a vendor-branded error page
3. Setting the `paid_waitlist` segment requires Beehiiv-specific tag mechanics that aren't well-defined for embed forms

The proxy fixes all three. Email PII is processed in transit (forwarded to Beehiiv via API), not stored.

#### Component
`components/membership/FreeSignupCTA.tsx` — server-rendered `<form>` posting to our own endpoint. Progressive enhancement: works without JS; with JS, intercepts submit for inline error rendering.

```tsx
<form action="/api/membership/signup" method="post">
  <input type="email" name="email" required ... />
  <input type="hidden" name="placement" value="footer" />
  <input type="hidden" name="intent" value="free" />  {/* or "paid_waitlist" */}
  <button type="submit">Get free →</button>
</form>
```

`placement` drives utm attribution. `intent` drives Beehiiv segment assignment.

#### Proxy route
`app/api/membership/signup/route.ts` — POST handler:

1. **Validate** — email format, intent enum (`free` | `paid_waitlist`), placement enum
2. **Rate-limit** — IP-based, 5/min/IP. In-memory bucket via existing project pattern (or Upstash if added).
3. **Forward to Beehiiv API** — `POST https://api.beehiiv.com/v2/publications/{pub_id}/subscriptions` with body shaped per Beehiiv's API:
   - `email`
   - `tags` — `['free']` or `['paid_waitlist']` per intent
   - `utm_source` — derived from placement
   - `reactivate_existing: true` so an existing free sub adding paid-waitlist tag works
4. **Map response** —
   - 201 / 200 → redirect to `/membership/thanks?intent=<intent>` (UX confirms what they signed up for)
   - 4xx (validation) → re-render `/membership` with `?error=<reason>` so the form shows inline failure copy
   - 5xx / network failure → render `/membership` with `?error=temporarily_unavailable` + visible mailto fallback `subscribe@28andthree.com`
5. **Telemetry** — emit a structured log line per submission (NO email; only `intent`, `placement`, response status, timing). Sentry breadcrumb on 5xx so we know about Beehiiv outages without learning who tried to subscribe.

#### Beehiiv API key

Added to `.env.example` as `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID`. Vercel project gets the secrets in the Production env scope. Local dev uses a separate `BEEHIIV_API_KEY_DEV` against a Beehiiv test publication if available — otherwise local dev uses prod keys but is rate-limited by Beehiiv naturally.

#### Why this trade is OK now

The original "no proxy" stance saved us a route + email handling concerns. The proxy approach reintroduces those — but:
- **Email PII handling**: stateless transit, no storage, no logging of email values. Same posture as Sentry scrubbing in §3.5.
- **API key exposure**: Vercel-managed secret, not in client bundle (route handler is server-only).
- **Spam protection**: rate-limit middleware in the route + Beehiiv's own bot detection. Honeypot field added to form (`<input type="text" name="website" tabIndex={-1} aria-hidden style={{display:'none'}}/>` — bots fill it, humans don't).

### 3.4 Email template tokens (DESIGN.md → Beehiiv)

Documented in `docs/authoring/email-template.md` (created in P0-03):

| DESIGN.md token | Beehiiv mapping | Notes |
|---|---|---|
| `--bg` | Email background | `#0B1520` |
| `--surface` | Section/card background | `#121E2B` |
| `--text` | Body text | `#E8E6E1` |
| `--text-muted` | Meta lines, eyebrow labels | `#8A96A3` |
| `--accent` | Primary link color | `#C81E36` (post bd-2w1) |
| `--positive` | Inline positive deltas | `#1ABE58` |
| `--negative` | Inline negative deltas | `#D9707F` (post bd-2w1) |
| Cabinet Grotesk | Display headings | Beehiiv may not support; document fallback to Georgia bold |
| Geist | Body | Same — fallback to system-ui |
| Geist Mono | Numeric tables | Falls back to ui-monospace |

Beehiiv has limits — we pick the four highest-impact tokens (bg, text, accent, link) and document the rest as best-effort. Email rendering across clients (Gmail dark, Apple Mail, Outlook) tested in P0-03.

### 3.5 Alerting integration

**v2 (post-codex CRITICAL):** Beehiiv webhooks include subscriber emails and identifying metadata. Forwarding raw payloads into Sentry would replicate the entire mailing list into a third-party log aggregator with its own retention policy — a privacy/regulatory hazard once paid subscribers are involved. Codex flagged this as the top risk in the plan.

#### Architecture

```
Beehiiv event ──POST──▶  /api/beehiiv/webhook  ──aggregate + scrub──▶  Sentry (counts only)
                                │
                                └──per-address triage stays in Beehiiv (no copy made)
```

`app/api/beehiiv/webhook/route.ts`:

1. **Validate HMAC signature.** Beehiiv signs webhook payloads with a shared secret (`BEEHIIV_WEBHOOK_SECRET`). Reject unsigned + replay-attacked requests (timestamp window: 5 min).
2. **Parse event type only.** Discard the payload's email + name + IP fields immediately after typing the event. Keep: event type, event timestamp, opaque event ID (Beehiiv's own UUID — not derived from PII).
3. **Aggregate to a Postgres counter table** — `meta_email_events(event_type, occurred_at, beehiiv_event_id)`. UNIQUE on `beehiiv_event_id` to make webhook delivery idempotent. NO email column.
4. **Emit anonymized Sentry breadcrumb** — `{ event_type, count_in_last_24h, threshold_status }`. Severity routing per the table below operates on the *aggregated* counts, not the individual event.

| Beehiiv event | Aggregation rule | Sentry severity (when threshold tripped) |
|---|---|---|
| `email.delivery_failed` | rolling 24h count | warning if >1% of last send |
| `email.bounced` (hard) | rolling 24h count | warning if >2% of last send |
| `email.complained` (spam) | any single occurrence | error (deliverability cliff) |
| `subscription.churned` | rolling 7d count | info — metric only |
| `webhook.heartbeat` | dropped after signature check | none |

Threshold-based alert wiring lives in `lib/membership/email-alerting.ts`. If `email.complained >= 1` in the last 24h, the next scheduled send is automatically held (via a flag in `meta_email_events_state`) until manually cleared.

#### Per-address triage

If you need to investigate a specific bounce, look it up in Beehiiv directly — that's where the email-to-event association lives. Sentry only knows "we had 3 bounces today"; Beehiiv knows which addresses they were. This split is intentional: Sentry is for monitoring trends, Beehiiv is for subscriber operations.

#### Privacy posture

The webhook handler treats incoming Beehiiv payloads the way a HIPAA-style scrubber would treat PHI: ingest, type, count, drop. The Postgres counter table contains zero subscriber identifiers. If we ever audit "what subscriber data does our infrastructure hold?", the answer is "nothing — Beehiiv holds it all."

### 3.6 No site-side auth (out-of-scope guard)

The `/membership` route is fully public. The signup form posts to Beehiiv — we never touch the user's email server-side. The webhook endpoint validates HMAC but doesn't authenticate users.

This is enforced by:
1. No imports of `next-auth` / `@auth/core` / `auth.js` anywhere in `app/membership/**` or `lib/membership/**`. Lint rule (custom or via ESLint `no-restricted-imports`) enforces this.
2. E2E test (P0-12) asserts `/membership` works with all cookies cleared.

### 3.7 Schedule + cron driving content generation (handed to E10b)

cp4 doesn't ship the cron itself — that's E10b. cp4 does:
- Specify the schedule that E10b implements (Tuesdays 6 AM ET pre-generate Wednesday previews; Saturdays 6 PM ET pre-generate Sunday recap drafts post-game)
- Wire alerting so missed-cron events surface in Sentry

The schedule lives in `docs/authoring/schedule.md` (created in P0-09).

### 3.8 Pricing decision (`docs/pricing.md`)

Locked via /pricing-strategy + /positioning-messaging skills run as P0-04. Output: `docs/pricing.md` with rationale, anchors, refund policy, annual-discount math.

Recommended starting position to challenge in /pricing-strategy:
- $7/mo, $50/yr (annual ≈ 40% discount; positions paid as a deliberate purchase, not impulse)
- vs. $5/mo, $40/yr (lower friction, lower revenue ceiling)

The plan defers; the task forces the decision before P2.5 quality gate runs (so the gate samples copy at the actual price).

### 3.9 Phase 2.5 quality-gate mechanics

Defined in `docs/authoring/quality-gate.md` (P0-10). Spec:

- **Reader panel:** 5–10 trusted readers. User curates the list; should include 2–3 "hardcore Patriots fans not in our bubble" + 2–3 "sports-analytics literate but team-agnostic" + 1–2 "skeptical of AI content". Goal is not consensus but diverse failure-mode coverage.
- **Sample size:** 4 pieces. 2 Sunday recaps (weeks N and N+1) + 1 Wednesday preview (4 phase sections) + 1 offseason deep dive. Pieces are from the actual pipeline — no human polish beyond the standard editorial review.
- **Question:** "Would you pay $5/mo for this?" Yes/no/maybe. Plus open-ended "what would make this a yes if it's not?"
- **Pass criterion:** ≥5/10 yes (or strong-leaning yes, judged by user). Maybes don't count.
- **Fail action:** paid flip is killed or delayed pending pipeline iteration. Free tier continues uninterrupted. Failure reason recorded in `docs/authoring/quality-gate-results.md` + cp4 reopened with iteration tasks.

Anti-goal: the gate is not a vibe check. Verbatim feedback is collected, not vibes.

### 3.10 Privacy + ToS updates

Two short doc-only tasks:
- Privacy policy update: add Beehiiv as a data processor for email subscribers; specify what's shared (email + IP at signup).
- ToS update: section on newsletter — refund policy (Beehiiv handles; pro-rated annual on cancel; we follow Beehiiv defaults), unsubscribe at any time, content rights.

Done as part of P0-13. No legal counsel needed for v1; revisit if/when sub count crosses 1k.

---

## 4. E2E tests (upfront)

All Playwright. Live in `tests/e2e/` (existing pattern). Scoped per acceptance criterion.

| Test | What it verifies | Spec |
|---|---|---|
| `e10-membership-page.spec.ts` | `/membership` renders heading, free + paid cards, sample piece, FAQ, footer link | Acceptance §3 |
| `e10-membership-page-paidwaitlist.spec.ts` | When `PRICING.paidLive === false`, paid card shows waitlist CTA, not subscription | Acceptance §3 |
| `e10-membership-page-paidlive.spec.ts` | When `PRICING.paidLive === true`, paid card shows subscription CTA at locked price | Acceptance §7 |
| `e10-signup-cta-footer.spec.ts` | Footer "Subscribe" line renders, links to `/membership`, has correct utm | Acceptance §4 |
| `e10-signup-cta-nav.spec.ts` | Header `Membership` link renders desktop + mobile, navigates to `/membership` | Acceptance §4 |
| `e10-membership-thanks.spec.ts` | `/membership/thanks` renders, links back, no JS-required content | UX §2.4 |
| `e10-no-auth-on-site.spec.ts` | Crawls `/membership`, `/membership/thanks` with all cookies cleared; verifies 200 + correct render. Asserts no `Set-Cookie` for auth tokens. | Acceptance §10 |
| `e10-beehiiv-webhook.spec.ts` (Node test, not Playwright) | Webhook validates HMAC; rejects unsigned + replay-attacked requests; routes events to correct Sentry severity | Acceptance §9 |

Visual regression on `/membership` deferred to E10b's design-review skill once the page is live.

**Anti-test smell:** no E2E that actually submits the signup form. Beehiiv's endpoint is third-party and not under our test control. Manual smoke on each deploy + Beehiiv-side analytics catch real signup breakage faster than mocked E2E.

---

## 5. Simplification pass

Reviewed §2–§4 for cuts. Three things considered, two cut, one kept:

- **Cut: API proxy for Beehiiv signup.** Original sketch had `/api/membership/signup` proxying to Beehiiv. Cut — direct form post is simpler, avoids touching email PII server-side, inherits Beehiiv's spam protection. Trade is lower attribution control; we recovered it via hidden `utm_source` field.
- **Cut: Editorial banner at top of `/membership` ("welcome to our newsletter").** Cut — adds no info, costs vertical space. The page's value prop is in the H1.
- **Kept: Sample piece embedded on `/membership` page.** Considered cutting (linking to an archived issue instead). Kept — reduces clicks, lets the value prop be visible at the conversion moment. Costs ~80 lines of static markup; worth it.

---

## 6. Adversarial review (codex)

**Status:** pending. Run `/adversarial-review` against this plan after initial commit. Findings + responses captured in `e10-membership-plan-adversarial-review.md`.

Anticipated lines of attack to pre-prepare for:
- Vendor lock-in to Beehiiv (mitigated: list export is API-supported; subscriber data is exportable in our exit plan)
- DNS misconfiguration risk on `mail.28andthree.com` (mitigated: documented runbook for DNS changes; Beehiiv's verification step catches typos)
- Pricing decision as a critical path blocker (mitigated: explicit /pricing-strategy task with deadline; falls back to default $7/$50 if research is delayed)
- "No site auth" as a constraint that ages badly (acknowledged: explicit in design as a v1 choice; future epics can revisit if a site-side membership feature becomes worth the auth lift)

This section gets rewritten post-codex with actual findings.

---

## 7. Content calendar (sketch — actual lives in `docs/content-calendar.md`)

Drafted in P0-08. Sketch here for plan context:

### In-season (Sept–Feb, 22 weeks if playoffs)
- **Sunday recap** (free + paid). Six standardized sections: Score and what mattered / Phase grades / Three things that worked / Three things that didn't / What changed in the rankings / Next week's frame.
- **Wednesday opponent preview** (paid). Four phase-specific sections (pass-O / run-O / pass-D / run-D) per the locked Setup-Signal-Counterpoint-What-to-Watch structure (lnv design entry §16/17).

### Offseason (Mar–Aug)
- **Combine takeaways** (March, paid). What dashboard signals predicted vs. didn't.
- **Free agency reactions** (March, paid). Per-signing EPA/snap projection vs. cost-of-acquisition.
- **Pre-draft scouting board** (April, paid, 2 pieces). Phase-need + best-fit at NE's slots.
- **Post-draft grade** (April/May, free + paid). Free version is the summary; paid version is per-pick deep dive.
- **Schedule release reaction** (May, paid). Strength-of-schedule by phase, key-game frame.
- **Training camp tracker** (July–Aug, paid, 4 pieces). Roster-construction signals.
- **Season preview** (August, free + paid). Free is the summary; paid is per-position-group deep dive.
- **Sunday recaps go monthly** through offseason for free-tier reading habit retention.

Total annual paid output: ~30 pieces (22 in-season + ~8 offseason). Total free output: ~32 pieces (22 in-season recaps + monthly offseason recaps + some doubled offseason pieces).

User edits this in P0-08 to lock the offseason cadence.

---

## 8. Task breakdown

Naming follows the `<epic>-<priority-block>-<seq>` convention. P0 = critical path before season opener; P1 = required before paid flip; P2 = ongoing.

### Block P0 — pre-season-opener (May–Aug 2026)

| ID | Title | Why | Acceptance |
|---|---|---|---|
| P0-01 | Amend SPEC.md §11 + IMPLEMENTATION.md | Reverse the v1 deferral of paid tier; document E10 + E10b rows | SPEC.md §11 mentions E10; IMPLEMENTATION.md has E10 + E10b rows; commit lands |
| P0-02 | Beehiiv account + custom subdomain (`mail.28andthree.com`) + API access | Platform dependency for everything; v2 also requires API access for the proxy route | Account live; DNS verified; sending domain authenticated (SPF/DKIM); test send to internal email succeeds; `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID` + `BEEHIIV_WEBHOOK_SECRET` issued; subscription API tested with curl from local dev; `paid_waitlist` and `free` tags / segments created in publication settings |
| P0-03 | Email template + cross-client render test | DESIGN.md tokens mapped; verify Gmail dark / Apple Mail / Outlook render | Template saved in Beehiiv; screenshots in `docs/authoring/email-template.md` from 3 clients |
| P0-04 | Lock pricing via /pricing-strategy + /positioning-messaging | Pricing blocks paid flip + sample-content for quality gate | `docs/pricing.md` shipped with rationale; values reflected in `lib/membership/pricing.ts` |
| P0-05 | Build `/membership` page + sample-piece embed | The conversion surface | Page deploys; matches §2.1 layout; sample piece reads in DESIGN.md voice; 6 acceptance E2E tests pass |
| P0-06 | Build `FreeSignupCTA` component + `/api/membership/signup` proxy + wire into footer | v2 — proxy route fixes the three signup-flow warnings codex flagged (success UX, fallback, segmentation) | Component renders in footer of every public route; proxy validates input, forwards to Beehiiv API, redirects to `/membership/thanks?intent=...` on success; renders `?error=...` inline on 4xx; renders mailto fallback on 5xx; honeypot field defeats bot fills; rate-limited 5/min/IP; signup E2E verifies happy path + 4xx fallback + 5xx fallback |
| P0-07 | Add `Membership` to `NAV_LINKS` | Conversion entry point on every page | Header desktop + mobile both link to `/membership`; e2e in `e10-signup-cta-nav.spec.ts` passes |
| P0-08 | Draft `docs/content-calendar.md` | Locks offseason cadence + paid-tier promise scope | File committed; ≥30 pieces in calendar with cadence + section-spec pointers; user-reviewed |
| P0-09 | Draft `docs/authoring/schedule.md` | Cron schedule that E10b will implement | File committed; covers Tue/Sat pre-generation windows; ET-anchored |
| P0-10 | Draft `docs/authoring/quality-gate.md` | Phase 2.5 spec with rubric, panel, sample size, pass/fail | File committed; user has list of trusted readers; rubric is concrete, not vibes |
| P0-11 | Beehiiv webhook + Sentry alert wiring (with PII scrubbing) | Failure-mode visibility — v2 adds explicit scrubbing layer per codex CRITICAL | `/api/beehiiv/webhook` deployed; HMAC validated; replay-test rejected; **email + name + IP fields stripped before any Sentry call**; aggregated `meta_email_events` table populated with zero PII; Sentry breadcrumb contains only event_type + counts + threshold_status; threshold logic verified (1% delivery_failed → warning, 2% bounce → warning, ≥1 complaint → error + auto-hold next send); per-address triage flow documented (use Beehiiv directly, not Sentry) |
| P0-12 | E2E test: no-auth-on-site guard | Out-of-scope guard enforced in CI | `e10-no-auth-on-site.spec.ts` passes; ESLint rule blocks `next-auth` imports under `app/membership/**` |
| P0-13 | Privacy policy + ToS updates | Beehiiv as processor; refund + unsubscribe | Both docs updated; linked from `/membership` footer |

### Block P1 — pre-paid-flip (Sept–Oct 2026)

| ID | Title | Why | Acceptance |
|---|---|---|---|
| P1-01 | Ship 4 consecutive Sunday recaps via E10b pipeline | Validates cadence reliability before paid flip | 4 weeks of consecutive sends documented; ≥1 missed-deadline triggers retro |
| P1-02 | Curate Phase 2.5 reader panel (5–10 names) | Quality-gate input | Names + emails captured in `docs/authoring/quality-gate.md` |
| P1-03 | Run Phase 2.5 quality gate | Pass/fail decision before paid flip | Results recorded; ≥5/10 yes → continue; <5/10 → kill or delay paid flip with reasons |
| P1-04 | Flip `PRICING.paidLive = true`; configure paid plan in Beehiiv; verify price parity | The actual paid flip — v2 adds price-parity check per codex SUGGESTION | `/membership` paid card shows subscription CTA; Beehiiv accepts paid signup test transaction; pre-deploy script (`scripts/check-pricing-parity.ts`) compares `PRICING` constant to Beehiiv plan metadata via API and exits non-zero on mismatch; script wired into deploy workflow as a blocking check on any PR that touches `lib/membership/pricing.ts` |
| P1-05 | Ship 1 paid Wednesday opponent preview | Acceptance §7 | Piece shipped via pipeline; subscriber sees it; cost telemetry within target |

### Block P2 — ongoing post-flip

| ID | Title | Why | Acceptance |
|---|---|---|---|
| P2-01 | Cost monitoring dashboard for membership stack | Track Beehiiv tier upgrades + LLM cost | Dashboard view in studio (E10b) shows running totals; alerts at 80% of budget red-line |
| P2-02 | Quarterly retro on cadence + churn | Operate with intention, not just inertia | Doc landed each quarter; if churn >5%/mo for 2 consecutive quarters, intervention task created |

---

## 9. Out of scope (reaffirmed)

- Site authentication or member-state code on 28andthree.com (E10's defining boundary)
- Gated dashboards or paywalled site routes
- Direct Stripe integration (Beehiiv handles)
- Archive hosted on 28andthree.com (Beehiiv-hosted)
- Cross-platform analytics joining email opens to dashboard activity
- AI authoring pipeline + studio (E10b — separate epic)
- Live in-game updates, fantasy tools, betting integration (still deferred per SPEC §11)
- Multi-author or multi-editor flows
- Free-trial of paid content
- A/B testing of subject lines (Beehiiv's built-in)

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Beehiiv vendor lock-in | High | Medium | List + analytics export verified at P0-02; documented exit migration path |
| Pricing decision delays paid flip | Medium | Medium | P0-04 has explicit deadline; defaults to $7/$50 if /pricing-strategy is inconclusive |
| Phase 2.5 gate fails | Medium | High (no paid revenue) | Iteration loop spec'd; free tier preserved; cp4 reopens with iteration tasks |
| Bounce/spam-complaint rate >2% | Low–Medium | High (deliverability cliff) | Webhook + Sentry alert at threshold; halt sends pending review |
| LLM cost exceeds $0.50/piece avg | Medium | Medium | Tracked in E10b telemetry; Haiku fallback for first-draft generation if quality holds |
| Subscriber count crosses Beehiiv free tier (2.5k) before revenue covers paid Beehiiv tier | Low (year 1) | Low | Modest paid Beehiiv tier (~$49/mo); covered by ~10 paid subs |
| 5-day post-kickoff content lag (HANDOVER 2026-04-25) | High | Low | Acknowledged; eyebrow / footer copy honest about it (E9 already shipped this) |

---

## 11. Open decisions deferred to tasks

- Pricing exact values → P0-04 (`docs/pricing.md`)
- Trusted reader panel → P1-02 (curated by user)
- Email template Cabinet Grotesk fallback → P0-03 (per cross-client render test)
- Whether `Membership` joins `NAV_LINKS` last or before `Coaching` → P0-07 (UX call after first deploy preview)
- Refund policy specifics → P0-13 (default to Beehiiv defaults unless reason to deviate)

---

## 12. Sign-off

- [ ] Plan reviewed by user
- [ ] /adversarial-review with codex run; findings captured in `e10-membership-plan-adversarial-review.md`
- [ ] Tasks created in beads (P0-01 through P2-02)
- [ ] Plan v2 (post-adversarial) committed
