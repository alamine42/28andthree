// E8 Sandbox — prod-safety guard.
//
// Called from instrumentation.ts at process start (codex F3). Fires once,
// before any request is served. If NEXT_PUBLIC_SANDBOX_MODE=1 hits a prod
// environment, the process crashes at boot — deploy can't even accept a
// connection. The import-time throw from lib/env.ts that v1 proposed
// wasn't universal (static routes + middleware-only requests could skip
// it); instrumentation.ts is the right hook.

export function assertSandboxNotInProd(): void {
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE !== '1') return;
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production';
  if (isProd) {
    throw new Error(
      'NEXT_PUBLIC_SANDBOX_MODE=1 detected in a production environment. ' +
      'This must never happen — remove the env var from the deploy target.',
    );
  }
}
