import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getServerEnv, resetEnvForTests } from '../../lib/env';

describe('lib/env.ts', () => {
  beforeEach(() => {
    resetEnvForTests();
    // Arrange: scrub any ambient vars set by the shell between cases.
    delete process.env.DATABASE_URL;
    delete process.env.MIGRATOR_DATABASE_URL;
    delete process.env.ALLOW_DEBUG_TRIGGER;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  it('should_accept_env_with_only_NODE_ENV_set', () => {
    const env = getServerEnv();
    assert.equal(env.NODE_ENV, 'test');
    assert.equal(env.DATABASE_URL, undefined);
  });

  it('should_parse_valid_postgres_DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pw@host:5432/db?sslmode=require';
    const env = getServerEnv();
    assert.equal(env.DATABASE_URL, 'postgres://user:pw@host:5432/db?sslmode=require');
  });

  it('should_reject_non_postgres_DATABASE_URL', () => {
    process.env.DATABASE_URL = 'http://not-a-db/';
    assert.throws(() => getServerEnv(), /Invalid server environment/);
  });

  it('should_reject_malformed_DATABASE_URL', () => {
    process.env.DATABASE_URL = 'not-a-url-at-all';
    assert.throws(() => getServerEnv(), /Invalid server environment/);
  });

  it('should_coerce_ALLOW_DEBUG_TRIGGER_to_boolean', () => {
    process.env.ALLOW_DEBUG_TRIGGER = 'true';
    const env = getServerEnv();
    assert.equal(env.ALLOW_DEBUG_TRIGGER, true);
  });

  it('should_default_ALLOW_DEBUG_TRIGGER_to_false_when_unset', () => {
    const env = getServerEnv();
    assert.equal(env.ALLOW_DEBUG_TRIGGER, false);
  });

  it('should_cache_parsed_env_across_calls', () => {
    process.env.DATABASE_URL = 'postgres://a/db';
    const first = getServerEnv();
    process.env.DATABASE_URL = 'postgres://b/db';
    const second = getServerEnv();
    assert.equal(second.DATABASE_URL, first.DATABASE_URL);
    assert.equal(first, second);
  });
});
