#!/usr/bin/env -S tsx
// CLI entrypoint for authoring. Usage:
//   pnpm authoring:generate recap <game_id>
//   pnpm authoring:generate preview <opponent> <week> [season]
//
// Requires DATABASE_URL + ANTHROPIC_API_KEY env vars.

import { generateDraft } from '@/lib/authoring/generate';
import type { ContentType } from '@/lib/authoring/extractors/types';
import { getCurrentSeason } from '@/lib/data/current-season';

async function main(): Promise<void> {
  const [, , subcommand, ...rest] = process.argv;
  if (!subcommand) {
    printUsage();
    process.exit(1);
  }

  let contentType: ContentType;
  let contextKey: string;

  switch (subcommand) {
    case 'recap': {
      const [gameId] = rest;
      if (!gameId) {
        console.error('Error: recap requires a game_id argument');
        printUsage();
        process.exit(1);
      }
      contentType = 'recap';
      contextKey = gameId;
      break;
    }
    case 'preview': {
      const [opponent, weekStr, seasonStr] = rest;
      if (!opponent || !weekStr) {
        console.error('Error: preview requires <opponent> <week> [season]');
        printUsage();
        process.exit(1);
      }
      const week = Number.parseInt(weekStr, 10);
      const season = seasonStr ? Number.parseInt(seasonStr, 10) : await getCurrentSeason();
      if (Number.isNaN(week) || Number.isNaN(season)) {
        console.error('Error: week and season must be integers');
        process.exit(1);
      }
      contentType = 'opponent_preview';
      contextKey = `${season}-w${String(week).padStart(2, '0')}-${opponent.toLowerCase()}`;
      break;
    }
    default:
      console.error(`Error: unknown subcommand '${subcommand}'`);
      printUsage();
      process.exit(1);
  }

  console.log(`Generating ${contentType} for ${contextKey}...`);
  const result = await generateDraft({ contentType, contextKey, trigger: 'cli' });

  console.log(`\n--- Draft ${result.draftId} ---`);
  console.log(`Cost: $${result.costUsd.toFixed(4)}`);
  console.log(`Cache hit rate: ${(result.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`Factcheck: ${result.factcheck.status} (${result.factcheck.findings.length} findings)`);
  if (result.factcheck.findings.length > 0) {
    console.log('\nFindings:');
    for (const f of result.factcheck.findings) {
      console.log(`  [${f.type}] ${f.token} — ${f.context}`);
    }
  }
  console.log('\n--- Markdown ---\n');
  console.log(result.markdown);
}

function printUsage(): void {
  console.error(`
Usage:
  pnpm authoring:generate recap <game_id>
  pnpm authoring:generate preview <opponent> <week> [season]

Examples:
  pnpm authoring:generate recap 2025_17_NE_NYJ
  pnpm authoring:generate preview BUF 8 2025
`);
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
