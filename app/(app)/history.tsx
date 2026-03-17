import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionHeader } from '@/components/ui/section-header';
import { useToast } from '@/components/ui/toast-provider';
import { spacing } from '@/constants/theme';
import { deleteSavedOutfit, loadSavedOutfits } from '@/lib/saved-outfits-storage';
import type { SavedOutfit } from '@/types/style';

export default function HistoryScreen() {
  const [items, setItems] = useState<SavedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      } catch {
        if (!isMounted) {
          return;
        }

        setItems([]);
        setErrorMessage('Failed to load saved outfits.');
      }

      setIsLoading(false);
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

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader
          title="History"
          subtitle="Saved outfits you can return to whenever you want to revisit a recommendation."
        />
        {isLoading ? (
          <LoadingState label="Loading saved outfits..." />
        ) : errorMessage ? (
          <ErrorState title="History unavailable" message={errorMessage} />
        ) : items.length ? (
          items.map((result) => (
            <OutfitResultCard
              key={result.id}
              result={result}
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
    </AppScreen>
  );
}
