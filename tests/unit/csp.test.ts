import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp, makeNonce } from '../../lib/security/csp';

describe('buildCsp — production profile', () => {
  const csp = buildCsp('production', 'TESTNONCEBASE64');

  it('enforces default-src self', () => {
    assert.match(csp, /(^|;\s)default-src 'self'(;|$)/);
  });

  it('does NOT include a nonce in script-src', () => {
    // A nonce disables 'unsafe-inline' per spec, and ISR-cached HTML
    // carries stale nonces — hydration dies on every cache HIT. See
    // lib/security/csp.ts.
    assert.doesNotMatch(csp, /'nonce-/);
    assert.match(csp, /script-src[^;]*'unsafe-inline'/);
  });

  it('does NOT include unsafe-eval in script-src', () => {
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), `script-src: ${scriptSrc}`);
  });

  it('disallows objects', () => {
    assert.match(csp, /object-src 'none'/);
  });

  it('disallows framing', () => {
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /frame-src 'none'/);
  });

  it('allows Sentry ingest in connect-src', () => {
    assert.match(csp, /connect-src[^;]*https:\/\/\*\.ingest\.sentry\.io/);
  });

  it('adds upgrade-insecure-requests', () => {
    assert.match(csp, /upgrade-insecure-requests/);
  });

  it('confines form submissions to same-origin', () => {
    assert.match(csp, /form-action 'self'/);
  });
});

describe('buildCsp — development profile', () => {
  const csp = buildCsp('development', 'DEVNONCE');

  it('allows unsafe-eval (Turbopack HMR needs it)', () => {
    assert.match(csp, /script-src[^;]*'unsafe-eval'/);
  });

  it('allows ws: + wss: in connect-src (HMR websockets)', () => {
    const connect = /connect-src ([^;]+)/.exec(csp)?.[1] ?? '';
    assert.ok(connect.includes('ws:'));
    assert.ok(connect.includes('wss:'));
  });

  it('omits upgrade-insecure-requests in dev', () => {
    assert.ok(!csp.includes('upgrade-insecure-requests'));
  });
});

describe('makeNonce', () => {
  it('returns a base64 string of non-trivial length', () => {
    const n = makeNonce();
    assert.ok(n.length >= 20, `nonce too short: ${n}`);
    assert.match(n, /^[A-Za-z0-9+/]+=*$/);
  });

  it('produces distinct values across calls', () => {
    const a = makeNonce();
    const b = makeNonce();
    assert.notEqual(a, b);
  });
});
