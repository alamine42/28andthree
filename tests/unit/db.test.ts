import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, resetDbForTests } from '../../lib/db';
import { resetEnvForTests } from '../../lib/env';

describe('lib/db.ts', () => {
  beforeEach(() => {
    resetEnvForTests();
    resetDbForTests();
    delete process.env.DATABASE_URL;
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  it('should_return_undefined_when_DATABASE_URL_missing', () => {
    const db = getDb();
    assert.equal(db, undefined);
  });

  it('should_return_defined_client_when_DATABASE_URL_present', () => {
    process.env.DATABASE_URL = 'postgres://user:pw@localhost:5432/db';
    const db = getDb();
    assert.notEqual(db, undefined);
  });

  it('should_cache_client_singleton_across_calls', () => {
    process.env.DATABASE_URL = 'postgres://user:pw@localhost:5432/db';
    const first = getDb();
    const second = getDb();
    assert.equal(first, second);
  });
});
