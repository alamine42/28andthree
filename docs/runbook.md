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

(E2 will fill this in. Stub today: use Neon PITR to restore the `main` branch to the pre-ETL snapshot.)

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
4. Commit both.
5. Apply to prod: `MIGRATOR_DATABASE_URL='<owner URL>' pnpm db:migrate`.
6. (Future) Automate step 5 in CI on push to `main` — currently manual.
