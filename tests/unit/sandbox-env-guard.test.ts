import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxNotInProd } from '../../lib/sandbox/env-guard';

// E8-01 + codex F3: the prod-safety check lives in instrumentation.ts
// so it fires once at process start (before any request). The pure
// function exported from lib/sandbox/env-guard is what instrumentation.ts
// calls — we unit-test the function here; the wiring is covered by the
// e2e boot smoke.

type EnvSnapshot = Record<string, string | undefined>;
const ORIGINAL: EnvSnapshot = {};
// TS's strict @types/node marks NODE_ENV readonly. Use a mutable view
// so tests can toggle it without suppressing the check site-wide.
const env = process.env as Record<string, string | undefined>;

function stash(keys: string[]) {
  for (const k of keys) ORIGINAL[k] = env[k];
}
function restore() {
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
}

afterEach(restore);

describe('assertSandboxNotInProd — prod combinations', () => {
  it('should_throw_when_sandbox_is_on_and_vercel_env_is_production', () => {
    stash(['NEXT_PUBLIC_SANDBOX_MODE', 'VERCEL_ENV']);
    env.NEXT_PUBLIC_SANDBOX_MODE = '1';
    env.VERCEL_ENV = 'production';
    assert.throws(assertSandboxNotInProd, /NEXT_PUBLIC_SANDBOX_MODE=1.*production/);
  });

  it('should_throw_when_sandbox_is_on_and_node_env_is_production', () => {
    stash(['NEXT_PUBLIC_SANDBOX_MODE', 'VERCEL_ENV', 'NODE_ENV']);
    env.NEXT_PUBLIC_SANDBOX_MODE = '1';
    delete env.VERCEL_ENV;
    env.NODE_ENV = 'production';
    assert.throws(assertSandboxNotInProd, /NEXT_PUBLIC_SANDBOX_MODE=1.*production/);
  });
});

describe('assertSandboxNotInProd — safe combinations', () => {
  it('should_not_throw_when_sandbox_is_off_in_production', () => {
    stash(['NEXT_PUBLIC_SANDBOX_MODE', 'VERCEL_ENV']);
    delete env.NEXT_PUBLIC_SANDBOX_MODE;
    env.VERCEL_ENV = 'production';
    assert.doesNotThrow(assertSandboxNotInProd);
  });

  it('should_not_throw_when_sandbox_is_on_in_vercel_preview', () => {
    stash(['NEXT_PUBLIC_SANDBOX_MODE', 'VERCEL_ENV']);
    env.NEXT_PUBLIC_SANDBOX_MODE = '1';
    process.env.VERCEL_ENV = 'preview';
    assert.doesNotThrow(assertSandboxNotInProd);
  });

  it('should_not_throw_when_sandbox_is_on_in_local_development', () => {
    stash(['NEXT_PUBLIC_SANDBOX_MODE', 'VERCEL_ENV', 'NODE_ENV']);
    env.NEXT_PUBLIC_SANDBOX_MODE = '1';
    delete env.VERCEL_ENV;
    env.NODE_ENV = 'development';
    assert.doesNotThrow(assertSandboxNotInProd);
  });
});
