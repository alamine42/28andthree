# 28 and Three — Claude Code instructions

## Project
Advanced analytics web app for New England Patriots fans. See `SPEC.md` for the complete product + technical specification, including the data-integrity rules in §3.5a that every ETL and render path must respect.

## Design System
Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, aesthetic direction, and component conventions are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Stack
- Next.js 15 (App Router, TypeScript) on Vercel, **pnpm 9 + Node 22 LTS** (not Bun — see `docs/plans/e1-foundation-plan-adversarial-review.md`)
- Neon Postgres — two roles (`app_read`, `etl_writer`) + `neondb_owner` as migrator; see `docs/runbook.md#db-roles`
- Python 3.12 ETL via **uv** (not pip/poetry) on GitHub Actions cron. Note: `nfl_data_py 0.3.3` does not build on Python 3.12 — see `docs/solutions/build-errors/nfl-data-py-pandas-python-312-build-failure.md` before adding it as a dep.
- Drizzle ORM (DDL); psycopg3 (Python DML)
- Tailwind 3 + Recharts (E3+)
- Sentry (web + etl projects)
- See `SPEC.md` §4 for the full architecture and `docs/plans/e1-foundation-plan.md` for Sprint 1 specifics.

## Workflow
Single-branch: commits land on `main`, Vercel auto-deploys to prod. No required PRs, no per-PR Neon branches. Schema changes: `pnpm db:generate` → commit → `MIGRATOR_DATABASE_URL=<prod> pnpm db:migrate` (test on `dev` first for risky ones). See `docs/runbook.md#schema-changes`.

## Testing
Per `SPEC.md` §8: data contract tests in the ETL (primary), Playwright smoke E2E for key pages. No broad unit-test pyramid — bugs will be in the data, not component render logic.
- Node unit tests: `pnpm test` (uses `tsx --test`, not Jest/Vitest).
- E2E: `pnpm test:e2e` (chromium per-PR; `PLAYWRIGHT_NIGHTLY=1` for full matrix).
- Python: `cd etl && uv run pytest`.

## Knowledge base
Solved problems + architecture decisions live in `docs/solutions/`. Before debugging a non-trivial issue, check there first:
```bash
grep -r "<keyword>" docs/solutions/
```
Categories: `build-errors`, `integration-issues`, `runtime-errors`, `gotchas`, `architecture`, `best-practices`. When you fix something non-trivial, run `/consolidate` to add to the knowledge base.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
