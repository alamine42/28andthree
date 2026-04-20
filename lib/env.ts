import { z } from 'zod';

// Server-side env. Parsed lazily (via getServerEnv()) so that individual routes
// can declare their own requirements without every page cold-starting needing a
// Neon connection string.
const serverSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .startsWith('postgres', { message: 'DATABASE_URL must be a Postgres connection string' })
    .optional(),
  MIGRATOR_DATABASE_URL: z
    .string()
    .url()
    .startsWith('postgres')
    .optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOW_DEBUG_TRIGGER: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),

  // /status/data admin token. 32-byte hex recommended; compared via constant
  // time. When unset the endpoint rejects all requests (fail-closed).
  STATUS_ADMIN_TOKEN: z.string().min(16).optional(),

  // Upstash Redis REST credentials (per plan §3.9). When either is absent,
  // the rate limiter runs in a warn-and-allow mode locally and the
  // /status/data endpoint refuses requests in prod (fail-closed).
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(16).optional(),

  // Vercel injects this. Used to gate /status/data to preview-only for the
  // first 30 days post-E2 per plan §3.9.
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),

  // Shared secret for /api/revalidate (E3-10). Constant-time compare.
  REVALIDATE_TOKEN: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // In production, fail fast rather than limping along with a broken config.
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

// Test hook: resetEnvForTests() lets unit tests exercise the validation path
// without restarting the process.
export function resetEnvForTests() {
  cached = undefined;
}
