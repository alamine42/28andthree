import Anthropic from '@anthropic-ai/sdk';
import { sql } from 'drizzle-orm';
import type { ExtractorContext, ContentType } from './extractors/types';
import type { AuthoringTrigger, NewAuthoringRun } from '@/db/schema';
import { factcheck, type FactcheckResult } from './factcheck';
import { assemblePrompt } from './prompts';
import { calculateCost } from './cost';
import { buildSlug, logRun, upsertDraft } from './persistence';
import { extractOpponentPreviewContext } from './extractors/opponent-preview';
import { extractRecapContext } from './extractors/recap';
import { getDb } from '@/lib/db';

// Canonical entrypoint for authoring. CLI, cron, and studio button all
// call this — single code path, three triggers.

export type GenerateInput = {
  contentType: ContentType;
  contextKey: string;
  trigger: AuthoringTrigger;
  regenerateSection?: string;
};

export type GenerateResult = {
  draftId: string;
  markdown: string;
  factcheck: FactcheckResult;
  costUsd: number;
  cacheHitRate: number;
};

const DEFAULT_MODEL = process.env.AUTHORING_MODEL ?? 'claude-sonnet-4-6';
const ANTHROPIC_MAX_TOKENS = 16000;

export async function generateDraft(input: GenerateInput): Promise<GenerateResult> {
  const start = Date.now();
  const slug = buildSlug(input.contentType, input.contextKey);

  // Per-resource advisory lock: serialize concurrent calls for the same slug.
  // Use Postgres `hashtext()` so the hash space matches int4 — JS-side hashing
  // would collide more often and is a reuse anti-pattern.
  const db = getDb();
  if (!db) throw new Error('generateDraft: no DB connection');

  const lockResult = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(hashtext(${slug})) as locked`,
  );
  const rows = (lockResult as { rows?: Array<{ locked: boolean }> }).rows ?? lockResult;
  const acquired = (rows as Array<{ locked: boolean }>)[0]?.locked;
  if (!acquired) {
    throw new Error(`generateDraft: another generation is in progress for ${slug}`);
  }

  let runRecord: Partial<NewAuthoringRun> = {
    contentType: input.contentType,
    trigger: input.trigger,
    model: DEFAULT_MODEL,
  };

  try {
    const ctx = await extractContext(input);
    const prompt = await assemblePrompt({
      contentType: input.contentType,
      contextJson: JSON.stringify(ctx.data, null, 2),
      regenerateSection: input.regenerateSection,
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'generateDraft: ANTHROPIC_API_KEY not set (required for live generation)',
      );
    }
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: prompt.systemBlocks,
      messages: [{ role: 'user', content: prompt.userText }],
    });

    const markdown = extractTextFromResponse(response);
    const factcheckResult = factcheck(markdown, ctx);
    const costUsd = calculateCost(DEFAULT_MODEL, response.usage);
    const cacheRead = response.usage.cache_read_input_tokens ?? 0;
    const totalInput = response.usage.input_tokens + cacheRead;
    const cacheHitRate = totalInput > 0 ? cacheRead / totalInput : 0;

    runRecord = {
      ...runRecord,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      costUsd,
      promptCacheHit: cacheHitRate > 0.5,
      factcheckStatus: factcheckResult.status,
      durationMs: Date.now() - start,
    };

    const draft = await upsertDraft({
      slug,
      contentType: input.contentType,
      markdown,
      factcheck: factcheckResult,
      costUsd,
      metadata: {
        sourceData: ctx.data,
        numericClaimCount: ctx.numericClaims.length,
        playerNameCount: ctx.playerNames.length,
      },
    });

    await logRun({ ...runRecord, draftId: draft.id } as NewAuthoringRun);

    return {
      draftId: draft.id,
      markdown,
      factcheck: factcheckResult,
      costUsd,
      cacheHitRate,
    };
  } catch (error) {
    runRecord = {
      ...runRecord,
      durationMs: Date.now() - start,
      errorText: error instanceof Error ? error.message : String(error),
    };
    await logRun(runRecord as NewAuthoringRun);
    throw error;
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${slug}))`);
  }
}

async function extractContext(input: GenerateInput): Promise<ExtractorContext<unknown>> {
  switch (input.contentType) {
    case 'recap':
      return extractRecapContext({ gameId: input.contextKey });
    case 'opponent_preview': {
      // contextKey expected as "<season>-w<week>-<opponent>" (slug shape from extractor)
      const match = /^(\d{4})-w(\d{1,2})-(\w{2,4})$/.exec(input.contextKey);
      if (!match) {
        throw new Error(
          `opponent_preview contextKey must be "<season>-w<week>-<opponent>" (got "${input.contextKey}")`,
        );
      }
      const season = match[1] ?? '';
      const week = match[2] ?? '';
      const opponent = match[3] ?? '';
      return extractOpponentPreviewContext({
        season: Number(season),
        week: Number(week),
        opponent: opponent.toUpperCase(),
      });
    }
    default:
      throw new Error(`extractContext: no extractor for content type '${input.contentType}'`);
  }
}

function extractTextFromResponse(response: Anthropic.Message): string {
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  return textBlocks.map((b) => b.text).join('');
}

