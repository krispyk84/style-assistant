import { createRequire } from 'node:module';
import { z } from 'zod';

// ── Config schema ─────────────────────────────────────────────────────────────

const essentialItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  categories: z.array(z.string()),
  subcategories: z.array(z.string()).default([]),
  colorFamilies: z.array(z.string()).default([]),
  formality: z.array(z.string()).optional(),
  keywords: z.array(z.string()).default([]),
});

const scoreBandSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string(),
  description: z.string(),
});

const configSchema = z.object({
  scoringVersion: z.string(),
  dimensionWeights: z.object({
    essentialsCoverage: z.number(),
    versatilityFunctionality: z.number(),
    trendRelevance: z.number(),
  }),
  essentialsTierWeights: z.object({
    tier1: z.number(),
    tier2: z.number(),
    tier3: z.number(),
  }),
  scoreBands: z.array(scoreBandSchema),
  versatilityWeights: z.object({
    occasionSpread: z.number(),
    colorDistribution: z.number(),
    categoryGaps: z.number(),
    mixAndMatchPotential: z.number(),
  }),
  essentialsMasterList: z.object({
    tier1: z.array(essentialItemSchema),
    tier2: z.array(essentialItemSchema),
    tier3: z.array(essentialItemSchema),
  }),
});

export type ScoringConfig = z.infer<typeof configSchema>;
export type EssentialItem = z.infer<typeof essentialItemSchema>;
export type ScoreBand = z.infer<typeof scoreBandSchema>;

// ── Loader ────────────────────────────────────────────────────────────────────

let _cached: ScoringConfig | null = null;

export function loadScoringConfig(): ScoringConfig {
  if (_cached) return _cached;

  const require = createRequire(import.meta.url);
  const raw = require('../../config/wardrobe-scoring.json');
  _cached = configSchema.parse(raw);
  return _cached;
}

export function getScoreBand(score: number, config: ScoringConfig): ScoreBand {
  const band = config.scoreBands.find((b) => score >= b.min && score <= b.max);
  // Fallback to lowest band if somehow out of range
  return band ?? config.scoreBands[config.scoreBands.length - 1]!;
}
