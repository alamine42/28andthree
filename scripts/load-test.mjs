#!/usr/bin/env node
// E6-12 load test. Runs autocannon at ~200 RPS against three representative
// routes for 2 minutes each, asserts p95 < 500ms and 0 5xx responses.
//
// Usage:
//   node scripts/load-test.mjs               # defaults: 200 rps, 120s, localhost:3000
//   LOAD_URL=https://preview.example.com \
//     LOAD_RPS=200 LOAD_DURATION=120 \
//     node scripts/load-test.mjs
//
// Start the target server separately: `pnpm build && pnpm start` for a
// localhost run, or deploy to a preview URL and set LOAD_URL.

import autocannon from 'autocannon';

const BASE = process.env.LOAD_URL ?? 'http://localhost:3000';
const RPS = Number(process.env.LOAD_RPS ?? '200');
const DURATION_S = Number(process.env.LOAD_DURATION ?? '120');
const QB_ID = process.env.LOAD_QB_ID ?? '00-0039851';

const TARGETS = [
  { path: '/', label: 'home' },
  { path: '/phases/pass_offense', label: 'phase_detail' },
  { path: `/players/qb/${QB_ID}`, label: 'qb_deep_dive' },
];

const BUDGETS = {
  // Task spec: p95 < 500ms. We assert against p97_5 (strictly stronger)
  // because autocannon 7 doesn't report p95 directly.
  p97_5Ms: 500,
  allowedNon2xxRate: 0.001,
  allowed5xxRate: 0.0,
};

async function runOne(target) {
  const url = `${BASE}${target.path}`;
  console.log(`\n▶ ${target.label}: ${url} — ${RPS} rps for ${DURATION_S}s`);
  const result = await autocannon({
    url,
    duration: DURATION_S,
    connections: Math.max(10, Math.ceil(RPS / 10)),
    amount: undefined,
    connectionRate: Math.ceil(RPS / Math.max(10, Math.ceil(RPS / 10))),
    // autocannon 7 exposes p50/p75/p90/p97_5/p99 by default; opt into p95.
    percentiles: [50, 90, 95, 99],
    headers: {
      accept: 'text/html',
      'x-forwarded-for': '10.99.99.1',
    },
  });

  return {
    label: target.label,
    url,
    requests: result.requests.total,
    non2xx: result.non2xx,
    statusCounts: result.statusCodeStats ?? {},
    errors: result.errors,
    timeouts: result.timeouts,
    latency: {
      p50: result.latency.p50,
      p90: result.latency.p90,
      // autocannon 7 reports p97_5 instead of p95; use it as a
      // conservative upper bound for the task's "p95 < 500ms" budget.
      p97_5: result.latency.p97_5,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    rps: {
      avg: result.requests.average,
      sent: result.requests.sent,
    },
    throughput_mb_s: result.throughput.average / 1024 / 1024,
    duration_s: result.duration,
  };
}

function assessResult(r) {
  const non2xxRate = r.requests > 0 ? r.non2xx / r.requests : 0;
  // autocannon surfaces status codes in statusCounts; 5xx counts require walking the map.
  let count5xx = 0;
  for (const [code, n] of Object.entries(r.statusCounts ?? {})) {
    if (Number(code) >= 500) count5xx += Number(n);
  }
  const rate5xx = r.requests > 0 ? count5xx / r.requests : 0;

  const failures = [];
  if (r.latency.p97_5 > BUDGETS.p97_5Ms) {
    failures.push(
      `p97.5 ${r.latency.p97_5}ms > budget ${BUDGETS.p97_5Ms}ms (spec: p95 < 500ms)`,
    );
  }
  if (rate5xx > BUDGETS.allowed5xxRate) {
    failures.push(`5xx rate ${(rate5xx * 100).toFixed(2)}% (count=${count5xx})`);
  }
  if (non2xxRate > BUDGETS.allowedNon2xxRate) {
    failures.push(
      `non-2xx rate ${(non2xxRate * 100).toFixed(2)}% (count=${r.non2xx})`,
    );
  }
  return { failures, count5xx, rate5xx, non2xxRate };
}

function format(r, assessment) {
  return [
    `  requests: ${r.requests} (avg ${r.rps.avg.toFixed(1)} rps)`,
    `  latency:  p50 ${r.latency.p50}ms · p90 ${r.latency.p90}ms · p97.5 ${r.latency.p97_5}ms · p99 ${r.latency.p99}ms · max ${r.latency.max}ms`,
    `  non-2xx:  ${r.non2xx} (${(assessment.non2xxRate * 100).toFixed(2)}%)`,
    `  5xx:      ${assessment.count5xx} (${(assessment.rate5xx * 100).toFixed(3)}%)`,
    `  errors/timeouts: ${r.errors} / ${r.timeouts}`,
    `  throughput: ${r.throughput_mb_s.toFixed(2)} MB/s`,
  ].join('\n');
}

const run = async () => {
  console.log(`Load test — target=${BASE} rps=${RPS} duration=${DURATION_S}s`);
  const results = [];
  const fails = [];
  for (const t of TARGETS) {
    const r = await runOne(t);
    const a = assessResult(r);
    console.log(format(r, a));
    if (a.failures.length > 0) {
      fails.push({ label: r.label, failures: a.failures });
    }
    results.push({ ...r, ...a });
  }

  console.log('\n—— summary ——');
  for (const r of results) {
    const ok = fails.find((f) => f.label === r.label) ? '✘' : '✓';
    console.log(
      `${ok} ${r.label.padEnd(18)} p97.5=${String(r.latency.p97_5).padStart(4)}ms 5xx=${r.count5xx} non2xx=${r.non2xx}`,
    );
  }

  if (fails.length > 0) {
    console.error(
      `\nfailed budgets:\n${fails
        .map((f) => `  ${f.label}: ${f.failures.join('; ')}`)
        .join('\n')}`,
    );
    process.exit(1);
  }
  console.log('\nall budgets met.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
