import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';
import type { AiFeature } from '../../ai/costs.js';

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
