import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PageHeader } from '@/components/admin/Eyebrow';

// L0-15: voice editor (read-only in v1 per codex WARNING #1). Renders the
// prompt files + AUTHORING.md from the deployed bundle. Editing is a local-
// CLI workflow; we do NOT write to disk from Server Actions on Vercel.

const FILES = [
  { label: 'AUTHORING.md', path: 'AUTHORING.md' },
  { label: 'prompts/system.md', path: 'prompts/system.md' },
  { label: 'prompts/voice-exemplars.md', path: 'prompts/voice-exemplars.md' },
  { label: 'prompts/format-recap.md', path: 'prompts/format-recap.md' },
  { label: 'prompts/format-opponent-preview.md', path: 'prompts/format-opponent-preview.md' },
] as const;

export default async function VoicePage() {
  const contents = await Promise.all(
    FILES.map(async (f) => {
      try {
        const text = await readFile(join(process.cwd(), f.path), 'utf8');
        return { ...f, text };
      } catch {
        return { ...f, text: `[file not found at ${f.path}]` };
      }
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Studio · read-only" title="Voice + Format" />
      <p className="font-mono text-2xs text-text-muted">
        To edit: clone the repo, edit the file in your text editor, commit + push. Vercel rebuilds and the studio picks up the new content.
      </p>
      {contents.map((c) => (
        <section key={c.path} className="rounded-sm border border-border bg-surface p-4">
          <h2 className="mb-3 font-mono text-2xs uppercase tracking-widest text-text-muted">
            {c.label}
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-2xs text-text">
            {c.text}
          </pre>
        </section>
      ))}
    </div>
  );
}
