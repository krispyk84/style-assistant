import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'style-assistant/recommendation-feedback';

export type RecommendationFeedback = {
  id: string;
  /** The outfit generation request this feedback belongs to. */
  requestId: string;
  /** The tier (business, smart-casual, casual) the card belongs to. */
  tier: string;
  /** Title of the outfit at the time of feedback. */
  outfitTitle: string;
  /**
   * User rating.
   * 'up' / 'down' — closet match feedback (piece-level)
   * 'love' / 'hate' — outfit-level feedback from the tier detail screen
   */
  thumb: 'up' | 'down' | 'love' | 'hate';
  /** Whether thumbs-down triggered a regeneration. */
  regenerated: boolean;
  createdAt: string;
};

export async function loadRecommendationFeedback(): Promise<RecommendationFeedback[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRecommendationFeedback(feedback: RecommendationFeedback): Promise<void> {
  const existing = await loadRecommendationFeedback();
  // Replace if same requestId + tier already has feedback, otherwise prepend
  const idx = existing.findIndex((f) => f.requestId === feedback.requestId && f.tier === feedback.tier);
  const next = idx >= 0
    ? existing.map((f, i) => (i === idx ? feedback : f))
    : [feedback, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
