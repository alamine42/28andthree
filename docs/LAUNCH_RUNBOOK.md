# Launch runbook — soft launch + 48h monitor

Executes E6-16 (`mks.17`). Walk this the day you're ready to flip the
site from "working preview" to "publicly shared". Assumes
`docs/LAUNCH_CHECKLIST.md` is all green.

The soft launch is deliberately narrow: share the URL with ~5–10 trusted
readers, watch the dashboards hourly for 48 hours, publicly-announce
only after that window closes cleanly.

---

## T-0: deploy

Nothing to do in the repo. `main` auto-deploys to prod on every push.
Confirm the latest commit is live:

```bash
git rev-parse HEAD                          # note the SHA locally
curl -sI https://28andthree.com/ | grep -i etag   # Vercel exposes a deploy ETag
# Cross-check the Vercel dashboard → Deployments → most recent "Ready"
```

---

## T+5 min: smoke the production surface

Manual pass, in order. Stop if anything looks wrong — don't announce.

1. **Home** loads, shows current season + phase grid.
2. **Phase pages** — click one of each tier (top / mid / bottom) and
   confirm rank + sparkline + distribution all render.
3. **QB page** — click Maye (or whoever's primary starter). Default
   view is "Primary starter"; toggle the "All games" filter; trend
   chart updates.
4. **Skill page** — a WR with real 2025 routes.
5. **Unit page** — `/team/units/defense`. The "individual ratings
   deferred" callout is prominent.
6. **Draft ROI** — 5 class tables, HIT/FAIR/MISS badges.
7. **Coaching** — play-call heatmap has tint, coordinator cards
   render. 4th-down section shows the "Model pending" callout.
8. **Players hub** — search works, filter chips change results.
9. **Methodology** — TOC jumps to sections, nflverse attribution
   visible.
10. **404** — hit a nonexistent path; styled page renders.
11. **Footer disclaimer** visible on every page above.

---

## T+15 min: share

Share the public URL with the soft-launch group (aim for ≤10 people).
Include:

- the URL
- "soft launch — please tell me if any number looks obviously wrong or
  if any page won't load. I'm watching dashboards for 48 hours."
- a commitment to respond to any issue within ~4 hours during
  daylight ET, next-business-day after.

Keep the group small enough that individual outliers are tolerable.

---

## T+1h through T+48h: monitor

Four signals to watch. Budget ~10 min per check.

### Sentry (web + etl)

- Dashboard: https://sentry.io → both projects.
- Hot-issue threshold: >50 events from a single issue in 1h → triage
  immediately. See `runbook.md#sentry-spike`.
- Slow-burn threshold: any unresolved issue accumulating > 20 events
  over 24h → triage within 24h of first event.
- Noise rule: `/api/revalidate` 4xx from the ETL job is expected; tag
  and suppress.

### Neon

- Dashboard: https://console.neon.tech → the project.
- Storage: current ~150–200 MB; alert at 400 MB (80% of 500 MB free
  cap). If we cross, upgrade to Launch tier before data grows more.
- Compute hours: free tier is 191.9 hrs/month (scale-to-zero helps);
  watch the monthly projection.
- Autosuspend: should be on. If it's off we burn CU/hr constantly.

### Vercel

- Dashboard: https://vercel.com/<team>/28andthree.
- Bandwidth: 100 GB/mo free; we're expected to use < 1 GB even at
  "soft launch" traffic. Alert at 50% / 80% via Vercel settings.
- Edge Function invocations: the rate-limit middleware runs on every
  `/api/*` + `/status/*` request. Watch for unexpected spikes.
- Build minutes: 400/mo free; we use ~5/month normally.

### Cost (aggregated)

See `docs/runbook.md#budget-alerts`. The rough pre-launch math:

| Service | Free tier | Expected |
|---|---|---|
| Neon | 0.5 GB + 191h CU | ~200 MB + <50h active |
| Vercel | 100 GB bandwidth | <2 GB soft-launch |
| Sentry | 5k events/mo | <500 events with clean deploy |
| GH Actions | 500 min/mo | ~15 min (ETL cron + CI) |
| Fontshare | Free | N/A |

If anything approaches 80% of its free-tier cap, investigate before
public announce.

---

## Monitoring cadence

| Window | Cadence |
|---|---|
| T+0 → T+4h | Every 30 min. Sentry + Vercel request log |
| T+4h → T+12h | Hourly |
| T+12h → T+48h | Every 4 hours during waking hours |
| T+48h → public announce | One final walk of all 4 signals |

Record each check in a session log (scratch file or whatever works for
you). The point isn't the record — it's forcing yourself to actually
look, not just glance.

---

## Abort criteria

Roll back the deploy and pause the soft launch if:

- Sentry shows > 200 events/hour for > 30 min on a single issue.
- Neon storage jumps > 50 MB in an hour with no ETL run (indicates
  write-amplification bug).
- Any "bad number" (NaN, null-as-text, impossible rank) slips past
  the crawler and lands in a soft-launch user's screenshot.
- Vercel reports > 5% 5xx rate on any route for > 15 min.
- Anyone in the soft-launch group spots a number that contradicts
  rbsdm.com or a canonical source by more than 0.05 EPA.

Rollback is `git revert <latest>` + push to `main` — Vercel redeploys
in ~2 min. Neon PITR (see `runbook.md#pitr-drill`) is the DB rollback
nuclear option.

---

## T+48h: public launch decision

Re-walk `docs/LAUNCH_CHECKLIST.md`. If all 16 are ✅, ship:

- Post on Twitter/Bluesky/personal channels.
- Submit to r/Patriots (weekly-thread or data-post rule per subreddit).
- Email any colleagues/writers/analysts you've wanted to show.

Log the launch date somewhere durable:

```bash
echo "public launch: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> docs/launch-log.md
```

Celebrate for roughly 20 minutes, then start watching dashboards again
for the next week — the first real-traffic spike is usually right
after announce.

---

*If the dev that writes this launched the site alone (likely), the
"soft-launch group" is just "a few friends who agreed to poke". That
still counts. The 48h window is for *you* to catch things, not for
them.*
