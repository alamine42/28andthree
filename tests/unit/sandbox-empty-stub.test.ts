import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as emptyStub from '../../lib/sandbox/empty-stub';

// E8-01 + codex F1: the empty-stub module is aliased into prod bundles
// in place of @/lib/sandbox. Every public symbol must either be a safe
// constant (SANDBOX_ACTIVE=false, isSandbox=()=>false) or throw loudly
// on call. A silent wrong return = silent wrong fixture in prod. No
// thanks.

describe('lib/sandbox/empty-stub', () => {
  it('should_export_SANDBOX_ACTIVE_as_false', () => {
    assert.equal(emptyStub.SANDBOX_ACTIVE, false);
  });

  it('should_export_isSandbox_returning_false', () => {
    assert.equal(emptyStub.isSandbox(), false);
  });

  it('should_throw_when_loadFixture_is_called', () => {
    assert.throws(() => emptyStub.loadFixture('anything'), /sandbox stub hit in prod/i);
  });

  it('should_throw_when_any_stub_fn_is_called', () => {
    // Every other exported function that isn't the two safe ones should
    // throw — enforced by a convention check below.
    const safeExports = new Set(['SANDBOX_ACTIVE', 'isSandbox']);
    for (const [name, value] of Object.entries(emptyStub)) {
      if (safeExports.has(name)) continue;
      if (typeof value === 'function') {
        assert.throws(
          () => (value as (...a: unknown[]) => unknown)(),
          /sandbox stub hit in prod/i,
          `export \`${name}\` should throw when called in prod`,
        );
      }
    }
  });
});
