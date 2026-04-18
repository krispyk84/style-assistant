import { createApiClient } from '@/lib/api/api-client';
import type { WardrobeScore } from './wardrobe-score.types';

export const wardrobeScoreService = {
  async getScore(force = false): Promise<WardrobeScore> {
    const path = force ? '/wardrobe/score?force=true' : '/wardrobe/score';
    const response = await createApiClient().request<WardrobeScore>(path);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to load wardrobe score.');
    }

    return response.data;
  },

  async invalidateTrendCache(): Promise<void> {
    await createApiClient().request('/wardrobe/score/invalidate-trend-cache', { method: 'POST' });
  },
};
