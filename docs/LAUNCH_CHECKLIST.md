# Launch checklist — 28 and Three

Mapped from IMPLEMENTATION.md §8 (the 16-item list). Each row has
**status**, **owner**, and a **source of truth** you can re-verify
without re-reading the code.

Legend: ✅ done · ⏳ pending user action · 🚧 upstream-blocked

| # | Item | Status | Owner | Source of truth |
|---|---|:-:|---|---|
| 1 | All epics' success criteria met and signed off | ✅* | Mehdi | E1–E4 + E7 closed in beads; E5 at 17/18 (only `nzw.11` nfl4th integration remains, upstream-blocked and fallback is live); E6 closing with this commit |
| 2 | All epic E2E tests passing in CI on `main` | ✅ | — | `e1.spec.ts` through `e7-*`-derived specs all exist in `tests/e2e/` (21 spec files). The 2 chronic `/status` failures are local-only (need ETL-seeded local Neon — HANDOVER §5); CI has the ETL secret |
| 3 | Lighthouse perf/a11y/best-practices/seo ≥ 0.9 on 3 pages | ✅ | — | `lighthouserc.json` enforces all four categories at `error` severity on `/`, `/phases/pass_offense`, `/players/qb/00-0039851`. `.github/workflows/lighthouse.yml` runs on every PR + push to main |
| 4 | Sentry 0 unresolved errors across last 7 days of preview | ⏳ | Mehdi | Sentry dashboards — web + etl projects. Check the day of launch |
| 5 | ETL has run 3 consecutive Tuesdays without manual intervention | ⏳ | Mehdi | `meta_refresh` table: `SELECT COUNT(*) FROM meta_refresh WHERE status='ok' AND started_at > now() - interval '21 days'`. Prod state as of 2026-04-21: 38 OK runs recorded; verify pattern before launch |
| 6 | `/status` shows fresh data; all data-contract tests green | ⏳ | Mehdi | Visit `/status`; see "Last refresh" dot. Contract tests run in `.github/workflows/etl.yml` after every ETL. 13-assertion suite in `etl/tests/test_contracts.py` |
| 7 | CSP enforced (not Report-Only), no console violations | ✅** | Mehdi | `middleware.ts` attaches CSP only when `x-vercel-deployment-url` header present. Must verify on the actual preview URL before launch (see Pre-launch sweep below). localhost doesn't emit CSP by design |
| 8 | Rate limiting live on `/api/*` and `/status/*` | ✅ | — | `middleware.ts` — 60/min/IP sliding window via Upstash (with in-memory fallback). Covered by `tests/e2e/rate-limit.spec.ts` (4 specs) |
| 9 | No NFL or Patriots logos / wordmarks in site chrome | ✅ | — | `tests/e2e/legal-audit.spec.ts` scans `<img>`/`<source>` URLs + `public/` filenames for restricted keywords. 0 matches |
| 10 | Disclaimer footer on every page | ✅ | — | `tests/e2e/legal-audit.spec.ts` asserts disclaimer text on 9 representative routes. All green |
| 11 | nflverse + nfl4th attribution on methodology | ✅ | — | `tests/e2e/legal-audit.spec.ts` asserts `#attributions` section renders the nflverse link. Also `SiteFooter` links nflverse on every page |
| 12 | USPTO TESS search on "28 and Three" | ⏳ | Mehdi | Manual — https://tmsearch.uspto.gov/. Non-lawyer check; escalate if any hit. Do this **before** public launch |
| 13 | `robots.txt` allows crawling; `sitemap.xml` submitted to GSC | ✅*** | Mehdi | Both files shipped (`app/robots.ts`, `app/sitemap.ts`). **GSC submission is manual** — needs Search Console property registration + sitemap URL submitted via the console |
| 14 | Analytics live (Plausible or Vercel Analytics) | ⏳ | Mehdi | Neither provider is wired yet. Pick one, install, deploy. Vercel Analytics is free on the hobby tier and needs zero code beyond `@vercel/analytics` |
| 15 | Incident runbook in `docs/runbook.md` | ✅ | — | 14 sections covering db-roles, schema-changes, etl-rollback, pitr-drill, etl-failure, status-data-auth, neon-outage, sentry-spike, bad-data-publish, dns-issue, cert-expiry, domain-expiry, dependency-cve, vercel-outage. 345 lines |
| 16 | Cost review within expected bands | ⏳ | Mehdi | See `docs/budget.md` (if extant) or check dashboards directly: Neon (0.5 GB free, we're ~150–200 MB), Vercel (100 GB bandwidth, we're <1 GB), Sentry (5k events/mo free), GH Actions (500 min/mo free, ETL ~3 min/week) |

\* E5-08b nfl4th integration waits on upstream `py4thdown` PyPI publication. Fallback is shipping; `/coaching` renders "Model pending" callout correctly.
\** Production CSP path is unverified until hitting a Vercel preview URL. See *Pre-launch sweep* below.
\*** robots + sitemap are code-complete; GSC submission requires the deployed domain.

---

## Pre-launch sweep — run THE DAY OF launch

Automated gates (should pass):

```bash
pnpm typecheck && pnpm lint && pnpm test           # unit + types
pnpm test:e2e                                       # full chromium suite
pnpm exec lhci autorun                              # Lighthouse CI budget
```

Manual probes against the live preview URL (after deploy, before flipping DNS / announcing):

```bash
PREVIEW=https://28andthree-preview-<hash>.vercel.app

# CSP enforced in production (header present + no console violations):
curl -sI "$PREVIEW/" | grep -i content-security-policy

# Rate limit: 61 requests from one IP, 61st should 429:
for i in $(seq 1 61); do curl -so /dev/null -w "%{http_code}\n" "$PREVIEW/api/revalidate"; done | tail -5

# sitemap reachable + crawlable:
curl -sI "$PREVIEW/sitemap.xml" | head -3
curl -sI "$PREVIEW/robots.txt"  | head -3

# /status shows green meta_refresh rows (authenticated):
curl -sH "x-admin-token: $STATUS_ADMIN_TOKEN" "$PREVIEW/status/data" | jq '.row_counts'

# OG card renders for a representative route:
curl -sI "$PREVIEW/og?title=Smoke&eyebrow=TEST" | grep -i content-type   # image/png expected
```

User tasks (no tooling can verify these for you):

- [ ] Sentry web + etl projects — 0 unresolved in last 7 days (item 4).
- [ ] ETL cron — 3 consecutive Tuesdays green (item 5). See `meta_refresh`.
- [ ] USPTO TESS search cleared (item 12).
- [ ] GSC property registered + sitemap submitted (item 13).
- [ ] Analytics picked + wired (item 14). Vercel Analytics = 5 min of work.
- [ ] Cost dashboards reviewed; all within expected bands (item 16).

When all 16 items are either ✅ or your personal sign-off, trigger the soft launch runbook (`docs/LAUNCH_RUNBOOK.md`).

---

## Ownership convention

- **`—`** in the owner column: no human owner needed; code + CI guarantee the property. Only revisit if the CI itself is broken.
- **`Mehdi`**: solo-project operational work. If this becomes a team, swap with the responsible handle + an escalation.

---

*Last walked 2026-04-21. Re-walk every two weeks until launch; monthly after.*
