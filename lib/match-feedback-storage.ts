import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'style-assistant/match-feedback';

export type MatchFeedback = {
  /** Composite key: `${requestId}:${tier}:${suggestion}` */
  id: string;
  requestId: string;
  tier: string;
  outfitTitle: string;
  /** The outfit piece suggestion text this feedback targets. */
  suggestion: string;
  /** The closet item ID that was shown as the match when feedback was given. */
  matchedItemId: string | null;
  matchedItemTitle: string | null;
  thumb: 'up' | 'down';
  createdAt: string;
  /**
   * All item IDs rejected for this slot across repeated thumbs-down actions.
   * Used to exclude them from future rematch attempts so the same bad match
   * is never surfaced again.
   */
  excludedItemIds: string[];
};

export function buildMatchFeedbackId(requestId: string, tier: string, suggestion: string): string {
  return `${requestId}:${tier}:${suggestion}`;
}

export async function loadMatchFeedback(): Promise<MatchFeedback[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveMatchFeedback(feedback: MatchFeedback): Promise<void> {
  const existing = await loadMatchFeedback();
  const idx = existing.findIndex((f) => f.id === feedback.id);
  const next =
    idx >= 0
      ? existing.map((f, i) => (i === idx ? feedback : f))
      : [feedback, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * Returns the set of closet item IDs that have been thumbed-down for a specific
 * (requestId, tier, suggestion) slot — to be excluded from the next rematch attempt.
 */
export async function getExcludedItemIdsForSlot(
  requestId: string,
  tier: string,
  suggestion: string,
): Promise<string[]> {
  const all = await loadMatchFeedback();
  const excluded = new Set<string>();
  for (const f of all) {
    if (f.requestId !== requestId || f.tier !== tier || f.suggestion !== suggestion) continue;
    if (f.thumb === 'down' && f.matchedItemId) excluded.add(f.matchedItemId);
    for (const id of f.excludedItemIds) excluded.add(id);
  }
  return [...excluded];
}
