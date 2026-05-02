import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, FlatList, LayoutAnimation, Platform, Pressable, SectionList, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { CategoryFilterModal } from '@/components/closet/CategoryFilterModal';
import { ClosetGridRow, ClosetGridRowSeparator } from '@/components/closet/ClosetGrid';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetItem } from '@/types/closet';
import {
  type CategoryEntry, type ClosetRow, type ClosetSection,
} from './closet-grid-utils';
import type { ClosetSortMode } from './useClosetNavigation';

// ── Props ─────────────────────────────────────────────────────────────────────

export type ClosetScreenViewProps = {
  // Data
  isLoading: boolean;
  itemCount: number;
  eligibleItemCount: number;
  categories: CategoryEntry[];
  sections: ClosetSection[];
  // Navigation / filter
  selectedCategory: string | null;
  filteredRows: ClosetRow[];
  filterModalVisible: boolean;
  onFilterPress: () => void;
  onCategorySelect: (cat: string | null) => void;
  onFilterModalClose: () => void;
  // Sort
  sortMode: ClosetSortMode;
  onToggleSort: () => void;
  useFlatList: boolean;
  // Add item modal
  addModalVisible: boolean;
  onAddPress: () => void;
  onAddModalClose: () => void;
  onNewItemSaved: (item: ClosetItem) => void;
  // Help Me Pick
  onHelpMePickPress: () => void;
  // Closet Analyser
  onAnalysePress: () => void;
  // Grid
  cellWidth: number;
  onPressItem: (item: ClosetItem) => void;
  flatListRef: React.RefObject<FlatList<ClosetRow> | null>;
  sectionListRef: React.RefObject<SectionList<ClosetRow> | null>;
  // Animation
  translateX: Animated.Value;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function ClosetScreenView({
  isLoading,
  itemCount,
  eligibleItemCount,
  categories,
  sections,
  selectedCategory,
  filteredRows,
  filterModalVisible,
  onFilterPress,
  onCategorySelect,
  onFilterModalClose,
  sortMode,
  onToggleSort,
  useFlatList,
  addModalVisible,
  onAddPress,
  onAddModalClose,
  onNewItemSaved,
  onHelpMePickPress,
  onAnalysePress,
  cellWidth,
  onPressItem,
  flatListRef,
  sectionListRef,
  translateX,
}: ClosetScreenViewProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const activeLabel = selectedCategory ?? 'All Items';

  // ── Floating add button — appears once header scrolls out of view ────────────
  const [fabVisible, setFabVisible] = useState(false);

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      setFabVisible(e.nativeEvent.contentOffset.y > 80);
    },
    [],
  );

  // ── Options accordion ────────────────────────────────────────────────────────
  const [optionsOpen, setOptionsOpen] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  function toggleOptions() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !optionsOpen;
    setOptionsOpen(next);
    Animated.timing(chevronAnim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }

  // renderItem is stable unless cellWidth or onPressItem changes
  const renderRow = useCallback(
    ({ item: row }: { item: ClosetRow }) => (
      <ClosetGridRow row={row} cellWidth={cellWidth} onPressItem={onPressItem} />
    ),
    [cellWidth, onPressItem],
  );

  const pillStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as const;

  const listHeaderContent = (
    <View style={{ gap: spacing.xl, paddingBottom: spacing.xs }}>
      {/* Title + add button (original position) */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.sm, flex: 1 }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">My Closet</AppText>
          <AppText tone="muted">Your catalogued wardrobe pieces.</AppText>
        </View>
        <Pressable
          hitSlop={8}
          onPress={onAddPress}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.accent,
            borderRadius: 999,
            height: 40,
            justifyContent: 'center',
            width: 40,
          }}>
          <AppIcon color="#FFF" name="add" size={22} />
        </Pressable>
      </View>

      {/* Loading bar */}
      {isLoading ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            padding: spacing.xl,
            gap: spacing.md,
            alignItems: 'center',
          }}>
          <View
            style={{
              backgroundColor: theme.colors.border,
              borderRadius: 999,
              height: 10,
              overflow: 'hidden',
              width: '100%',
            }}>
            <Animated.View
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                height: '100%',
                transform: [{ translateX }],
                width: 140,
              }}
            />
          </View>
          <AppText tone="muted">Loading your wardrobe...</AppText>
        </View>
      ) : null}

      {/* Filter + sort pills */}
      {!isLoading && itemCount > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Pressable onPress={onFilterPress} style={pillStyle}>
            <AppText variant="eyebrow" style={{ letterSpacing: 1.4 }}>{activeLabel}</AppText>
            <AppIcon color={theme.colors.mutedText} name="chevron-down" size={14} />
          </Pressable>
          <Pressable onPress={onToggleSort} style={pillStyle}>
            <AppIcon
              color={theme.colors.mutedText}
              name={sortMode === 'recent' ? 'clock' : 'layers'}
              size={14}
            />
            <AppText variant="eyebrow" style={{ letterSpacing: 1.4 }}>
              {sortMode === 'recent' ? 'Recent' : 'Category'}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {/* Options accordion */}
      {!isLoading && itemCount > 0 ? (
        <>
          <Pressable
            hitSlop={8}
            onPress={toggleOptions}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: spacing.xs,
            }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
              Options
            </AppText>
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <AppIcon color={theme.colors.mutedText} name="chevron-right" size={14} />
            </Animated.View>
          </Pressable>

          {optionsOpen ? (
            eligibleItemCount >= 10 ? (
              <View style={{ gap: spacing.md }}>
                <Pressable
                  onPress={onHelpMePickPress}
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  }}>
                  <AppIcon color={theme.colors.accent} name="sparkles" size={18} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontSize: 14, fontFamily: theme.fonts.sansMedium }}>Help me pick an anchor</AppText>
                    <AppText tone="muted" style={{ fontSize: 12 }}>Let a stylist choose your starting piece</AppText>
                  </View>
                  <AppIcon color={theme.colors.subtleText} name="chevron-right" size={16} />
                </Pressable>

                <Pressable
                  onPress={onAnalysePress}
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  }}>
                  <AppIcon color={theme.colors.accent} name="layers" size={18} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontSize: 14, fontFamily: theme.fonts.sansMedium }}>Analyse My Closet</AppText>
                    <AppText tone="muted" style={{ fontSize: 12 }}>See how complete and versatile your wardrobe is</AppText>
                  </View>
                  <AppIcon color={theme.colors.subtleText} name="chevron-right" size={16} />
                </Pressable>
              </View>
            ) : eligibleItemCount > 0 ? (
              <AppText tone="muted" style={{ fontSize: 12 }}>
                Add {10 - eligibleItemCount} more top{10 - eligibleItemCount === 1 ? '' : 's'}, bottom{10 - eligibleItemCount === 1 ? '' : 's'}, or outerwear to unlock these options.
              </AppText>
            ) : null
          ) : null}
        </>
      ) : null}

      {/* Empty state */}
      {!isLoading && itemCount === 0 ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.md,
            padding: spacing.xl,
          }}>
          <AppIcon color={theme.colors.subtleText} name="shirt" size={40} />
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="sectionTitle">Your closet is empty</AppText>
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              Save pieces from your outfit reviews or piece checks to start cataloguing your wardrobe.
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {useFlatList ? (
        <FlatList<ClosetRow>
          ref={flatListRef}
          data={filteredRows}
          keyExtractor={(row, i) => row[0]?.id ?? String(i)}
          renderItem={renderRow}
          ListHeaderComponent={listHeaderContent}
          ItemSeparatorComponent={ClosetGridRowSeparator}
          ListEmptyComponent={
            !isLoading ? (
              <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
                No items in this category.
              </AppText>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      ) : (
        <SectionList<ClosetRow>
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(row, i) => row[0]?.id ?? String(i)}
          renderItem={renderRow}
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ paddingBottom: spacing.md, paddingTop: spacing.xl }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                {title}
              </AppText>
            </View>
          )}
          ListHeaderComponent={listHeaderContent}
          ItemSeparatorComponent={ClosetGridRowSeparator}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollToIndexFailed={() => undefined}
        />
      )}

      {/* Floating add button — appears over content once header scrolls off screen,
          mirrors the AppScreen floatingBack pattern exactly */}
      {fabVisible ? (
        <Pressable
          hitSlop={8}
          onPress={onAddPress}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            elevation: 4,
            flexDirection: 'row',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            position: 'absolute',
            right: spacing.lg,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            top: insets.top + spacing.md,
          }}>
          <AppIcon color={theme.colors.text} name="add" size={16} />
          <AppText style={{ fontSize: 14 }}>Add</AppText>
        </Pressable>
      ) : null}

      <SaveToClosetModal
        visible={addModalVisible}
        onClose={onAddModalClose}
        onSaved={onNewItemSaved}
      />

      <CategoryFilterModal
        visible={filterModalVisible}
        categories={categories}
        selected={selectedCategory}
        onSelect={onCategorySelect}
        onClose={onFilterModalClose}
      />
    </SafeAreaView>
  );
}
