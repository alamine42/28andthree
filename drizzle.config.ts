import { defineConfig } from 'drizzle-kit';

// Migrations use MIGRATOR_DATABASE_URL (higher privilege than the app role).
// Set via CI secrets for prod + preview branches. See docs/runbook.md#db-roles.
// For `drizzle-kit generate` (local, offline SQL generation) a placeholder is
// fine — the URL is only dereferenced by `push` / `migrate`.
const migratorUrl =
  process.env.MIGRATOR_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: migratorUrl },
  strict: true,
  verbose: true,
});
