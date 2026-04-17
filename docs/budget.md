# Cost Budget

**Target:** Under $25/month for v1 (launch to 6 months post-launch). Hard red-line at $50/month before any scope talks.

All estimates in USD. Tiers current as of 2026-04-15; revisit every 60 days.

---

## Month-1 estimate (v1 launch)

| Service | Tier | Monthly | Notes |
|---|---|---|---|
| Domain (`28andthree.com` or equivalent) | N/A | $1.25 | $15/yr amortized. Private WHOIS included. |
| Vercel (Next.js hosting) | Hobby | $0 | Within free tier for v1 traffic. Bandwidth cap 100 GB/mo. |
| Neon (Postgres) | Free | $0 | 0.5 GB storage, 1 compute hour active/day. **See risk below.** |
| GitHub | Free | $0 | Public repo OR single-maintainer private. |
| GitHub Actions | Free | $0 | 2000 min/mo on public repo, 500 min/mo private. ETL + CI + Lighthouse budget <400 min/mo expected. |
| Sentry | Developer | $0 | 5K events/mo. See risk below. |
| Fontshare (Cabinet Grotesk) | Free | $0 | No paid tier exists for this font. |
| Google Fonts (Geist) | Free | $0 | OFL, free forever. |
| Plausible OR Vercel Analytics | TBD | $0–$9 | Decision deferred to M6 (E6 task). Vercel Analytics free tier covers v1; Plausible $9/mo is cleaner privacy story. |
| **Total (month 1)** | | **$1.25–$10.25** | |

---

## Month-3 projection

Expected changes once real traffic + data growth kick in:

| Service | Likely tier change | Monthly | Trigger |
|---|---|---|---|
| Neon | Free → **Launch ($19)** | $19 | Storage exceeds 0.5 GB (expected once 2020-2024 PBP + indexes + player rollups all load). |
| Sentry | Developer → still Developer | $0 | Should stay within 5K events/mo unless a bad deploy. |
| Analytics | Decision made | $0 or $9 | Plausible if privacy matters; Vercel Analytics if not. |
| **Total (month 3)** | | **$20.25–$29.25** | Within target. |

---

## Month-6 projection

Pessimistic forecast assuming modest growth (tweet-sized viral moments, not sustained traffic):

| Service | Likely change | Monthly | Trigger |
|---|---|---|---|
| Neon | Launch → Launch | $19 | Stable at Launch tier. |
| Vercel | Hobby → **Pro ($20)** | $0–$20 | IF bandwidth or function invocations exceed Hobby cap during a viral moment. Otherwise Hobby. |
| Sentry | Developer → possibly **Team ($26)** | $0–$26 | IF event volume grows with traffic. |
| **Total (month 6)** | | **$20–$74** | Above target if both Vercel and Sentry tier up. |

**Red-line response at $50/mo:** Scenario 3 of `/docs/escalation.md` activates. First cuts: drop 2020+2021 seasons, drop Firefox from Playwright matrix, move Sentry to prod-only event ingestion.

---

## Risk budget items

### Neon storage (biggest v1 risk)

6 seasons × ~50,000 plays/season = ~300K rows in `plays` alone. With indexes and the ancillary tables (`team_phase_weekly`, `player_weekly`, etc.), realistic estimate is **0.4–0.8 GB**. Free tier is 0.5 GB.

**Decision:** Treat the upgrade to Neon Launch ($19/mo) as a scheduled month-2 expense, not an emergency. Budget accordingly from day one.

### Sentry event volume

A bad ETL deploy that throws on every weekly refresh run could generate 1000+ events in an hour. 5K/month gets eaten in an afternoon.

**Mitigation (already in E1-07):** PII scrubbing + error sampling at 0.5 for known-noisy patterns. If breached: upgrade to Team ($26) or switch to a self-hosted GlitchTip container ($0 ops cost, more ops overhead).

### GitHub Actions minutes

Weekly ETL (3 attempts max): ~30 min/week = ~120 min/mo.
CI on every PR (typecheck + lint + test + Playwright): ~8 min/PR. At 30 PRs/mo = 240 min/mo.
Lighthouse CI: ~3 min/PR = 90 min/mo.
**Total: ~450 min/mo.** Free tier is 2000 min/mo on public repo, 500 min/mo on private. Public repo posture keeps us well under.

---

## One-time and contingent costs

| Item | Cost | Trigger |
|---|---|---|
| IP counsel consult (E0-02 escalation) | $500 (pre-authorized) | Trademark hit. |
| Full clearance search (counsel escalation) | $1,500–$3,500 (needs approval) | IP counsel recommends. |
| Commercial font license (E0-04 escalation) | $200 (pre-authorized) | Ambiguous license blocks a design-critical font. |
| Neon annual prepay discount | ~$200/yr (save ~$28 vs monthly) | Once on paid tier. |

---

## Sign-off

- [x] Project owner: **Mehdi El-Amine**
- [x] Date of review: **2026-04-17**
- [x] Next scheduled review: **2026-06-16** (60 days from sign-off)

Budget signed off. Next review 2026-06-16, then quarterly after first 6 months.
