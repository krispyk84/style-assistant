import { useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import {
  deleteSavedOutfit,
  loadSavedOutfits,
  replaceSavedOutfits,
} from '@/lib/saved-outfits-storage';
import { outfitsService } from '@/services/outfits';
import type { SavedOutfit } from '@/types/style';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFavouritesData() {
  const [favourites, setFavourites] = useState<SavedOutfit[]>([]);
  const [favouritesLoading, setFavouritesLoading] = useState(true);
  const [favouritesError, setFavouritesError] = useState<string | null>(null);
  const [deletingFavouriteId, setDeletingFavouriteId] = useState<string | null>(null);

  const { showToast } = useToast();

  function load() {
    let isMounted = true;
    setFavouritesLoading(true);

    void (async () => {
      try {
        const saved = await loadSavedOutfits();
        if (!isMounted) return;
        setFavourites(saved);
        setFavouritesError(null);
        setFavouritesLoading(false);

        // Hydrate any outfits whose sketch was still pending at save time
        const hydrated = await Promise.all(
          saved.map(async (savedOutfit) => {
            if (savedOutfit.recommendation.sketchStatus !== 'pending') return savedOutfit;
            const res = await outfitsService.getOutfitResult(savedOutfit.requestId);
            if (!res.success || !res.data) return savedOutfit;
            const live = res.data.recommendations.find((r) => r.tier === savedOutfit.recommendation.tier);
            if (!live || live.sketchStatus !== 'ready') return savedOutfit;
            return {
              ...savedOutfit,
              recommendation: {
                ...savedOutfit.recommendation,
                sketchStatus: live.sketchStatus,
                sketchImageUrl: live.sketchImageUrl,
              },
            };
          })
        );

        if (!isMounted) return;
        setFavourites(hydrated);
        await replaceSavedOutfits(hydrated);
      } catch {
        if (!isMounted) return;
        setFavourites([]);
        setFavouritesError('Failed to load saved outfits.');
        setFavouritesLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }

  async function handleDelete(savedOutfitId: string) {
    setDeletingFavouriteId(savedOutfitId);
    try {
      const next = await deleteSavedOutfit(savedOutfitId);
      setFavourites(next);
      showToast('Saved outfit removed.');
    } catch {
      showToast('Could not remove this saved outfit.', 'error');
    }
    setDeletingFavouriteId(null);
  }

  return {
    favourites,
    favouritesLoading,
    favouritesError,
    deletingFavouriteId,
    load,
    handleDelete,
  };
}
