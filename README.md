# 28 and Three

Advanced analytics for the New England Patriots — built for fans who read the box score twice.

**Status:** pre-launch. Sprint 1 (E1 Foundation) complete. Live at **[28andthree.com](https://28andthree.com)**. See `IMPLEMENTATION.md` for the full plan.

## Source-of-truth docs

- [`SPEC.md`](./SPEC.md) — product + technical spec. §3.5a data-integrity rules are load-bearing.
- [`DESIGN.md`](./DESIGN.md) — full design system (tokens, type, spacing, components).
- [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) — 7 epics, 6 sprints, ~120 tasks.
- [`docs/plans/e1-foundation-plan.md`](./docs/plans/e1-foundation-plan.md) — Sprint 1 architecture plan.
- [`docs/preflight.md`](./docs/preflight.md) — E0 signoff record.

## Stack

- **Web:** Next.js 15 (App Router, TypeScript) on Vercel, pnpm 9, Node 22 LTS.
- **DB:** Neon Postgres with branch-per-PR. Drizzle ORM for schema + migrations.
- **ETL:** Python 3.12 managed by uv, via GitHub Actions cron.
- **UI:** Tailwind 3, self-hosted fonts via `next/font`, Recharts.
- **Observability:** Sentry (two projects — web + etl), Lighthouse CI (info-only in E1).

## Local setup

```bash
# 1. Toolchain (one-time)
nvm use                 # Node 22 from .nvmrc
npm install -g pnpm@9
brew install uv         # or: curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Clone and install
git clone git@github.com:alamine42/28andthree.git
cd 28andthree
pnpm install
cp .env.example .env.local    # fill from Dashlane "28-and-three"

# 3. Python ETL
cd etl
uv sync
cd ..

# 4. Run dev server
pnpm dev                      # → http://localhost:3000
```

## Common commands

```bash
pnpm dev                   # Next.js dev server
pnpm typecheck             # tsc --noEmit
pnpm lint                  # next lint
pnpm test                  # Node test runner (unit)
pnpm test:e2e              # Playwright chromium (add --project=<browser> for nightly matrix)
pnpm build                 # Production build
pnpm db:generate           # drizzle-kit generate (offline SQL from schema)
pnpm db:migrate            # drizzle-kit migrate (needs MIGRATOR_DATABASE_URL)

# Python ETL
cd etl
uv run python -m etl.main --heartbeat
uv run pytest
```

## Repository layout

```
/app/                # Next.js App Router pages
/components/         # React components
/lib/                # env, db, util helpers
/db/                 # Drizzle schema (DDL source of truth)
/drizzle/            # drizzle-kit migration SQL
/etl/                # Python ETL (uv, pyproject.toml)
/public/             # static assets, self-hosted fonts
/tests/
  /unit/             # Node unit tests (env.ts, db.ts)
  /e2e/              # Playwright specs
/docs/
  /plans/            # Architecture plans per epic
  /preflight.md      # E0 gate record
  /runbook.md        # operations runbook
/.github/workflows/  # CI + ETL workflows
```

## Branching & PRs

See `IMPLEMENTATION.md` §0.2. Branch: `<epic>/<task-id>-<kebab-slug>`. PR title: `[E<epic>-<task>] <subject>`. Pre-landing review covered by `.github/workflows/ci.yml`.

## License

All rights reserved — this is not yet a published product. Data attributions live in the footer; see `docs/licenses.md` for full licensing.
