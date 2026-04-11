import { useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse } from '@/types/api';
import type { LookRecommendation } from '@/types/look-request';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * A generated look flattened to a per-tier card for the History tab.
 * One HistoryCard = one tier from one outfit generation request.
 */
export type HistoryCard = {
  id: string; // `${requestId}:${tier}` — unique across all history
  requestId: string;
  createdAt: string;
  recommendation: LookRecommendation;
  input: GenerateOutfitsResponse['input'];
};

function flattenToHistoryCards(items: GenerateOutfitsResponse[]): HistoryCard[] {
  const cards: HistoryCard[] = [];
  for (const item of items) {
    for (const rec of item.recommendations) {
      cards.push({
        id: `${item.requestId}:${rec.tier}`,
        requestId: item.requestId,
        createdAt: item.generatedAt,
        recommendation: rec,
        input: item.input,
      });
    }
  }
  return cards;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useHistoryData() {
  const [historyCards, setHistoryCards] = useState<HistoryCard[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [deletingHistoryRequestId, setDeletingHistoryRequestId] = useState<string | null>(null);

  const { showToast } = useToast();

  function load() {
    setHistoryLoading(true);
    setHistoryError(null);

    void (async () => {
      try {
        const res = await outfitsService.getOutfitHistory();
        if (!res.success || !res.data) {
          setHistoryError(res.error?.message ?? 'Failed to load history.');
          setHistoryLoading(false);
          return;
        }
        setHistoryCards(flattenToHistoryCards(res.data.items));
        setHistoryFetched(true);
        setHistoryLoading(false);
      } catch {
        setHistoryError('Failed to load history.');
        setHistoryLoading(false);
      }
    })();
  }

  // Called by the screen's useFocusEffect to mark history stale on next focus
  function resetFetch() {
    setHistoryFetched(false);
  }

  async function handleDelete(requestId: string) {
    setDeletingHistoryRequestId(requestId);
    try {
      const res = await outfitsService.deleteOutfitFromHistory(requestId);
      if (!res.success) throw new Error();
      // Remove all tier cards that belong to this request
      setHistoryCards((prev) => prev.filter((c) => c.requestId !== requestId));
      showToast('Look removed from history.');
    } catch {
      showToast('Could not remove this look.', 'error');
    }
    setDeletingHistoryRequestId(null);
  }

  return {
    historyCards,
    historyLoading,
    historyError,
    historyFetched,
    deletingHistoryRequestId,
    load,
    resetFetch,
    handleDelete,
  };
}
