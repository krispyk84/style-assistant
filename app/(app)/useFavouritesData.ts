import { useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import { deleteSavedClosetOutfit, loadSavedClosetOutfits, type SavedClosetOutfit } from '@/lib/closet-outfit-storage';
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
  const [closetFavourites, setClosetFavourites] = useState<SavedClosetOutfit[]>([]);
  const [deletingClosetFavouriteId, setDeletingClosetFavouriteId] = useState<string | null>(null);
  // Only the genuinely first load shows the full loading state — a refocus
  // with data already on screen refreshes silently in the background so
  // switching back into this tab never flickers back to a loading state.
  const hasLoadedOnceRef = useRef(false);

  const { showToast } = useToast();

  function load() {
    let isMounted = true;
    if (!hasLoadedOnceRef.current) setFavouritesLoading(true);

    void loadSavedClosetOutfits().then((saved) => {
      if (isMounted) setClosetFavourites(saved);
    });

    void (async () => {
      try {
        const saved = await loadSavedOutfits();
        if (!isMounted) return;
        setFavourites(saved);
        setFavouritesError(null);
        setFavouritesLoading(false);
        hasLoadedOnceRef.current = true;

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
        hasLoadedOnceRef.current = true;
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

  async function handleDeleteClosetFavourite(id: string) {
    setDeletingClosetFavouriteId(id);
    try {
      const next = await deleteSavedClosetOutfit(id);
      setClosetFavourites(next);
      showToast('Saved outfit removed.');
    } catch {
      showToast('Could not remove this saved outfit.', 'error');
    }
    setDeletingClosetFavouriteId(null);
  }

  return {
    favourites,
    favouritesLoading,
    favouritesError,
    deletingFavouriteId,
    closetFavourites,
    deletingClosetFavouriteId,
    load,
    handleDelete,
    handleDeleteClosetFavourite,
  };
}
