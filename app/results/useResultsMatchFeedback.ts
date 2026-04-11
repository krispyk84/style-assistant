import { useEffect, useMemo, useRef, useState } from 'react';

import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import { findBestClosetMatch } from '@/lib/closet-match';
import { normalizePiece, type OutfitPiece } from '@/types/look-request';
import { useMatchFeedback } from '@/hooks/use-match-feedback';
import { useMatchSensitivity } from '@/hooks/use-match-sensitivity';
import { incrementClosetItemCounter } from '@/lib/closet-storage';
import { trackClosetMatchShown } from '@/lib/analytics';
import type { GenerateOutfitsResponse } from '@/types/api';

export function useResultsMatchFeedback(requestId: string, response: GenerateOutfitsResponse | null) {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  // suggestion string → ClosetItem | null (LLM no match, fallback runs) | false (rematch exhausted, no fallback)
  const [matchMap, setMatchMap] = useState<Record<string, ClosetItem | null | false>>({});
  // Tracks which closet item IDs have already had matchedToRecommendationCount incremented
  const countedMatchedIdsRef = useRef<Set<string>>(new Set());
  const sensitivity = useMatchSensitivity();

  // Stable across sketch-poll response updates (memoized on requestId only)
  const uniquePieces = useMemo((): OutfitPiece[] => {
    if (!response) return [];
    const allPieces = response.recommendations.flatMap((r) => [
      ...r.keyPieces,
      ...r.shoes,
      ...r.accessories,
    ]);
    const seen = new Set<string>();
    return allPieces
      .map((p) => normalizePiece(p))
      .filter((piece) => {
        if (seen.has(piece.display_name)) return false;
        seen.add(piece.display_name);
        return true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response?.requestId]);

  const { matchFeedbackMap, regeneratingMatches, handleMatchThumbsUp, handleMatchThumbsDown } =
    useMatchFeedback({
      requestId,
      closetItems,
      pieces: uniquePieces,
      sensitivity,
      onSlotRematched: (suggestion, item) =>
        // null from rematch means all candidates exhausted → false sentinel prevents local-scoring fallback
        setMatchMap((prev) => ({ ...prev, [suggestion]: item ?? false })),
    });

  // Load closet items once on mount so matching runs against current wardrobe
  useEffect(() => {
    void closetService.getItems().then((r) => {
      if (r.success && r.data) setClosetItems(r.data.items);
    });
  }, []);

  // Once both outfit response and closet items are ready, run local deterministic matching
  useEffect(() => {
    if (!uniquePieces.length || !closetItems.length) return;

    const resolved: Record<string, ClosetItem | null> = {};
    const newlyMatchedIds: string[] = [];

    for (const piece of uniquePieces) {
      const item = findBestClosetMatch(piece, closetItems, undefined, sensitivity);
      resolved[piece.display_name] = item;
      if (item && !countedMatchedIdsRef.current.has(item.id)) {
        countedMatchedIdsRef.current.add(item.id);
        newlyMatchedIds.push(item.id);
      }
    }

    setMatchMap(resolved);
    const matchCount = Object.values(resolved).filter(Boolean).length;
    if (matchCount > 0) {
      trackClosetMatchShown({ match_count: matchCount, tier: 'results' });
    }
    for (const id of newlyMatchedIds) {
      void incrementClosetItemCounter(id, 'matchedToRecommendationCount');
    }
    // uniquePieces is stable across sketch-poll updates (memoized on requestId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniquePieces, closetItems]);

  return {
    closetItems,
    matchMap,
    uniquePieces,
    matchFeedbackMap,
    regeneratingMatches,
    handleMatchThumbsUp,
    handleMatchThumbsDown,
  };
}
