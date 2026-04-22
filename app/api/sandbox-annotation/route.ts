import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SANDBOX_ACTIVE } from '@/lib/sandbox';

// Sandbox annotation bridge: receives a selector + note from the
// Agentation toolbar, materializes a Beads task via `bd create`, and
// returns the new task id. Active only when NEXT_PUBLIC_SANDBOX_MODE=1.
//
// Security: uses execFile with an argv array — no shell, no
// interpolation. Inputs are zod-validated and length-clamped so the
// argv stays bounded.

const run = promisify(execFile);

const AnnotationSchema = z.object({
  page: z.string().min(1).max(200),
  selector: z.string().min(1).max(500),
  note: z.string().min(1).max(2000),
  priority: z.number().int().min(0).max(4).default(2),
});

export async function POST(req: Request) {
  if (!SANDBOX_ACTIVE) {
    return NextResponse.json({ error: 'sandbox mode is not active' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = AnnotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { page, selector, note, priority } = parsed.data;
  const title = `[sandbox] ${page} — ${selector}`.slice(0, 180);
  const description = `Auto-filed from the sandbox Agentation toolbar.\n\nPage: ${page}\nSelector: ${selector}\n\nNote:\n${note}`;

  try {
    const { stdout } = await run(
      'bd',
      [
        'create',
        '--title', title,
        '--description', description,
        '--type', 'task',
        '--priority', String(priority),
      ],
      { timeout: 10_000, maxBuffer: 512_000 },
    );
    // Probe the returned issue id (bd prints `bd-XXXX`).
    const match = stdout.match(/bd-\d+/);
    const taskId = match?.[0] ?? null;
    return NextResponse.json({ ok: true, taskId, raw: stdout });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `bd create failed: ${msg}` }, { status: 500 });
  }
}
