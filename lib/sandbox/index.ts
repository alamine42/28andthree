// E8 Sandbox — main entry point. See docs/plans/e8-sandbox-plan.md.
//
// `NEXT_PUBLIC_SANDBOX_MODE` is the env gate. The `NEXT_PUBLIC_` prefix is
// load-bearing: without it the client bundle reads `undefined` and the
// SandboxBanner + Agentation toolbar never mount (codex F2). Next's
// webpack inlines NEXT_PUBLIC_* at build time, so the value is frozen
// per bundle — one deploy, one mode.

export const SANDBOX_ACTIVE = process.env.NEXT_PUBLIC_SANDBOX_MODE === '1';

export function isSandbox(): boolean {
  // Re-read at call time (not closing over SANDBOX_ACTIVE) so unit tests
  // that mutate the env and reimport this module observe the new value.
  // In production the build-time string replacement by webpack turns this
  // into a compile-time constant anyway, so there's no runtime cost.
  return process.env.NEXT_PUBLIC_SANDBOX_MODE === '1';
}

export { loadFixture } from './load';
