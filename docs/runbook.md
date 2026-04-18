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

```bash
# Test on dev branch first
MIGRATOR_DATABASE_URL='<dev owner URL>' pnpm db:migrate
# Verify app behavior against the dev branch in a local dev run
DATABASE_URL='<dev app_read URL>' pnpm dev
# When satisfied, apply to prod
```

**One-off preview environment when needed** (e.g., design review before merging a UI redo):

- Push a branch; Vercel auto-creates a preview URL for any branch (default behavior, no integration required).
- If the preview needs a non-prod DB: create a Neon branch manually via Neon UI → copy its connection string → set it on the Vercel preview via env override or `.env.preview.local` equivalent.
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
