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
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useFavouritesData } from './useFavouritesData';
import { useHistoryData } from './useHistoryData';
import { useHistoryActions } from './useHistoryActions';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveTab = 'favourites' | 'history';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function LooksScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('favourites');

  const favouritesHook = useFavouritesData();
  const historyHook = useHistoryData();
  const actionsHook = useHistoryActions();

  const { theme } = useTheme();

  // Reset to Favourites + reload on every screen focus
  useFocusEffect(
    useCallback(() => {
      setActiveTab('favourites');
      historyHook.resetFetch(); // re-fetch history next time that tab is opened
      favouritesHook.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === 'history' && !historyHook.historyFetched) {
      historyHook.load();
    }
  }

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
          favouritesHook.favouritesLoading ? (
            <LoadingState label="Loading saved outfits..." />
          ) : favouritesHook.favouritesError ? (
            <ErrorState title="Favourites unavailable" message={favouritesHook.favouritesError} />
          ) : favouritesHook.favourites.length ? (
            favouritesHook.favourites.map((result) => (
              <OutfitResultCard
                key={result.id}
                result={result}
                onAddToWeek={() => actionsHook.setWeekPickerItem(result)}
                onDelete={
                  favouritesHook.deletingFavouriteId === result.id
                    ? undefined
                    : () => void favouritesHook.handleDelete(result.id)
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
          historyHook.historyLoading ? (
            <LoadingState label="Loading history..." />
          ) : historyHook.historyError ? (
            <ErrorState title="History unavailable" message={historyHook.historyError} />
          ) : historyHook.historyCards.length ? (
            historyHook.historyCards.map((card) => {
              const result = {
                id: card.id,
                requestId: card.requestId,
                savedAt: card.createdAt,
                input: card.input as any,
                recommendation: card.recommendation,
              };
              return (
                <OutfitResultCard
                  key={card.id}
                  result={result}
                  dateLabel={`Created ${formatDate(card.createdAt)}`}
                  onAddToWeek={() => actionsHook.setWeekPickerItem(result)}
                  onDelete={
                    historyHook.deletingHistoryRequestId === card.requestId
                      ? undefined
                      : () => void historyHook.handleDelete(card.requestId)
                  }
                />
              );
            }))
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
        visible={Boolean(actionsHook.weekPickerItem)}
        onClose={() => actionsHook.setWeekPickerItem(null)}
        onSelectDay={actionsHook.handleAssignToWeek}
      />
    </AppScreen>
  );
}
