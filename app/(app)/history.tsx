import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { WeekPickerModal } from '@/components/week/week-picker-modal';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast-provider';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { deleteSavedOutfit, loadSavedOutfits, replaceSavedOutfits } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse } from '@/types/api';
import type { LookRecommendation } from '@/types/look-request';
import type { SavedOutfit } from '@/types/style';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'favourites' | 'history';

/**
 * A generated look flattened to a per-tier card for the History tab.
 * One HistoryCard = one tier from one outfit generation request.
 */
type HistoryCard = {
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LooksScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('favourites');

  // ── Favourites state ───────────────────────────────────────────────────────
  const [favourites, setFavourites] = useState<SavedOutfit[]>([]);
  const [favouritesLoading, setFavouritesLoading] = useState(true);
  const [favouritesError, setFavouritesError] = useState<string | null>(null);
  const [deletingFavouriteId, setDeletingFavouriteId] = useState<string | null>(null);
  const [weekPickerItem, setWeekPickerItem] = useState<SavedOutfit | null>(null);

  // ── History state ──────────────────────────────────────────────────────────
  const [historyCards, setHistoryCards] = useState<HistoryCard[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [deletingHistoryRequestId, setDeletingHistoryRequestId] = useState<string | null>(null);

  const { showToast } = useToast();
  const { theme } = useTheme();

  // Reset to Favourites + reload on every screen focus
  useFocusEffect(
    useCallback(() => {
      setActiveTab('favourites');
      setHistoryFetched(false); // re-fetch history next time that tab is opened
      loadFavourites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // ── Favourites data ────────────────────────────────────────────────────────

  function loadFavourites() {
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

  async function handleDeleteFavourite(savedOutfitId: string) {
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

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!weekPickerItem) return;
    try {
      await assignOutfitToWeekDay(dayKey, dayLabel, weekPickerItem.input, weekPickerItem.recommendation, weekPickerItem.requestId);
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }
    setWeekPickerItem(null);
  }

  // ── History data ───────────────────────────────────────────────────────────

  function loadHistory() {
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

  async function handleDeleteFromHistory(requestId: string) {
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

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === 'history' && !historyFetched) {
      loadHistory();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 2 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">Looks</AppText>
          <AppText tone="muted">Your favourited and generated outfits.</AppText>
        </View>

        {/* Segmented control */}
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            padding: 3,
          }}>
          {(['favourites', 'history'] as ActiveTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => handleTabChange(tab)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? theme.colors.text : 'transparent',
                  borderRadius: 11,
                  flex: 1,
                  paddingVertical: spacing.sm,
                }}>
                <AppText
                  style={{
                    color: isActive ? theme.colors.inverseText : theme.colors.mutedText,
                    fontFamily: staticTheme.fonts.sansMedium,
                    fontSize: 13,
                    letterSpacing: 0.4,
                  }}>
                  {tab === 'favourites' ? 'Favourites' : 'History'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Favourites tab content */}
        {activeTab === 'favourites' ? (
          favouritesLoading ? (
            <LoadingState label="Loading saved outfits..." />
          ) : favouritesError ? (
            <ErrorState title="Favourites unavailable" message={favouritesError} />
          ) : favourites.length ? (
            favourites.map((result) => (
              <OutfitResultCard
                key={result.id}
                result={result}
                onAddToWeek={() => setWeekPickerItem(result)}
                onDelete={
                  deletingFavouriteId === result.id
                    ? undefined
                    : () => void handleDeleteFavourite(result.id)
                }
              />
            ))
          ) : (
            <EmptyState
              title="No saved outfits"
              message="Save a recommendation from the result page and it will appear here."
              actionLabel="Create a look"
              actionHref="/create-look"
            />
          )
        ) : null}

        {/* History tab content */}
        {activeTab === 'history' ? (
          historyLoading ? (
            <LoadingState label="Loading history..." />
          ) : historyError ? (
            <ErrorState title="History unavailable" message={historyError} />
          ) : historyCards.length ? (
            historyCards.map((card) => (
              <OutfitResultCard
                key={card.id}
                result={{
                  id: card.id,
                  requestId: card.requestId,
                  savedAt: card.createdAt,
                  input: card.input as any,
                  recommendation: card.recommendation,
                }}
                dateLabel={`Created ${formatDate(card.createdAt)}`}
                onDelete={
                  deletingHistoryRequestId === card.requestId
                    ? undefined
                    : () => void handleDeleteFromHistory(card.requestId)
                }
              />
            ))
          ) : (
            <EmptyState
              title="No generated looks"
              message="Every look you generate will appear here. Create your first look to get started."
              actionLabel="Create a look"
              actionHref="/create-look"
            />
          )
        ) : null}

      </View>

      <WeekPickerModal
        visible={Boolean(weekPickerItem)}
        onClose={() => setWeekPickerItem(null)}
        onSelectDay={handleAssignToWeek}
      />
    </AppScreen>
  );
}
