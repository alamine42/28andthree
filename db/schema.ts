import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// meta_refresh tracks every ETL run. E1-06 ships this; later epics add
// plays/games/team_phase_weekly/etc.
// status values: 'running' | 'ok' | 'failed' | 'heartbeat'
export const metaRefresh = pgTable('meta_refresh', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull(),
  season: integer('season'),
  week: integer('week'),
  sourceVersion: varchar('source_version', { length: 40 }),
  rowCounts: jsonb('row_counts').$type<Record<string, number>>(),
  errorText: text('error_text'),
});

export type MetaRefresh = typeof metaRefresh.$inferSelect;
export type NewMetaRefresh = typeof metaRefresh.$inferInsert;
