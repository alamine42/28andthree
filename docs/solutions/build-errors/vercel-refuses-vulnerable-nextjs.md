---
title: "Vercel deploy blocked by 'Vulnerable version of Next.js detected' — and the upgrade cascade"
category: "build-errors"
date: "2026-04-17"
tags: [vercel, nextjs, security, cve, turbopack, eslint-flat-config, sentry]
files: [package.json, next.config.ts, eslint.config.mjs, instrumentation-client.ts]
---

# Vercel refuses to deploy vulnerable Next.js versions — upgrade cascade

## Problem

Vercel deploy succeeded through the Next.js build step, then aborted:

```
Error: Vulnerable version of Next.js detected, please update immediately.
```

We were on `next@15.1.6`. Vercel's deploy gate flags known CVE versions and refuses to publish them regardless of whether the build itself succeeded.

## Root Cause

Vercel runs a post-build security check against a CVE list for Next.js. No local override, no env flag to silence. The only path is to upgrade.

A "simple" upgrade to `next@latest` triggered three cascading breakages because Next 16 shipped several convention changes + Turbopack as default:

1. **`next lint` removed** — `pnpm lint` (which called `next lint`) errored with `Invalid project directory provided, no such directory: .../lint`. Next 16 expects you to call ESLint directly.

2. **ESLint 9 requires flat config** — after switching the script to `eslint .`, ESLint 9 rejected the existing `.eslintrc.json`:
   ```
   From ESLint v9.0.0, the default configuration file is now eslint.config.js.
   ```

3. **Turbopack doesn't auto-load `sentry.client.config.ts`** — Sentry SDK printed a deprecation warning:
   ```
   [@sentry/nextjs] DEPRECATION WARNING: It is recommended renaming your
   `sentry.client.config.ts` file, or moving its content to `instrumentation-client.ts`.
   When using Turbopack `sentry.client.config.ts` will no longer work.
   ```
   Plus an action-required warning about the missing `onRouterTransitionStart` export.

## Solution

All four fixes in one go:

1. **Upgrade Next + its ecosystem packages together:**
   ```bash
   pnpm add next@latest
   pnpm add -D eslint-config-next@latest  # (then ended up removing this — see below)
   ```

2. **Migrate to ESLint flat config.** Remove `.eslintrc.json`, add `eslint.config.mjs`:
   ```js
   import tseslint from 'typescript-eslint';
   export default [
     { ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'etl/**', '.vercel/**', 'next-env.d.ts', '*.config.js', '*.config.mjs'] },
     ...tseslint.configs.recommended,
     {
       rules: {
         '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
         '@typescript-eslint/consistent-type-imports': 'error',
       },
     },
   ];
   ```
   Install `typescript-eslint` instead of `eslint-config-next` (Next 16's version had its own flat-config quirks we didn't need).

3. **Update `package.json`**:
   ```json
   "lint": "eslint . --ext .ts,.tsx"
   ```

4. **Rename `sentry.client.config.ts` → `instrumentation-client.ts`** and export the router-transition hook:
   ```ts
   import * as Sentry from '@sentry/nextjs';
   export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
   // ... existing Sentry.init() call
   ```

5. **Drop deprecated `disableLogger: true`** from `withSentryConfig` — Turbopack doesn't support it.

## Prevention

- **Expect this cycle for every forced Next.js major.** Budget ~30 min of config yak-shaving per major upgrade.
- **Watch Next.js release notes for Turbopack + App Router convention changes** — file naming for instrumentation, middleware, route handlers all shift between majors.
- **Pin Next to `^<latest stable>`** in `package.json`, and set up Dependabot or Renovate to flag CVE-driven upgrades early rather than learning about them from a failed Vercel deploy.
- **When Vercel rejects a deploy for a "vulnerable version":** don't try to work around it. Upgrade to the latest patch of your major first (fastest path); if that's also flagged, jump a major.

## Related

- `package.json` — pins `next: "^16.2.4"`, `packageManager: pnpm@9.15.9`
- `eslint.config.mjs` — flat config
- `instrumentation-client.ts` — Sentry client init
- commit `626703f` — "E1-10/E1-11: Vercel prod deploy" (the Next 15→16 crossing)
- commit `8346dc0` — "Sentry: migrate to Next 16 / Turbopack convention"
