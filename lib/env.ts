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
