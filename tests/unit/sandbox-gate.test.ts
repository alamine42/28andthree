import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// E8-01: sandbox gate. isSandbox() reads NEXT_PUBLIC_SANDBOX_MODE.
// NEXT_PUBLIC_ prefix is load-bearing — codex F2 caught v1's plain
// SANDBOX_MODE which is invisible to the client bundle.

async function freshModule() {
  const mod = `../../lib/sandbox/index?t=${Math.random()}`;
  return import(mod);
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SANDBOX_MODE;
});

describe('lib/sandbox — isSandbox gate', () => {
  it('should_return_false_when_env_var_is_unset', async () => {
    delete process.env.NEXT_PUBLIC_SANDBOX_MODE;
    const { isSandbox } = await freshModule();
    assert.equal(isSandbox(), false);
  });

  it('should_return_true_when_env_var_is_1', async () => {
    process.env.NEXT_PUBLIC_SANDBOX_MODE = '1';
    const { isSandbox } = await freshModule();
    assert.equal(isSandbox(), true);
  });

  it('should_return_false_for_any_non_1_value', async () => {
    process.env.NEXT_PUBLIC_SANDBOX_MODE = 'true';
    const { isSandbox } = await freshModule();
    assert.equal(isSandbox(), false);
  });

  it('should_return_false_for_empty_string', async () => {
    process.env.NEXT_PUBLIC_SANDBOX_MODE = '';
    const { isSandbox } = await freshModule();
    assert.equal(isSandbox(), false);
  });

  it('should_be_idempotent_across_multiple_calls', async () => {
    process.env.NEXT_PUBLIC_SANDBOX_MODE = '1';
    const { isSandbox } = await freshModule();
    assert.equal(isSandbox(), true);
    assert.equal(isSandbox(), true);
    assert.equal(isSandbox(), true);
  });
});
