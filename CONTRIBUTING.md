# Contributing

Solo-maintained repo for now, but these conventions stay in place so the first collaborator doesn't inherit chaos.

## Before you start

1. Read `SPEC.md` §3.5a (data-integrity invariants). Every ETL + render path must respect it.
2. Read `DESIGN.md` for UI work. No hard-coded hex values. No off-spec spacing.
3. Pick up a task via `bd ready`. Claim it: `bd update <id> --claim`.

## Workflow

1. Branch from `main`: `git checkout -b <epic>/<task-id>-<slug>`.
2. Write the failing test(s) first where possible (TDD).
3. Implement.
4. `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`.
5. Commit with trailer `Co-Authored-By: ...` if pair-coded.
6. Open a PR; title: `[E<epic>-<task>] <subject>`. CI will run.
7. After merge: `bd close <id>`.

## Code standards

- **KISS.** Prefer clear code over clever code. Three similar lines beats a premature abstraction.
- **DRY.** Shared helpers live in `/lib/` (web) or `/etl/` (python).
- **Descriptive naming.** No `data1`, `temp`, `foo`.
- **Defensive programming.** Validate at trust boundaries (user input, external APIs). Trust internal code.
- **Comments:** only for non-obvious WHY. Don't narrate WHAT.

## Database changes

- DDL is owned **exclusively** by Drizzle (`db/schema.ts`). Python never creates/alters tables.
- For schema changes:
  1. Edit `db/schema.ts`.
  2. `pnpm db:generate --name=<short-name>` → produces SQL in `/drizzle/`.
  3. Commit both the schema and the generated SQL.
  4. Hand-edit generated SQL only to add `CONCURRENTLY` on index creation against large tables.

## Secrets

- Never commit real secrets. `.env.local` is gitignored; use Dashlane `28-and-three`.
- Vercel env vars for web; GitHub Actions secrets for ETL.

## Running the ETL locally

```bash
cd etl
# Writes a heartbeat row to whatever Neon branch ETL_DATABASE_URL points at.
ETL_DATABASE_URL='postgres://...' uv run python -m etl.main --heartbeat
```
