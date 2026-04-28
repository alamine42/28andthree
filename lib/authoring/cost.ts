// Per-model token pricing for cost calculation. Updated alongside any
// Anthropic price changes. Cache pricing: writes ~1.25× input rate,
// reads ~0.1× input rate.

export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
  cacheWritePer1M: number;
  cacheReadPer1M: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    cacheWritePer1M: 3.75,
    cacheReadPer1M: 0.3,
  },
  'claude-haiku-4-5': {
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    cacheWritePer1M: 1.25,
    cacheReadPer1M: 0.1,
  },
  'claude-opus-4-7': {
    inputPer1M: 5.0,
    outputPer1M: 25.0,
    cacheWritePer1M: 6.25,
    cacheReadPer1M: 0.5,
  },
};

export type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function calculateCost(model: string, usage: UsageLike): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cost =
    (usage.input_tokens / 1_000_000) * pricing.inputPer1M +
    (usage.output_tokens / 1_000_000) * pricing.outputPer1M +
    (cacheWrite / 1_000_000) * pricing.cacheWritePer1M +
    (cacheRead / 1_000_000) * pricing.cacheReadPer1M;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
