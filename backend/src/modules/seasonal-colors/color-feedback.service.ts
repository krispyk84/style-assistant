import { colorFeedbackRepository, type ColorFeedbackValue } from './color-feedback.repository.js';

export const colorFeedbackService = {
  /** Keyed by normalized colour name — matches ColorSwatchSketch's own key normalization. */
  async getFeedbackMap(supabaseUserId: string, fashionGender: string): Promise<Map<string, ColorFeedbackValue>> {
    const rows = await colorFeedbackRepository.findAllForUser(supabaseUserId, fashionGender);
    return new Map(rows.map((row) => [row.colorNameKey, row.feedback as ColorFeedbackValue]));
  },

  /** feedback: null clears any existing feedback for this colour (back to neutral). */
  async setFeedback(supabaseUserId: string, fashionGender: string, colorName: string, feedback: ColorFeedbackValue | null) {
    if (feedback === null) {
      await colorFeedbackRepository.clear(supabaseUserId, fashionGender, colorName);
      return;
    }
    await colorFeedbackRepository.upsert(supabaseUserId, fashionGender, colorName, feedback);
  },
};
