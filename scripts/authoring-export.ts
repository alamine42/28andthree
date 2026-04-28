#!/usr/bin/env -S tsx
// L0-21: pnpm authoring:export
//
// Pulls all status='published' drafts from the prod DB and writes them as
// markdown files under drafts/<content_type>/<slug>.md so the operator can
// commit + push for git-versioned archive. Idempotent — skips files unchanged
// from DB.
//
// This replaces the original "DB+filesystem dual storage" pattern (codex
// CRITICAL #1) with a separate, local-only periodic snapshot.
//
// Usage:
//   DATABASE_URL='postgres://...' pnpm authoring:export
//   DATABASE_URL='...' pnpm authoring:export -- --dry-run

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { eq } from 'drizzle-orm';
import { authoringDrafts } from '@/db/schema';
import { getDb } from '@/lib/db';
import { hashMarkdown } from '@/lib/authoring/persistence';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const db = getDb();
  if (!db) {
    console.error('Error: DATABASE_URL not set');
    process.exit(1);
  }

  const drafts = await db
    .select()
    .from(authoringDrafts)
    .where(eq(authoringDrafts.status, 'published'));

  console.log(`Found ${drafts.length} published drafts`);
  let written = 0;
  let skipped = 0;

  const repoRoot = process.cwd();
  for (const draft of drafts) {
    const filepath = join(repoRoot, 'drafts', draft.contentType, `${draft.slug}.md`);
    const dbHash = hashMarkdown(draft.markdownContent);
    let onDisk = '';
    try {
      onDisk = await readFile(filepath, 'utf8');
    } catch {
      // File doesn't exist — write it.
    }
    if (onDisk && hashMarkdown(onDisk) === dbHash) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  [dry-run] would write ${filepath}`);
      continue;
    }
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, draft.markdownContent, 'utf8');
    written++;
    console.log(`  wrote ${filepath}`);
  }

  console.log(`\nDone. ${written} written, ${skipped} skipped (unchanged).`);
  if (!dryRun && written > 0) {
    console.log('Next: git add drafts/ && git commit && git push');
  }
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
