# Load test baseline (E6-12)

Recorded **2026-04-21** against the local production build (`pnpm start`)
using `scripts/load-test.mjs` with autocannon 7.

## Configuration

- **Target:** `http://localhost:3000` (local prod build, no DB seeded)
- **RPS:** 200 sustained
- **Duration:** 120 s per URL
- **Connections:** 20 (200 / 10)
- **Total requests:** 24,000 per URL × 3 URLs = 72,000
- **Budget assertions:**
  - p97.5 latency ≤ 500 ms (covers spec's "p95 < 500 ms")
  - 5xx rate = 0
  - non-2xx rate < 0.1 %

`X-Forwarded-For: 10.99.99.1` is set on every request to give the
middleware a stable bucket; `/`, `/phases/*`, and `/players/*` are not in
the rate-limit matcher, so the 60/min/IP cap doesn't apply.

## Results

| Route                          | p50 | p90 | p97.5 | p99 | max  | 5xx | non-2xx |
|--------------------------------|----:|----:|------:|----:|-----:|----:|--------:|
| `/`                            | 7   | 15  | 26    | 44  | 179  | 0   | 0       |
| `/phases/pass_offense`         | 6   | 11  | 18    | 22  | 84   | 0   | 0       |
| `/players/qb/00-0039851`       | 5   | 13  | 19    | 24  | 77   | 0   | 0       |

(Latencies in ms.)

**Verdict:** all three URLs comfortably meet the spec — p97.5 well under the
500 ms budget on every route, no 5xx, no timeouts, no errors. Throughput
ranged 7.4 – 13.1 MB/s.

## Caveats

- Local prod build serves from filesystem cache; there is no Vercel CDN
  edge in front and no Neon roundtrip per request (DB is unreachable in
  this run, so DAL functions return empty arrays via the missing-table
  guard). Hot-path numbers will look similar in production for cached ISR
  pages but worse for cold cache on dynamic routes.
- Local M-class machine; production runs on Vercel hyperdrive nodes with
  different CPU profiles. Numbers should be re-baselined against a
  preview URL pre-launch.
- Dataset isn't seeded locally so the QB page renders the empty-state
  branch. Re-run after the ETL backfill lands to capture the populated
  render path.

## How to re-run

Local:
```bash
pnpm build
pnpm start &        # serve on :3000
node scripts/load-test.mjs
```

Against a preview URL (override via env):
```bash
LOAD_URL=https://28andthree-foo-mehdi.vercel.app \
  LOAD_RPS=200 LOAD_DURATION=120 \
  node scripts/load-test.mjs
```

The script exits non-zero on any budget miss, so it can be wired into a
release-gate workflow when we add one.
