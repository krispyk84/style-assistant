import { trendFeedbackRepository, type TrendFeedbackValue } from './trend-feedback.repository.js';

export const trendFeedbackService = {
  /** Keyed by normalized trend name — matches TrendSketch's own key normalization. */
  async getFeedbackMap(supabaseUserId: string, fashionGender: string): Promise<Map<string, TrendFeedbackValue>> {
    const rows = await trendFeedbackRepository.findAllForUser(supabaseUserId, fashionGender);
    return new Map(rows.map((row) => [row.trendNameKey, row.feedback as TrendFeedbackValue]));
  },

  /** feedback: null clears any existing feedback for this trend (back to neutral). */
  async setFeedback(supabaseUserId: string, fashionGender: string, trendName: string, feedback: TrendFeedbackValue | null) {
    if (feedback === null) {
      await trendFeedbackRepository.clear(supabaseUserId, fashionGender, trendName);
      return;
    }
    await trendFeedbackRepository.upsert(supabaseUserId, fashionGender, trendName, feedback);
  },
};
