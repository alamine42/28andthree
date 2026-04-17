# Runbook

Operations playbook for 28 and Three. Each section is a named anchor used by deep-links from other docs, alerts, and PRs.

## db-roles

Three Neon roles with least privilege:

| Role | Privileges | Used by | Env var |
|---|---|---|---|
| `app_read` | `SELECT` on all tables | Next.js server components | `DATABASE_URL` |
| `etl_writer` | `SELECT, INSERT, UPDATE, DELETE` on all tables + sequences | Python ETL | `ETL_DATABASE_URL` |
| `migrator` | Schema owner; full DDL + DML | `drizzle-kit migrate` in CI only | `MIGRATOR_DATABASE_URL` |

**Creation SQL (one-off, run as `migrator` in Neon SQL console):**

```sql
-- App read-only role
CREATE ROLE app_read LOGIN PASSWORD '<random>';
GRANT CONNECT ON DATABASE twentyeightandthree TO app_read;
GRANT USAGE ON SCHEMA public TO app_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_read;

-- ETL writer role
CREATE ROLE etl_writer LOGIN PASSWORD '<random>';
GRANT CONNECT ON DATABASE twentyeightandthree TO etl_writer;
GRANT USAGE ON SCHEMA public TO etl_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO etl_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO etl_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO etl_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO etl_writer;
```

Passwords live in Dashlane `28-and-three` → `Neon — app_read` / `Neon — etl_writer` / `Neon — migrator`.

## preview-migrations

Neon-Vercel integration spawns a per-PR branch on every PR. Before any Playwright test hits the preview URL, the `.github/workflows/preview-migrate.yml` workflow runs `pnpm db:migrate` against that branch using `PREVIEW_MIGRATOR_DATABASE_URL`.

**One-time setup in Neon-Vercel integration:**

1. Neon console → Integrations → Vercel.
2. When installing the integration, check "Create environment variables for preview branches."
3. Set preview-branch env var `MIGRATOR_DATABASE_URL` (template: `${NEON_BRANCH_URL}/twentyeightandthree?sslmode=require`).
4. In GitHub repo settings → Secrets → Actions, add `PREVIEW_MIGRATOR_DATABASE_URL` mirroring the Neon-Vercel-managed var.

**If a preview deploy reports a schema mismatch:**

- Check the preview-migrate workflow run for that PR.
- If the migration step failed, re-run with fresh credentials (`gh workflow run preview-migrate.yml -f database_url=<url>`).
- If it succeeded but the app still sees stale schema, the preview branch may have been created from a stale prod snapshot; delete the Neon branch and re-open the PR.

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

1. Edit `db/schema.ts`.
2. `pnpm db:generate --name=<kebab-case-name>`.
3. Review generated SQL in `/drizzle/`; add `CONCURRENTLY` on any index creation against tables > 100k rows.
4. Commit both.
5. CI runs `drizzle-kit migrate` in the preview-migrate workflow against the per-PR Neon branch.
6. On merge to `main`, CI runs the migration against prod (Neon `main` branch) before Vercel deploys the new build.
