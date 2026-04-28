import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContentType } from './extractors/types';

// Prompt-file loader. Reads from prompts/*.md + AUTHORING.md, assembles
// the system block per content type. Files are repo-shipped read-only at
// runtime (Vercel allows read access to bundled files).
//
// Cached at module level — these files never change at runtime; reading
// them on every generation is 4 unnecessary disk hits.

const REPO_ROOT = process.cwd();

const fileCache = new Map<string, Promise<string>>();

export type AssembledPrompt = {
  systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  userText: string;
};

export async function assemblePrompt(input: {
  contentType: ContentType;
  contextJson: string;
  regenerateSection?: string;
}): Promise<AssembledPrompt> {
  const { contentType, contextJson, regenerateSection } = input;

  const [system, voiceExemplars, formatSpec, authoring] = await Promise.all([
    readPromptFile('prompts/system.md'),
    readPromptFile('prompts/voice-exemplars.md'),
    readPromptFile(formatSpecPath(contentType)),
    readPromptFile('AUTHORING.md'),
  ]);

  // Cache-friendly ordering: stable content first, single ephemeral
  // breakpoint at the end of the cacheable system block.
  const systemBlocks: AssembledPrompt['systemBlocks'] = [
    { type: 'text', text: system },
    { type: 'text', text: `\n\n# Voice exemplars\n\n${voiceExemplars}` },
    { type: 'text', text: `\n\n# Format spec for ${contentType}\n\n${formatSpec}` },
    {
      type: 'text',
      text: `\n\n# Authoring conventions\n\n${authoring}`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const userParts: string[] = [
    `# Structured input data\n\n\`\`\`json\n${contextJson}\n\`\`\``,
  ];
  if (regenerateSection) {
    userParts.push(
      `\n# Regenerate-section instruction\n\nRegenerate ONLY the section titled exactly: \`${regenerateSection}\`. Output the new section content only — do not include the heading. Preserve the format spec for that section.`,
    );
  } else {
    userParts.push(`\n# Task\n\nProduce the full ${contentType} draft per the format spec.`);
  }

  return { systemBlocks, userText: userParts.join('\n\n') };
}

async function readPromptFile(relPath: string): Promise<string> {
  const cached = fileCache.get(relPath);
  if (cached) return cached;
  const path = join(REPO_ROOT, relPath);
  const promise = readFile(path, 'utf8');
  fileCache.set(relPath, promise);
  return promise;
}

function formatSpecPath(contentType: ContentType): string {
  switch (contentType) {
    case 'recap':
      return 'prompts/format-recap.md';
    case 'opponent_preview':
      return 'prompts/format-opponent-preview.md';
    default:
      // Deep-dive types — share a generic template if specific isn't available.
      // Caller should ensure the spec exists; throwing here surfaces "you forgot
      // to add the format spec" loudly.
      throw new Error(
        `no format spec for content type '${contentType}' — add prompts/format-${contentType}.md`,
      );
  }
}
