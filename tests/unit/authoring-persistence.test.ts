import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSlug,
  hashMarkdown,
  isAllowedTransition,
} from '@/lib/authoring/persistence';

describe('hashMarkdown', () => {
  test('should_be_deterministic', () => {
    assert.equal(hashMarkdown('hello'), hashMarkdown('hello'));
  });

  test('should_differ_for_different_inputs', () => {
    assert.notEqual(hashMarkdown('a'), hashMarkdown('b'));
  });

  test('should_be_64_hex_chars_for_sha256', () => {
    assert.match(hashMarkdown('whatever'), /^[a-f0-9]{64}$/);
  });
});

describe('buildSlug', () => {
  test('should_lowercase_and_join_with_hyphens', () => {
    assert.equal(buildSlug('opponent_preview', '2025-w08-bills'), '2025-w08-bills-opponent-preview');
  });

  test('should_strip_special_characters', () => {
    assert.equal(buildSlug('recap', '2025_W08_Bills!'), '2025-w08-bills--recap');
  });
});

describe('isAllowedTransition (state machine §3.11)', () => {
  test('draft_to_approved_should_be_allowed', () => {
    assert.equal(isAllowedTransition('draft', 'approved'), true);
  });

  test('approved_to_exported_should_be_allowed', () => {
    assert.equal(isAllowedTransition('approved', 'exported'), true);
  });

  test('exported_to_published_should_be_allowed', () => {
    assert.equal(isAllowedTransition('exported', 'published'), true);
  });

  test('exported_to_approved_should_be_allowed_for_cancel_export', () => {
    assert.equal(isAllowedTransition('exported', 'approved'), true);
  });

  test('approved_to_published_should_NOT_be_allowed_directly', () => {
    // Codex WARNING #4 fix: must go through exported state
    assert.equal(isAllowedTransition('approved', 'published'), false);
  });

  test('published_should_only_allow_archive', () => {
    assert.equal(isAllowedTransition('published', 'draft'), false);
    assert.equal(isAllowedTransition('published', 'archived'), true);
  });

  test('idempotent_self_transition_should_be_allowed', () => {
    assert.equal(isAllowedTransition('draft', 'draft'), true);
  });

  test('rejected_to_draft_should_allow_restoration', () => {
    assert.equal(isAllowedTransition('rejected', 'draft'), true);
  });
});
