# Licenses and Attribution

Every third-party asset or data source used by 28 and Three, with the exact license terms, how we interpret them, and the conservative fallback if we're wrong.

**Review posture:** Conservative interpretation (per `/docs/escalation.md` Scenario 2). Every entry below names the retrieval URL, date, and our assumption. If any license changes, we trigger the fallback on a 7-day timeline.

---

## nflverse

**Asset:** nflverse data (play-by-play, rosters, schedules, next-gen stats) via the Python package `nfl_data_py` and the underlying R `nflreadr` / `nflfastR` ecosystem.

**Source of truth:** https://github.com/nflverse

**Key repositories to check (project owner: retrieve + screenshot each during E0-03):**
- `nflverse/nflverse-data` — the data releases themselves
- `nflverse/nflfastR` — the PBP processing toolchain
- `cooperdff/nfl_data_py` — the Python wrapper we will use

**Expected license:** MIT or CC0 / CC-BY on the data repos; MIT on the code repos. This is the pattern across the nflverse ecosystem and matches how nflverse has operated publicly since 2020.

**Attribution format (required on site):**
Footer (methodology link):
> Play-by-play data via [nflverse](https://nflverse.github.io/) (nflfastR), community-maintained and publicly licensed. Site is not affiliated with the NFL.

Full attribution on `/methodology`:
> 28 and Three uses play-by-play, roster, schedule, and Next Gen Stats data from the nflverse project (https://nflverse.github.io/), including `nflfastR` for expected points added (EPA) and completion percentage over expectation (CPOE). nflverse is a community project, independent of the NFL. We thank the maintainers.

**Our interpretation:** Public fan-facing analytics site with no paid tier in v1 is clearly within the spirit of the license. Attribution on every page footer + methodology page is required. We do NOT redistribute the raw nflverse datasets — we ingest into our own Postgres and publish derived aggregates. That's transformation, not redistribution.

**Conservative fallback if license tightens:**
1. Stop weekly ingest; freeze site at the last-legal-snapshot.
2. Evaluate Pro Football Reference scraping or a paid API (e.g., SportsDataIO $50+/mo).
3. Worst case: pivot to historical-only read-only site using pre-terms-change data.

**Status:** PENDING retrieval + screenshot by project owner.

---

## Fonts

### Cabinet Grotesk (Fontshare)

**Asset:** Cabinet Grotesk (variable, weights 400/500/700/800) — used for all display type per DESIGN.md.

**Source:** https://www.fontshare.com/fonts/cabinet-grotesk

**License:** Fontshare offers Cabinet Grotesk free for **both personal and commercial use** under their Fontshare Free License. No royalties. Self-hosting is permitted.

**Retrieval URL for license text:** https://www.fontshare.com/fonts/cabinet-grotesk (license tab)

**Our interpretation:** Public-site embedding is explicitly permitted. Self-hosting the WOFF2 is permitted. No attribution is technically required, but we will credit Fontshare on `/methodology` as good practice.

**Self-hosted backup:** WOFF2 files downloaded from Fontshare's API and placed in `/public/fonts/cabinet-grotesk/` during E0-04. Purpose: CDN outage resilience. Loaded via `next/font` on E1-02b.

**Conservative fallback if terms change:** Swap to `Satoshi` (also Fontshare, similar neutral-grotesk character), `General Sans` (Fontshare), or `DM Sans` (Google Fonts) — all have unambiguous open licenses. Swap is a 1-hour DESIGN.md + tailwind token change; no code rewrite needed.

### Geist + Geist Mono (Google Fonts / Vercel)

**Asset:** Geist (weights 300/400/500/600/700), Geist Mono (weights 400/500/600) — used for all body, UI, and tabular-numeric type per DESIGN.md.

**Source:** https://fonts.google.com/specimen/Geist and https://fonts.google.com/specimen/Geist+Mono

**License:** SIL Open Font License 1.1 (OFL). Unambiguous commercial + public-site use.

**Retrieval URL for license text:** https://openfontlicense.org/open-font-license-official-text/

**Our interpretation:** Fully permissive for our use. No attribution required. Serving via `next/font/google` handles the CDN integration automatically.

**Self-hosted backup:** `next/font/google` with `display: 'swap'` already provides automatic local-hosting in the build. No separate backup needed.

**Conservative fallback:** None needed — OFL is durable. If Google removes it from Fonts, self-hosted OFL copy is legal indefinitely.

---

## NFL CDN headshots

**Asset:** Player headshot images served from NFL's public CDN at `https://static.www.nfl.com/image/private/...`.

**License status:** **Ambiguous.** NFL has not published a written public-use policy for its CDN image URLs. Some fan sites hotlink without issue; some have received takedown notices when combined with commercial intent.

**Our interpretation (conservative):** Default to FALLBACK (initials-only avatar) per DESIGN.md player-avatar spec. Do NOT hotlink NFL CDN URLs in v1.

**Rationale:** 28 and Three is a zero-commercial-intent fan project at launch, but future ambiguity (merchandise? donations? paywall?) makes a "never hotlink NFL assets" policy easier to defend and audit than a "sometimes hotlink" policy.

**Fallback implementation:** `components/PlayerAvatar.tsx` renders a circle with player initials (e.g., "DM" for Drake Maye), colored per DESIGN.md positive/neutral tier, no photographic image. Spec already calls this out as the fallback for missing headshots — we promote it to the default.

**Revisit in v2:** If NFL publishes a clearer policy OR if we confirm a sustained non-takedown pattern across peer fan sites AND we stay zero-commercial.

---

## Other services

### Sentry, Plausible / Vercel Analytics, Neon, Vercel, GitHub

Standard SaaS terms. Reviewed at E0-05 account provisioning. No asset licensing concerns — we're the tenant, not redistributing.

### nfl4th (coaching epic E5)

**Source:** https://github.com/nflverse/nfl4th

**Expected license:** MIT, same as parent nflverse org.

**Retrieval date:** Pending E5-08a spike (Sprint 5, not E0).

**Our use:** Run the model in our ETL only; store model recommendations in Postgres; never redistribute the model or its training data. Pure consumption of model output is within license spirit.

---

## Change control

Any license-affecting change to the files/URLs above must:
1. Update the relevant section here with a dated entry.
2. Reassess the "Conservative fallback" plan.
3. If fallback triggers, file a new beads task and fall back within 7 days.
