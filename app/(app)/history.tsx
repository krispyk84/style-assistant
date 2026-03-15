import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing } from '@/constants/theme';
import type { OutfitResult } from '@/types/style';
import { outfitsService } from '@/services/outfits';

export default function HistoryScreen() {
  const [items, setItems] = useState<OutfitResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      const response = await outfitsService.getOutfitHistory();

      if (!isMounted) {
        return;
      }

      if (response.success && response.data) {
        setItems(response.data.items);
        setErrorMessage(null);
      } else {
        setItems([]);
        setErrorMessage(response.error?.message ?? 'Failed to load outfit history.');
      }

      setIsLoading(false);
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader
          title="History"
          subtitle="A running archive of style requests, outfit recommendations, and iteration history."
        />
        {isLoading ? (
          <LoadingState label="Loading outfit history..." />
        ) : errorMessage ? (
          <ErrorState title="History unavailable" message={errorMessage} />
        ) : items.length ? (
          items.map((result) => <OutfitResultCard key={result.requestId} result={result} />)
        ) : (
          <EmptyState
            title="No request history"
            message="Past outfit recommendations will appear here once you start creating looks."
            actionLabel="Create a look"
            actionHref="/(app)/create-look"
          />
        )}
      </View>
    </AppScreen>
  );
}
