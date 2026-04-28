import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  authoringDrafts,
  authoringBacklog,
  authoringSchedules,
  authoringRuns,
  AUTHORING_DRAFT_STATUSES,
  AUTHORING_BACKLOG_STATUSES,
  AUTHORING_SCHEDULE_STATUSES,
  AUTHORING_FACTCHECK_STATUSES,
  AUTHORING_TRIGGERS,
} from '@/db/schema';

// L0-01: Drizzle schema for authoring tables.
//
// Schema-only tests — no DB connection. We assert the shape of the table
// objects (Drizzle compiles the column definitions into properties on the
// table object). This catches "schema didn't compile" + "column missing"
// without needing a real Postgres.

describe('authoring_drafts schema', () => {
  test('should_have_text_primary_key_named_id', () => {
    const col = authoringDrafts.id;
    assert.equal(col.name, 'id');
    assert.equal(col.primary, true);
  });

  test('should_have_required_markdown_content_column', () => {
    // CRITICAL #1 fix: drafts persist as text in the DB, not on filesystem.
    const col = authoringDrafts.markdownContent;
    assert.equal(col.name, 'markdown_content');
    assert.equal(col.notNull, true);
  });

  test('should_have_unique_slug', () => {
    const col = authoringDrafts.slug;
    assert.equal(col.name, 'slug');
    assert.equal(col.isUnique, true);
  });

  test('should_have_status_with_correct_default', () => {
    const col = authoringDrafts.status;
    assert.equal(col.name, 'status');
    assert.equal(col.default, 'draft');
    assert.equal(col.notNull, true);
  });

  test('should_have_factcheck_status_with_correct_default', () => {
    const col = authoringDrafts.factcheckStatus;
    assert.equal(col.default, 'pending');
    assert.equal(col.notNull, true);
  });

  test('should_NOT_have_filepath_column_post_codex_critical_1', () => {
    // v2 explicitly drops the filesystem mirror. If this test ever fails,
    // someone re-introduced the dual-storage pattern.
    assert.equal(
      'filepath' in (authoringDrafts as unknown as Record<string, unknown>),
      false,
    );
  });
});

describe('authoring_backlog schema', () => {
  test('should_have_status_default_pending', () => {
    assert.equal(authoringBacklog.status.default, 'pending');
  });

  test('should_have_priority_default_2', () => {
    assert.equal(authoringBacklog.priority.default, 2);
  });

  test('should_have_used_in_draft_id_column', () => {
    // FK to authoringDrafts.id is asserted at the migration SQL level.
    assert.equal(authoringBacklog.usedInDraftId.name, 'used_in_draft_id');
  });
});

describe('authoring_schedules schema', () => {
  test('should_have_status_default_queued', () => {
    assert.equal(authoringSchedules.status.default, 'queued');
  });

  test('should_have_attempts_default_zero', () => {
    assert.equal(authoringSchedules.attempts.default, 0);
  });
});

describe('authoring_runs schema', () => {
  test('should_have_serial_primary_key', () => {
    assert.equal(authoringRuns.id.primary, true);
  });

  test('should_have_required_trigger_column', () => {
    assert.equal(authoringRuns.trigger.notNull, true);
  });

  test('should_have_required_model_column', () => {
    assert.equal(authoringRuns.model.notNull, true);
  });
});

describe('authoring status enums (TS-side mirrors of CHECK constraints)', () => {
  test('AUTHORING_DRAFT_STATUSES_should_match_state_machine', () => {
    // Exact set per plan §3.11 state machine
    assert.deepEqual(
      [...AUTHORING_DRAFT_STATUSES].sort(),
      ['approved', 'archived', 'draft', 'exported', 'published', 'rejected'],
    );
  });

  test('AUTHORING_BACKLOG_STATUSES_should_match_state_machine', () => {
    assert.deepEqual(
      [...AUTHORING_BACKLOG_STATUSES].sort(),
      ['archived', 'pending', 'scheduled', 'used'],
    );
  });

  test('AUTHORING_SCHEDULE_STATUSES_should_match', () => {
    assert.deepEqual(
      [...AUTHORING_SCHEDULE_STATUSES].sort(),
      ['completed', 'failed', 'queued', 'running', 'skipped'],
    );
  });

  test('AUTHORING_FACTCHECK_STATUSES_should_match', () => {
    assert.deepEqual([...AUTHORING_FACTCHECK_STATUSES].sort(), ['fail', 'pass', 'pending']);
  });

  test('AUTHORING_TRIGGERS_should_match', () => {
    assert.deepEqual(
      [...AUTHORING_TRIGGERS].sort(),
      ['cli', 'cron', 'regenerate_section', 'studio_button'],
    );
  });
});
