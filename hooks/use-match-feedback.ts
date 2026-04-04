import { useState } from 'react';

import { loadAppSettings } from '@/lib/app-settings-storage';
import { findBestClosetMatch, isClosetMatchValid } from '@/lib/closet-match';
import {
  buildMatchFeedbackId,
  getExcludedItemIdsForSlot,
  saveMatchFeedback,
} from '@/lib/match-feedback-storage';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';

type UseMatchFeedbackOptions = {
  requestId: string;
  closetItems: ClosetItem[];
  /** Called when a slot has been rematched so the screen can update its matchMap. */
  onSlotRematched: (suggestion: string, item: ClosetItem | null) => void;
};

type UseMatchFeedbackReturn = {
  matchFeedbackMap: Record<string, 'up' | 'down' | null>;
  regeneratingMatches: Set<string>;
  handleMatchThumbsUp: (
    tier: string,
    suggestion: string,
    matchedItemId: string,
    outfitTitle: string,
  ) => void;
  handleMatchThumbsDown: (
    tier: string,
    suggestion: string,
    matchedItemId: string,
    outfitTitle: string,
  ) => void;
};

/**
 * Manages per-match thumbs feedback and slot-level closet rematch.
 * Shared between the outfit results screen (multi-tier) and the tier detail
 * screen (single-tier / favorites flow).
 */
export function useMatchFeedback({
  requestId,
  closetItems,
  onSlotRematched,
}: UseMatchFeedbackOptions): UseMatchFeedbackReturn {
  const [matchFeedbackMap, setMatchFeedbackMap] = useState<Record<string, 'up' | 'down' | null>>({});
  const [regeneratingMatches, setRegeneratingMatches] = useState<Set<string>>(new Set());

  function handleMatchThumbsUp(
    tier: string,
    suggestion: string,
    matchedItemId: string,
    outfitTitle: string,
  ) {
    setMatchFeedbackMap((prev) => ({ ...prev, [suggestion]: 'up' }));

    // For thumbs-up we record approval without loading existing exclusions —
    // no new items are being rejected so the excludedItemIds list is empty.
    void saveMatchFeedback({
      id: buildMatchFeedbackId(requestId, tier, suggestion),
      requestId,
      tier,
      outfitTitle,
      suggestion,
      matchedItemId,
      matchedItemTitle: closetItems.find((c) => c.id === matchedItemId)?.title ?? null,
      thumb: 'up',
      createdAt: new Date().toISOString(),
      excludedItemIds: [],
    });
  }

  function handleMatchThumbsDown(
    tier: string,
    suggestion: string,
    matchedItemId: string,
    outfitTitle: string,
  ) {
    // Guard: ignore if a rematch is already in flight for this slot
    if (regeneratingMatches.has(suggestion)) return;

    setMatchFeedbackMap((prev) => ({ ...prev, [suggestion]: 'down' }));

    void (async () => {
      // Accumulate all previously rejected IDs for this slot + the new one
      const prevExcluded = await getExcludedItemIdsForSlot(requestId, tier, suggestion);
      const excludedItemIds = [...new Set([...prevExcluded, matchedItemId])];

      void saveMatchFeedback({
        id: buildMatchFeedbackId(requestId, tier, suggestion),
        requestId,
        tier,
        outfitTitle,
        suggestion,
        matchedItemId,
        matchedItemTitle: closetItems.find((c) => c.id === matchedItemId)?.title ?? null,
        thumb: 'down',
        createdAt: new Date().toISOString(),
        excludedItemIds,
      });

      await rematchSlot(suggestion, excludedItemIds);
    })();
  }

  async function rematchSlot(suggestion: string, excludedItemIds: string[]) {
    setRegeneratingMatches((prev) => new Set(prev).add(suggestion));

    try {
      const { closetMatchSensitivity } = await loadAppSettings();
      const excludeSet = new Set(excludedItemIds);
      const itemsForMatching = closetItems.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        brand: item.brand || undefined,
      }));

      // Try backend first — in production it respects excludeItemIds server-side
      const matchResponse = await closetService.matchItems({
        suggestions: [suggestion],
        items: itemsForMatching,
        sensitivity: closetMatchSensitivity,
        excludeItemIds: excludedItemIds,
      });

      let newItem: ClosetItem | null = null;

      if (matchResponse.success && matchResponse.data?.matches[0]?.matchedItemId) {
        const matchedId = matchResponse.data.matches[0].matchedItemId;
        if (!excludeSet.has(matchedId)) {
          const candidate = closetItems.find((c) => c.id === matchedId) ?? null;
          if (candidate && isClosetMatchValid(suggestion, candidate)) {
            newItem = candidate;
          }
        }
      }

      // Fallback: local scoring with exclusion (handles mock env and API null returns)
      if (!newItem) {
        newItem = findBestClosetMatch(suggestion, closetItems, excludeSet);
      }

      onSlotRematched(suggestion, newItem);
      // Clear the 'down' feedback so the new match opens with a fresh state
      setMatchFeedbackMap((prev) => ({ ...prev, [suggestion]: null }));
    } finally {
      setRegeneratingMatches((prev) => {
        const next = new Set(prev);
        next.delete(suggestion);
        return next;
      });
    }
  }

  return { matchFeedbackMap, regeneratingMatches, handleMatchThumbsUp, handleMatchThumbsDown };
}
