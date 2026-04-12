import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
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
import { LOOK_TIER_OPTIONS, type LookTierSlug } from '@/types/look-request';
import { formatTierLabel } from '@/lib/outfit-utils';
import { useFavouritesData } from './useFavouritesData';
import { useHistoryData } from './useHistoryData';
import { useHistoryActions } from './useHistoryActions';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveTab = 'favourites' | 'history';
type TierFilter = 'all' | LookTierSlug;

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIER_FILTER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...LOOK_TIER_OPTIONS.map((t) => ({ value: t as TierFilter, label: formatTierLabel(t) })),
];

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
  const [favouritesFilter, setFavouritesFilter] = useState<TierFilter>('all');
  const [historyFilter, setHistoryFilter] = useState<TierFilter>('all');
  // Ref guards against duplicate loadMore calls on the same scroll event burst
  const loadingMoreRef = useRef(false);

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

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (activeTab !== 'history' || historyHook.historyLoadingMore || !historyHook.historyHasMore) return;
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 300;
      if (nearEnd && !loadingMoreRef.current) {
        loadingMoreRef.current = true;
        historyHook.loadMore();
        // Reset guard after a short delay to allow the next batch to settle
        setTimeout(() => { loadingMoreRef.current = false; }, 1000);
      }
    },
    [activeTab, historyHook],
  );

  return (
    <AppScreen scrollable onScroll={handleScroll}>
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

        {/* Tier filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
          style={{ flexShrink: 0 }}>
          {TIER_FILTER_OPTIONS.map(({ value, label }) => {
            const activeFilter = activeTab === 'favourites' ? favouritesFilter : historyFilter;
            const setFilter = activeTab === 'favourites' ? setFavouritesFilter : setHistoryFilter;
            const isActive = activeFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => setFilter(value)}
                style={{
                  backgroundColor: isActive ? theme.colors.text : 'transparent',
                  borderColor: isActive ? theme.colors.text : theme.colors.border,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                }}>
                <AppText
                  style={{
                    color: isActive ? theme.colors.inverseText : theme.colors.mutedText,
                    fontFamily: staticTheme.fonts.sansMedium,
                    fontSize: 12,
                    letterSpacing: 0.3,
                  }}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Favourites tab content */}
        {activeTab === 'favourites' ? (() => {
          const filtered = favouritesFilter === 'all'
            ? favouritesHook.favourites
            : favouritesHook.favourites.filter((r) => r.recommendation.tier === favouritesFilter);
          return favouritesHook.favouritesLoading ? (
            <LoadingState label="Loading saved outfits..." />
          ) : favouritesHook.favouritesError ? (
            <ErrorState title="Favourites unavailable" message={favouritesHook.favouritesError} />
          ) : filtered.length ? (
            filtered.map((result) => (
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
          ) : favouritesHook.favourites.length ? (
            <EmptyState
              title="No matches"
              message={`No saved outfits for ${formatTierLabel(favouritesFilter as LookTierSlug)}.`}
            />
          ) : (
            <EmptyState
              title="No saved outfits"
              message="Save a recommendation from the result page and it will appear here."
              actionLabel="Create a look"
              actionHref="/create-look"
            />
          );
        })() : null}

        {/* History tab content */}
        {activeTab === 'history' ? (() => {
          const filtered = historyFilter === 'all'
            ? historyHook.historyCards
            : historyHook.historyCards.filter((c) => c.recommendation.tier === historyFilter);
          return historyHook.historyLoading ? (
            <LoadingState label="Loading history..." />
          ) : historyHook.historyError ? (
            <ErrorState title="History unavailable" message={historyHook.historyError} />
          ) : filtered.length ? (
            filtered.map((card) => {
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
            })
          ) : historyHook.historyCards.length ? (
            <EmptyState
              title="No matches"
              message={`No generated looks for ${formatTierLabel(historyFilter as LookTierSlug)}.`}
            />
          ) : (
            <EmptyState
              title="No generated looks"
              message="Every look you generate will appear here. Create your first look to get started."
              actionLabel="Create a look"
              actionHref="/create-look"
            />
          );
        })() : null}

        {/* Pagination indicators — only rendered when history tab is active and has content */}
        {activeTab === 'history' && !historyHook.historyLoading && historyHook.historyCards.length > 0 ? (
          historyHook.historyLoadingMore ? (
            <LoadingState label="Loading more..." />
          ) : !historyHook.historyHasMore ? (
            <AppText
              tone="muted"
              style={{ fontSize: 12, letterSpacing: 0.5, paddingVertical: spacing.sm, textAlign: 'center' }}>
              All looks loaded
            </AppText>
          ) : null
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
