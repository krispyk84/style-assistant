import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetItem } from '@/types/closet';
import { COLUMN_COUNT, type ClosetRow } from '@/app/(app)/closet-grid-utils';

// ── Row separator ─────────────────────────────────────────────────────────────

export const ClosetGridRowSeparator = () => <View style={{ height: spacing.sm }} />;

// ── Grid row ──────────────────────────────────────────────────────────────────

type ClosetGridRowProps = {
  row: ClosetRow;
  cellWidth: number;
  onPressItem: (item: ClosetItem) => void;
  /** When set, tapping an item toggles selection instead of opening it — used by the pairing flow. */
  isSelectMode?: boolean;
  selectedItemIds?: Set<string>;
  onToggleSelect?: (item: ClosetItem) => void;
};

export const ClosetGridRow = React.memo(function ClosetGridRow({ row, cellWidth, onPressItem, isSelectMode, selectedItemIds, onToggleSelect }: ClosetGridRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {row.map((item) => (
        <ClosetGridItem
          key={item.id}
          item={item}
          cellWidth={cellWidth}
          onPress={onPressItem}
          isSelectMode={isSelectMode}
          isSelected={selectedItemIds?.has(item.id) ?? false}
          onToggleSelect={onToggleSelect}
        />
      ))}
      {row.length < COLUMN_COUNT
        ? Array.from({ length: COLUMN_COUNT - row.length }).map((_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))
        : null}
    </View>
  );
});

// ── Grid item ─────────────────────────────────────────────────────────────────

type ClosetGridItemProps = {
  item: ClosetItem;
  cellWidth: number;
  onPress: (item: ClosetItem) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: ClosetItem) => void;
};

const ClosetGridItem = React.memo(function ClosetGridItem({ item, cellWidth, onPress, isSelectMode, isSelected, onToggleSelect }: ClosetGridItemProps) {
  const { theme } = useTheme();
  const hasBoth = Boolean(item.sketchImageUrl) && Boolean(item.uploadedImageUrl);
  const primaryUri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        style={{ flex: 1, gap: spacing.xs }}
        onPress={() => (isSelectMode ? onToggleSelect?.(item) : onPress(item))}>
        <View
          style={{
            aspectRatio: 3 / 4,
            backgroundColor: theme.colors.card,
            borderColor: isSelectMode && isSelected ? theme.colors.accent : theme.colors.border,
            borderRadius: 16,
            borderWidth: isSelectMode && isSelected ? 2 : 1,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {hasBoth && cellWidth > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: cellWidth, flex: 1 }}>
              <Image contentFit="cover" source={{ uri: item.sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
              <Image contentFit="cover" source={{ uri: item.uploadedImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
            </ScrollView>
          ) : primaryUri ? (
            <Image contentFit="cover" source={{ uri: primaryUri }} style={{ height: '100%', width: '100%' }} />
          ) : item.sketchStatus === 'pending' ? (
            <ActivityIndicator color={theme.colors.subtleText} size="small" />
          ) : (
            <AppIcon color={theme.colors.subtleText} name="shirt" size={22} />
          )}

          {hasBoth && !isSelectMode ? (
            <View style={{ bottom: 6, flexDirection: 'row', gap: 4, position: 'absolute', alignSelf: 'center' }}>
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.9 }} />
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.45 }} />
            </View>
          ) : null}

          {isSelectMode ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: isSelected ? theme.colors.accent : 'rgba(255,255,255,0.85)',
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: isSelected ? 0 : 1,
                height: 22,
                justifyContent: 'center',
                position: 'absolute',
                right: 6,
                top: 6,
                width: 22,
              }}>
              {isSelected ? <AppIcon color={theme.colors.inverseText} name="check" size={13} /> : null}
            </View>
          ) : null}
        </View>
        <View style={{ gap: 2 }}>
          <AppText style={{ fontSize: 11, fontFamily: theme.fonts.sansMedium, letterSpacing: 0.2 }} numberOfLines={2}>
            {item.title}
          </AppText>
          {item.brand ? (
            <AppText tone="muted" style={{ fontSize: 10 }} numberOfLines={1}>{item.brand}</AppText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});
