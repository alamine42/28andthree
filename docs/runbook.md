# Runbook

Operations playbook for 28 and Three. Each section is a named anchor used by deep-links from other docs, alerts, and PRs.

## db-roles

Three logical roles, two physical ones. Neon's built-in `neondb_owner` is already a superuser equivalent for the database and plays the **migrator** role — no separate `migrator` role is created.

| Logical role | Backed by | Privileges | Used by | Env var |
|---|---|---|---|---|
| app_read | `app_read` (created) | `SELECT` on all tables | Next.js server components | `DATABASE_URL` |
| etl_writer | `etl_writer` (created) | `SELECT, INSERT, UPDATE, DELETE` on all tables + sequences | Python ETL | `ETL_DATABASE_URL` |
| migrator | `neondb_owner` (built-in) | Schema owner; full DDL + DML | `drizzle-kit migrate` in CI only | `MIGRATOR_DATABASE_URL` |

**Creation SQL** (one-off, run as `neondb_owner`; already applied to both `main` and `dev` branches 2026-04-17). See `docs/plans/e1-foundation-plan.md` §3.4a for why.

```sql
CREATE ROLE app_read LOGIN PASSWORD :'app_read_pw';
GRANT CONNECT ON DATABASE neondb TO app_read;
GRANT USAGE ON SCHEMA public TO app_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO app_read;

CREATE ROLE etl_writer LOGIN PASSWORD :'etl_writer_pw';
GRANT CONNECT ON DATABASE neondb TO etl_writer;
GRANT USAGE ON SCHEMA public TO etl_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO etl_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO etl_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO etl_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO etl_writer;
```

Passwords live in Dashlane `28-and-three` → `Neon — app_read` / `Neon — etl_writer` / `Neon — neondb_owner (migrator)`.

## schema-changes

Single-branch workflow: commits go direct to `main`; Vercel auto-deploys to prod. There is **no** per-PR preview DB infrastructure (dropped once required PR-review was relaxed).

**Normal schema change:**

```bash
# 1. Edit db/schema.ts
# 2. Generate the migration SQL offline:
pnpm db:generate --name=<kebab-case-name>
# 3. Commit both schema and the generated SQL
# 4. Apply to prod (from local; later automate on merge-to-main):
MIGRATOR_DATABASE_URL='<prod owner URL>' pnpm db:migrate
```

**Risky schema change (destructive, or unclear blast radius):**

There is no `dev` branch on Neon — only `main` (prod). For risky migrations:

1. Generate the SQL with `pnpm db:generate` and **read every line** before committing. Drizzle-kit's output for CHECK constraints, index creation, or column drops is where surprises hide.
2. If the migration touches large tables, hand-edit the generated SQL before applying: `CREATE INDEX CONCURRENTLY`, `NOT VALID` + `VALIDATE` for CHECKs, `SET statement_timeout` guards. See `adding-a-migration` below for the recipes.
3. Create a Neon branch manually via the Neon UI *for that one migration*, apply there, smoke-test, then apply to prod and drop the ephemeral branch. This is explicitly a one-off — we do not keep a standing non-prod branch.

**One-off preview environment when needed** (e.g., design review before merging a UI redo):

- Push a branch; Vercel auto-creates a preview URL for any branch (default behavior, no integration required).
- If the preview needs a non-prod DB: spin up a Neon branch in the Neon UI *ad hoc* for that preview → copy its connection string → set it on the Vercel preview via env override or `.env.preview.local` equivalent. Delete the Neon branch when the preview is done.
- Merge to main when done; Vercel promotes to prod on the next push.

**Rollback path:** `git revert <sha>` + force-reverse the migration. Neon PITR is the last resort (see `etl-rollback` below).

## etl-rollback

Triggered when the weekly ETL lands bad data on prod (wrong aggregations, corrupted plays, nflverse schema regression).

**Decision matrix:**

| Symptom | Rollback path |
|---|---|
| One phase is wrong (e.g., special_teams has 0 rows) | Re-run `--season <y>` after fixing the filter. `ON CONFLICT DO UPDATE` overwrites in place. |
| Plays table contains garbage (duplicates, nulls, wrong team) | Neon PITR to just before the ETL run. |
| `team_phase_*` has impossible values and plays is fine | Re-run `--season <y>`. Aggregation is a pure function of plays + filters. |
| Schema migration partially applied and app is broken | `git revert <sha>` + `MIGRATOR_DATABASE_URL=<prod> pnpm db:migrate` (drizzle emits a down-migration when possible; otherwise reverse manually). |

**Neon PITR recipe** (full plays-table-corruption case):

```bash
# 1. Find the timestamp just before the bad ETL started:
psql "$ETL_DATABASE_URL" -c "SELECT started_at FROM meta_refresh WHERE status='ok' ORDER BY started_at DESC LIMIT 5;"

# 2. Create a recovery branch in Neon at that timestamp:
neonctl branches create --parent main --pitr 2026-04-18T14:00:00Z --name pre-bad-etl

# 3. Verify the branch has clean data:
psql "$RECOVERY_DATABASE_URL" -c "SELECT COUNT(*) FROM plays;"

# 4. Promote the branch (swaps it in as the new main):
neonctl branches set-default pre-bad-etl

# 5. Update Vercel env if connection string changed; force redeploy:
vercel --prod --force
```

**Quarterly drill:** run steps 1–3 on the `dev` branch against a recent PITR point. The first time you do this for real should not be the first time you've done it.

See also: `etl-failure` below for the decision tree when a run fails rather than lands bad data.

## etl-failure

Open issue labeled `etl-failure-urgent` means the Wednesday summary watcher (`.github/workflows/etl-summary.yml`) found no `status='ok'` in `meta_refresh` since the start of this week.

Triage:

1. **`/status` page on prod.** Does it show `running`, `failed`, or `heartbeat`?
   - `failed` → `error_text` column has the traceback. Jump to step 3.
   - `heartbeat` → the freshness gate short-circuited. Read `source_version` → it's `etl@0.2.0:<reason>` where reason is one of `already_loaded`, `offseason`, `nflverse_schedule_unavailable`, `nflverse_on_different_season_*`.
   - `running` → a job crashed without cleanup. Dispatch `etl.yml` mode=heartbeat to overwrite, then investigate.
2. **Sentry ETL project.** Correlation id in structured JSON logs.
3. **GH Actions run log.** Common failure modes:
   - nflverse schema regression → contract test #7 (null-EPA). Pin `nflreadpy` version; file upstream.
   - Neon connection timeout during long-running backfill → retry; per-season commits mean only the failing season re-runs.
   - Advisory-lock conflict → another run in flight. Wait or cancel duplicate.
4. **Manual retry.** `gh workflow run etl.yml --field mode=season --field season=2026`. For a full rebuild: `--field mode=full`.

## status-data-auth

`/status/data` (JSON admin endpoint per plan §3.9) uses a static shared secret compared in constant time + a durable Upstash rate limit.

**Token rotation** (quarterly):

```bash
NEW_TOKEN=$(openssl rand -hex 32)
echo "$NEW_TOKEN"  # archive in Dashlane: 28-and-three / STATUS_ADMIN_TOKEN

vercel env rm STATUS_ADMIN_TOKEN production --yes
echo "$NEW_TOKEN" | vercel env add STATUS_ADMIN_TOKEN production

vercel env rm STATUS_ADMIN_TOKEN preview --yes
echo "$NEW_TOKEN" | vercel env add STATUS_ADMIN_TOKEN preview

vercel --prod
```

**Suspected token leak** (spike in `vercel logs prod --since=24h | grep status-data`): rotate immediately. Upstash dashboard shows offending IPs. No user data exposed since the endpoint only returns aggregated team-level rankings.

**Preview-only gate:** through 2026-05-18 (30 days post-E2), prod requests return 404 regardless of the token. Invoke via preview URL. Gate auto-lifts on that date.

## budget-alerts

Alert destinations (see `docs/budget.md` for thresholds):

| Service | Free tier | 50% / 80% alert |
|---|---|---|
| Neon | 0.5 GB storage | Neon console → Project Settings → Notifications → Email |
| Vercel | 100 GB bandwidth | Vercel dashboard → Usage → Alert thresholds |
| Sentry | 5K events/mo | Sentry → Settings → Subscription → Usage alerts |
| GitHub Actions | 500 / 2000 min-mo | `.github/workflows/budget-check.yml` weekly (E1-14) |
| Fontshare | N/A (free) | Manual quarterly check |

Alerts route to `alamine@gmail.com` primary. See E1-14 for script.

## sentry-on-call

- Web project: `28-and-three-web` — alerts on error rate > 5/hr for 30min.
- ETL project: `28-and-three-etl` — alerts on missed cron check-in (Crons feature).
- When alerted: check the Sentry issue, then correlate with the most recent merge + ETL run (see `/status` page for the latter).
- Rollback path: `git revert <sha>` + push to `main`. No direct hotfixes on production.

## adding-a-migration

See `schema-changes` above for the full flow. TL;DR:

1. Edit `db/schema.ts`.
2. `pnpm db:generate --name=<kebab-case-name>`.
3. Review generated SQL in `/drizzle/`; add `CONCURRENTLY` on any index creation against tables > 100k rows.
4. For **CHECK constraints** on existing tables: drizzle-kit emits an immediate `ADD CONSTRAINT ... CHECK`, which scans the entire table and aborts if any row violates. For safety, edit the SQL to use the `NOT VALID` + `VALIDATE` pattern:
   ```sql
   -- Replace: ALTER TABLE foo ADD CONSTRAINT bar CHECK (...);
   -- With:
   ALTER TABLE foo ADD CONSTRAINT bar CHECK (...) NOT VALID;
   -- Manually clean up drifted rows (or run an UPDATE here).
   ALTER TABLE foo VALIDATE CONSTRAINT bar;
   ```
   This lets the migration succeed on a dirty environment; you fix data separately, then validate.
5. Commit both.
6. Apply to prod: `MIGRATOR_DATABASE_URL='<owner URL>' pnpm db:migrate`.
7. (Future) Automate step 6 in CI on push to `main` — currently manual.

## neon-outage

**Symptom:** Next app surfaces DB errors (500s on `/`, `/phases/*`, `/players/*`); Sentry `web` project fires a spike alert; `/status` either 500s or shows stale `meta_refresh` rows.

**First responder steps:**

1. Confirm the outage is upstream, not ours:
   ```bash
   curl -sI https://status.neon.tech/api/v2/status.json | head -3
   curl -s https://status.neon.tech/api/v2/incidents/unresolved.json | jq '.incidents[0].name, .incidents[0].status'
   ```
2. Check the Neon console → Branches → `main` for compute status and any "paused" indicator.
3. Post to any active incident on Neon's status page to confirm the blast radius matches.
4. **Mitigate:** since Vercel ISR caches pages for 1h (`revalidate = 3600`), most traffic keeps hitting cached HTML even while the DB is down. Do not trigger a redeploy — that invalidates the cache and would amplify impact. Verify via browser that `/` still renders.
5. For errors surfacing on non-cached paths (e.g., `/status`, on-demand revalidation targets), let them 500 and wait — the site's "last refresh" dot in the footer communicates staleness honestly.
6. If the outage crosses 30 minutes: post a single note on the public Status page (when we have one) pointing at Neon's status. Until then: no user-facing communication required.

**Post-incident:**

- Review Neon usage: was our CU/hr allotment close to a limit?
- Document recovery time; if > 1 hour twice in 30 days, evaluate standby in a second region.

## sentry-spike

**Symptom:** Sentry alert fires (error rate > 5/hr for 30min) OR an issue gets > 50 events in 1h (triggers "hot issue" paging rule).

**First responder steps:**

1. Open the offending issue in Sentry. Read the stack trace + `digest` if it came from `app/error.tsx`.
2. Correlate with:
   - Most recent merge to `main` (`git log main -n 5 --format=oneline`).
   - Most recent ETL run (`/status` page → latest `meta_refresh` row).
3. Decide category:
   - **Regression from a recent deploy** → `git revert <sha>` + push. Vercel redeploys in ~2min.
   - **Data-shape change** (e.g., nflverse schema drift) → run contract test suite locally (`cd etl && uv run pytest tests/test_contracts.py`). If it's a missing column, see `etl-failure` below.
   - **3rd-party scraper / bad bot** — confirm via the `request.url` field on the Sentry event. If requests cluster on a malformed path, it's noise; add a Sentry "inbox rule" to ignore that URL pattern and close.
4. Never silence an issue without either a commit fix or a documented tag.

**Noise suppression:** Sentry `beforeSend` in `instrumentation-client.ts` already strips cookies + authorization headers. If you see PII leaking into an event, that's a P0 patch to `beforeSend`.

**Event budget:** free tier is 5K events/mo. A spike that burns > 500 events/hr for > 4 hours will blow quota mid-month — escalate to `git revert` sooner rather than waiting for root cause.

## bad-data-publish

**Symptom:** UI shows an obviously wrong number (e.g., rank `NaN`, an impossible EPA, a player attributed to the wrong team). The `no-bad-numbers` e2e crawler would have caught `NaN`/`null`/`undefined`/`0.0`, so this is usually a *valid but incorrect* number — semantically wrong, not syntactically wrong.

**First responder steps:**

1. Triage the scope: is it one row in one phase, or a site-wide shape (e.g., every rank shifted by one)?
2. Pull the raw play-by-play for the affected week:
   ```bash
   ETL_DATABASE_URL='<prod etl_writer url>' \
     uv run --project etl python -c "
   from etl.db import conn
   with conn() as c, c.cursor() as cur:
       cur.execute('SELECT * FROM plays WHERE season = %s AND week = %s LIMIT 20', (2025, 14))
       for r in cur.fetchall(): print(r)
   "
   ```
3. Cross-check against rbsdm / FTN for the same phase/week. Divergence > 0.01 EPA is suspicious; divergence > 0.10 is almost certainly a bug.
4. If the bug is in aggregation (ETL SQL): roll forward with a fix in `etl/transform/phases.py`, redeploy ETL, re-run `--full` backfill.
5. If the bug is in display (wrong formatter, wrong semantic map): roll back the offending commit.
6. Nuclear option: Neon PITR (Point-in-Time Restore) to just-before the bad ETL run. See `etl-rollback` section.
7. Post a retraction: edit the methodology page with a one-line note dating the bad publish window and the correction. Quiet transparency > silent fix.

**Prevention:** `etl/tests/test_contracts.py` golden values (contract test #12) is the primary guardrail. Anchor new golden values after any meaningful data-shape change.

## dns-issue

**Symptom:** `28andthree.com` times out, NXDOMAIN, or resolves to the wrong IP. Browser cert warning ("your connection is not private") often precedes the NXDOMAIN hint.

**First responder steps:**

1. Run from a few vantage points:
   ```bash
   dig 28andthree.com +short
   dig www.28andthree.com +short
   dig @1.1.1.1 28andthree.com +short   # bypass local resolver
   ```
2. Compare against Vercel's expected A/CNAME records:
   - Apex `28andthree.com` → `76.76.21.21` (Vercel)
   - `www.28andthree.com` → `cname.vercel-dns.com`
3. Log into the registrar (Porkbun — credentials in Dashlane `28-and-three` → `Registrar`). DNS records live in Porkbun's DNS panel *or* are delegated to Vercel's nameservers (check NS records for the zone).
4. Common breaks:
   - Someone added a conflicting record in the registrar while nameservers are delegated to Vercel → remove it.
   - TTL is too high; a good change hasn't propagated yet — confirm with `dig +trace`.
5. **Cert expiry loop with DNS:** Vercel auto-renews Let's Encrypt via HTTP-01 challenge. If DNS is misconfigured, renewal fails silently. See `cert-expiry` next.

**Post-incident:** If the outage crossed 30 min, lower TTLs on A/CNAME to 300s so the next mitigation propagates faster.

## cert-expiry

**Symptom:** Browser cert warning, Sentry `NET::ERR_CERT_DATE_INVALID` events, or Vercel dashboard banner about a failed renewal.

**First responder steps:**

1. Confirm cert state:
   ```bash
   openssl s_client -connect 28andthree.com:443 -servername 28andthree.com </dev/null 2>/dev/null \
     | openssl x509 -noout -dates
   ```
   (`notAfter` should be > 14 days out; Vercel renews at T-30.)
2. Vercel dashboard → Domains → `28andthree.com` → Certificates. Look for a failed-renewal warning.
3. Most common cause: DNS was changed and the HTTP-01 challenge can't resolve. Fix the DNS first (see `dns-issue`), then hit the "Renew" button in the Vercel domains panel.
4. Emergency fallback: Vercel will serve a self-signed cert while the correct one is issued; document a one-line status page note if the outage lasts > 15 min.

**Prevention:** Set a calendar reminder 60 days before the cert's `notAfter` as a belt-and-suspenders check against Vercel's T-30 auto-renewal.

## domain-expiry

**Symptom:** WHOIS shows the domain in "pendingDelete" or "redemption". Registrar sends notices that were probably ignored.

**First responder steps:**

1. `whois 28andthree.com | grep -iE "expir|status"` — confirm current expiry + status.
2. Log into Porkbun with the credentials in Dashlane. Renew immediately — a renewal inside the 30-day grace period is free; once the domain enters "redemption" (35–80 days after expiry) it costs $80+ to recover.
3. Verify auto-renew is ON in the registrar UI and that the payment method on file isn't expired.
4. Renew for at least 2 years so the notice cadence stabilizes.

**Prevention:** Annual calendar reminder at `notBefore + 10mo` (i.e., 60 days before expiry). Auto-renew is the primary; the reminder is the backup.

## dependency-cve

**Symptom:** GitHub Dependabot or `pnpm audit` flags a HIGH or CRITICAL CVE in a dependency we ship.

**First responder steps:**

1. Classify the blast radius:
   - Is it in a runtime dep (`dependencies`) or dev dep (`devDependencies`)?
   - Does it run at request time, at build time, or only in CI?
2. For runtime + server-side deps (Drizzle, pg, next, @sentry/nextjs, @upstash/*, zod): treat as P1. Patch within 24h.
3. For build/dev deps (ESLint, Playwright, TS, Prettier): treat as P3. Patch in the next routine update.
4. Apply the patch:
   ```bash
   pnpm update <package>@<fixed-version>
   pnpm test && pnpm test:e2e tests/e2e/a11y.spec.ts tests/e2e/metadata.spec.ts
   ```
5. For transitive-only fixes, `pnpm update --recursive` or `pnpm why <package>` to find the parent.
6. If no fix is available upstream: add a `pnpm.overrides` entry in `package.json` pinning to a safe version. Re-check on upstream release.
7. Commit with message `deps: patch CVE-YYYY-NNNNN in <package>` and link to the advisory.

**Baseline:** `pnpm audit --audit-level=high` runs in CI (see `.github/workflows/ci.yml`); a HIGH vuln fails the pipeline.

## vercel-outage

**Symptom:** 28andthree.com returns Vercel branded 5xx, or status page https://www.vercel-status.com shows an ongoing incident.

**First responder steps:**

1. Check Vercel's status page: https://www.vercel-status.com. Confirm the component affected (Edge Network / Serverless / Build / DNS).
2. If **Edge Network**: nothing to do from our side. Traffic returns when Vercel recovers. ISR-cached pages may still serve from regional caches even during partial outages.
3. If **Serverless functions**: `/api/revalidate` + `/status/data` + `/og` go down. Public pages stay up from cache. Wait.
4. If **Build/Deploy**: a pending deploy may be stuck. Cancel and re-queue from the dashboard. Avoid pushing new commits until the platform recovers — they queue up and deploy in order on the wrong side of the incident.
5. **No self-hosted fallback.** The architecture assumes Vercel. If an outage crosses 4 hours we post a status note on our GitHub README (fans have been linked there from the disclaimer footer).

**Post-incident:** cross-reference the Vercel RCA with our ETL cron schedule — if an ETL window collided with the outage, manually dispatch `etl.yml` with `mode=full` to re-run.

**Post-outage checklist (any category):** verify that `/status` last-refresh dot is current, that the footer disclaimer still renders, and that both CSP + rate-limit headers are back on `/` (`curl -I /`).
