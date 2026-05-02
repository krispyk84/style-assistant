import { useCallback, useRef, useState } from 'react';
import { Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { WeekPickerModal } from '@/components/week/week-picker-modal';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatTierLabel } from '@/lib/outfit-utils';
import { LOOK_TIER_OPTIONS, type LookTierSlug } from '@/types/look-request';
import type { WeatherSeason } from '@/types/weather';
import { LooksFavouritesTab } from './LooksFavouritesTab';
import { LooksFilterPills } from './LooksFilterPills';
import { LooksHistoryTab } from './LooksHistoryTab';
import { useFavouritesData } from './useFavouritesData';
import { useHistoryActions } from './useHistoryActions';
import { useHistoryData } from './useHistoryData';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveTab = 'favourites' | 'history';
type TierFilter = 'all' | LookTierSlug;
type SeasonFilter = 'all' | WeatherSeason;

// ── Filter options ─────────────────────────────────────────────────────────────

const TIER_FILTER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...LOOK_TIER_OPTIONS.map((t) => ({ value: t as TierFilter, label: formatTierLabel(t) })),
];

const SEASON_FILTER_OPTIONS: { value: SeasonFilter; label: string }[] = [
  { value: 'all',    label: 'All Seasons' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall',   label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

// ── Screen ─────────────────────────────────────────────────────────────────────

export function LooksScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('favourites');
  const [favouritesFilter, setFavouritesFilter] = useState<TierFilter>('all');
  const [historyFilter, setHistoryFilter] = useState<TierFilter>('all');
  const [favouritesSeasonFilter, setFavouritesSeasonFilter] = useState<SeasonFilter>('all');
  const [historySeasonFilter, setHistorySeasonFilter] = useState<SeasonFilter>('all');
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
    }, []),
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

  const tierFilter = activeTab === 'favourites' ? favouritesFilter : historyFilter;
  const setTierFilter = activeTab === 'favourites' ? setFavouritesFilter : setHistoryFilter;
  const seasonFilter = activeTab === 'favourites' ? favouritesSeasonFilter : historySeasonFilter;
  const setSeasonFilter = activeTab === 'favourites' ? setFavouritesSeasonFilter : setHistorySeasonFilter;

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

        <LooksFilterPills
          options={TIER_FILTER_OPTIONS}
          selected={tierFilter}
          onSelect={setTierFilter}
          activeColor="text"
        />

        <LooksFilterPills
          options={SEASON_FILTER_OPTIONS}
          selected={seasonFilter}
          onSelect={setSeasonFilter}
          activeColor="accent"
        />

        {activeTab === 'favourites' ? (
          <LooksFavouritesTab
            data={favouritesHook}
            tierFilter={favouritesFilter}
            seasonFilter={favouritesSeasonFilter}
            onAddToWeek={actionsHook.setWeekPickerItem}
          />
        ) : (
          <LooksHistoryTab
            data={historyHook}
            tierFilter={historyFilter}
            seasonFilter={historySeasonFilter}
            onAddToWeek={actionsHook.setWeekPickerItem}
          />
        )}

      </View>

      <WeekPickerModal
        visible={Boolean(actionsHook.weekPickerItem)}
        onClose={() => actionsHook.setWeekPickerItem(null)}
        onSelectDay={actionsHook.handleAssignToWeek}
      />
    </AppScreen>
  );
}
