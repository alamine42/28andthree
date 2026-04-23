---
title: "Next.js 16 uses Turbopack by default; webpack resolve.alias is silently ignored"
category: "gotchas"
date: "2026-04-23"
tags: [next.js, turbopack, webpack, bundling, aliasing]
files: [next.config.ts]
---

# Next.js 16 uses Turbopack by default; webpack resolve.alias is silently ignored

## Problem

Wrote a `webpack:` config hook in `next.config.ts` to alias sandbox fixture modules to a throw-on-call empty stub for prod builds (E8 sandbox isolation). Ran `pnpm build` with `NEXT_PUBLIC_SANDBOX_MODE` unset and expected the `.next` output to contain only the empty stub.

Instead, the prod bundle contained the full fixture payloads:

```text
$ cat .next/server/chunks/ssr/patsbythenumbers_lib_sandbox_stubs_team_ts_...js
let b={season:2025,record:{wins:14,losses:3,ties:0},pointDiff:170,...};
let d=[{gameId:"2025_12_NE_NYJ",...},{gameId:"2025_13_NE_BUF",...},...];
```

The alias map was silently ignored. No warning, no error — the build succeeded and the fixture bytes shipped.

## Root Cause

Next.js 16 switched to **Turbopack as the default bundler** for `next build`, not just `next dev`. The `webpack:` function in `next.config.ts` only runs when webpack is the active bundler; Turbopack reads a separate `turbopack.resolveAlias` config key and ignores `webpack` entirely. There is no warning for unused webpack config.

Giveaway in the output path: Turbopack emits chunks named like `patsbythenumbers_lib_sandbox_stubs_team_ts_0xi-76h._.js` (underscored TS-path + hash). Webpack uses a different naming convention.

## Solution

Configure **both** bundlers. Keep the webpack hook (in case Sentry or another plugin forces webpack for some chunk) and add an equivalent `turbopack.resolveAlias` entry. There's one additional twist: **Turbopack wants project-relative paths, webpack wants absolute** — absolute paths handed to Turbopack get prefixed with `./` which breaks resolution.

```ts
// next.config.ts
const EMPTY_STUB_REL = './lib/sandbox/empty-stub.ts';
const EMPTY_STUB_ABS = path.resolve(process.cwd(), 'lib/sandbox/empty-stub.ts');

const SANDBOX_ALIAS_KEYS = [
  '@/lib/sandbox/fixtures/team',
  '@/lib/sandbox/stubs/team',
  // ...etc
];

const turbopackAliasMap = Object.fromEntries(
  SANDBOX_ALIAS_KEYS.map((k) => [k, EMPTY_STUB_REL]),
);
const webpackAliasMap = Object.fromEntries(
  SANDBOX_ALIAS_KEYS.map((k) => [k, EMPTY_STUB_ABS]),
);

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: turbopackAliasMap,
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...webpackAliasMap };
    return config;
  },
};
```

After the fix, the same build produced a 1.8KB empty-stub chunk with only throw-on-call exports:

```text
module.exports=[46712,a=>{"use strict";function b(){throw Error("sandbox stub hit in prod...")}
let c=new Proxy({},{get:b}),d=new Proxy({},{get:b}),...
```

## Prevention

- [ ] Never trust a silent webpack-only alias in Next.js 16. Always mirror into `turbopack.resolveAlias`.
- [x] **CI grep sentinel** — add a workflow that greps the built `.next/` for strings that only appear in the aliased-out module's source. If a sentinel leaks, the build fails. See `.github/workflows/sandbox-isolation.yml`.
- Turbopack relative-path quirk: when aliasing to a local file, use a path starting with `./` from the project root, **not** `path.resolve(__dirname, ...)`. Keep the absolute path in reserve for the webpack side.

## Related

- E8 sandbox isolation implementation: `next.config.ts`, `lib/sandbox/empty-stub.ts`
- `.github/workflows/sandbox-isolation.yml` — the sentinel that caught this regression during local build
- `docs/sandbox.md` — describes the three-layer isolation contract
