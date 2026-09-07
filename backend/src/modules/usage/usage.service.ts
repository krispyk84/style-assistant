import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';
import type { AiFeature } from '../../ai/costs.js';

// Attribution id for AI calls with no real per-user context — shared/global
// generation jobs (e.g. seasonal color-swatch/trend sketches, backfilled once
// per season for all users, not triggered by any one user's action). These
// still cost real OpenAI money against the same billed account, so they must
// be recorded somewhere rather than silently discarded — but getMonthlyTotal
// is scoped per supabaseUserId, so entries under this id intentionally never
// show up on any individual user's own "AI usage this month" total.
export const SYSTEM_USAGE_SUPABASE_ID = 'system';

function currentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

type RecordUsageInput = {
  supabaseUserId: string;
  feature: AiFeature;
  model: string;
  costUsd: number;
  inputTokens?: number;
  outputTokens?: number;
};

export const usageService = {
  record(input: RecordUsageInput): void {
    void prisma.aiUsageEntry
      .create({
        data: {
          supabaseUserId: input.supabaseUserId,
          monthKey: currentMonthKey(),
          feature: input.feature,
          model: input.model,
          costUsd: input.costUsd,
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
        },
      })
      .catch((error) => {
        logger.error({ error, feature: input.feature }, 'Failed to record AI usage');
      });
  },

  async getMonthlyTotal(supabaseUserId: string): Promise<number> {
    const result = await prisma.aiUsageEntry.aggregate({
      where: { supabaseUserId, monthKey: currentMonthKey() },
      _sum: { costUsd: true },
    });
    return result._sum.costUsd ?? 0;
  },
};
