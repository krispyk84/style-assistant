import { useRef, useState } from 'react';

import { useUndoableRemove } from '@/hooks/use-undoable-remove';
import { logAuthEvent } from '@/lib/auth-event-log';
import { deleteSavedClosetOutfit, loadSavedClosetOutfits, type SavedClosetOutfit } from '@/lib/closet-outfit-storage';
import {
  deleteSavedOutfit,
  loadSavedOutfits,
  replaceSavedOutfits,
} from '@/lib/saved-outfits-storage';
import { fetchSavedOutfitsFromSupabase } from '@/lib/supabase-data';
import { withTimeout } from '@/lib/with-timeout';
import { outfitsService } from '@/services/outfits';
import type { SavedOutfit } from '@/types/style';

const CLOUD_FALLBACK_TIMEOUT_MS = 10000;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFavouritesData() {
  const [favourites, setFavourites] = useState<SavedOutfit[]>([]);
  const [favouritesLoading, setFavouritesLoading] = useState(true);
  const [favouritesError, setFavouritesError] = useState<string | null>(null);
  const [closetFavourites, setClosetFavourites] = useState<SavedClosetOutfit[]>([]);
  // Only the genuinely first load shows the full loading state — a refocus
  // with data already on screen refreshes silently in the background so
  // switching back into this tab never flickers back to a loading state.
  const hasLoadedOnceRef = useRef(false);

  const { performRemove } = useUndoableRemove();

  function load() {
    let isMounted = true;
    if (!hasLoadedOnceRef.current) setFavouritesLoading(true);

    void loadSavedClosetOutfits().then((saved) => {
      if (isMounted) setClosetFavourites(saved);
    });

    void (async () => {
      try {
        let saved = await loadSavedOutfits();

        // Local storage is only ever populated by the one-shot sync that
        // runs on SIGNED_IN (lib/user-data-sync.ts) — if that attempt hit a
        // transient network hiccup, local storage stays empty for the rest
        // of the session with no other retry. Treat an empty local result
        // as possibly stale rather than authoritative: fall back to asking
        // the cloud directly, and self-heal local storage if it has data.
        if (saved.length === 0) {
          void logAuthEvent('favourites-load: local empty, trying cloud fallback', null);
          try {
            const cloudSaved = await withTimeout(fetchSavedOutfitsFromSupabase(), CLOUD_FALLBACK_TIMEOUT_MS, 'saved-outfits cloud fallback');
            if (cloudSaved.length > 0) {
              saved = await replaceSavedOutfits(cloudSaved);
              void logAuthEvent(`favourites-load: cloud fallback pulled ${cloudSaved.length}`, null);
            } else {
              void logAuthEvent('favourites-load: cloud fallback returned 0', null);
            }
          } catch (error) {
            void logAuthEvent(`favourites-load: cloud fallback ERROR — ${error instanceof Error ? error.message : String(error)}`, null);
          }
        }

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

  function handleDelete(savedOutfitId: string) {
    const removed = favourites.find((f) => f.id === savedOutfitId);
    if (!removed) return;
    setFavourites((prev) => prev.filter((f) => f.id !== savedOutfitId));
    performRemove({
      message: 'Saved outfit removed.',
      optimisticRemove: () => {},
      commitDelete: () => deleteSavedOutfit(savedOutfitId),
      restore: () => setFavourites((prev) => [removed, ...prev]),
    });
  }

  function handleDeleteClosetFavourite(id: string) {
    const removed = closetFavourites.find((f) => f.id === id);
    if (!removed) return;
    setClosetFavourites((prev) => prev.filter((f) => f.id !== id));
    performRemove({
      message: 'Saved outfit removed.',
      optimisticRemove: () => {},
      commitDelete: () => deleteSavedClosetOutfit(id),
      restore: () => setClosetFavourites((prev) => [removed, ...prev]),
    });
  }

  return {
    favourites,
    favouritesLoading,
    favouritesError,
    closetFavourites,
    load,
    handleDelete,
    handleDeleteClosetFavourite,
  };
}
