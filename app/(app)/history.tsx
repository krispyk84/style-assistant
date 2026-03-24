import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { WeekPickerModal } from '@/components/week/week-picker-modal';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast-provider';
import { spacing, theme } from '@/constants/theme';
import { deleteSavedOutfit, loadSavedOutfits, replaceSavedOutfits } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import { outfitsService } from '@/services/outfits';
import type { SavedOutfit } from '@/types/style';

export default function HistoryScreen() {
  const [items, setItems] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [weekPickerItem, setWeekPickerItem] = useState<SavedOutfit | null>(null);
  const isFocused = useIsFocused();
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const savedOutfits = await loadSavedOutfits();

        if (!isMounted) {
          return;
        }

        setItems(savedOutfits);
        setErrorMessage(null);
        setIsLoading(false);

        const hydratedSavedOutfits = await Promise.all(
          savedOutfits.map(async (savedOutfit) => {
            const response = await outfitsService.getOutfitResult(savedOutfit.requestId);

            if (!response.success || !response.data) {
              return savedOutfit;
            }

            const liveRecommendation = response.data.recommendations.find(
              (item) => item.tier === savedOutfit.recommendation.tier
            );

            if (!liveRecommendation) {
              return savedOutfit;
            }

            return {
              ...savedOutfit,
              input: response.data.input,
              recommendation: {
                ...liveRecommendation,
                sketchImageUrl: liveRecommendation.sketchImageUrl,
              },
            };
          })
        );

        if (!isMounted) {
          return;
        }

        setItems(hydratedSavedOutfits);
        setErrorMessage(null);
        await replaceSavedOutfits(hydratedSavedOutfits);
      } catch {
        if (!isMounted) {
          return;
        }

        setItems([]);
        setErrorMessage('Failed to load saved outfits.');
      }
    }

    if (isFocused) {
      setIsLoading(true);
      void loadHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  async function handleDelete(savedOutfitId: string) {
    setDeletingId(savedOutfitId);

    try {
      const nextSavedOutfits = await deleteSavedOutfit(savedOutfitId);
      setItems(nextSavedOutfits);
      showToast('Saved outfit removed.');
    } catch {
      showToast('Could not remove this saved outfit.', 'error');
    }

    setDeletingId(null);
  }

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!weekPickerItem) {
      return;
    }

    try {
      await assignOutfitToWeekDay(
        dayKey,
        dayLabel,
        weekPickerItem.input,
        weekPickerItem.recommendation,
        weekPickerItem.requestId
      );
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }

    setWeekPickerItem(null);
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 2 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">Favourites</AppText>
          <AppText tone="muted">Saved outfits you can return to whenever you want.</AppText>
        </View>
        {isLoading ? (
          <LoadingState label="Loading saved outfits..." />
        ) : errorMessage ? (
          <ErrorState title="History unavailable" message={errorMessage} />
        ) : items.length ? (
          items.map((result) => (
            <OutfitResultCard
              key={result.id}
              result={result}
              onAddToWeek={() => setWeekPickerItem(result)}
              onDelete={deletingId === result.id ? undefined : () => void handleDelete(result.id)}
            />
          ))
        ) : (
          <EmptyState
            title="No saved outfits"
            message="Save a recommendation from the result page and it will appear here for later."
            actionLabel="Create a look"
            actionHref="/(app)/create-look"
          />
        )}
      </View>
      <WeekPickerModal
        visible={Boolean(weekPickerItem)}
        onClose={() => setWeekPickerItem(null)}
        onSelectDay={handleAssignToWeek}
      />
    </AppScreen>
  );
}
