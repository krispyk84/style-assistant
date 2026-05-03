import { Image } from 'expo-image';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

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
};

export const ClosetGridRow = React.memo(function ClosetGridRow({ row, cellWidth, onPressItem }: ClosetGridRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {row.map((item) => (
        <ClosetGridItem
          key={item.id}
          item={item}
          cellWidth={cellWidth}
          onPress={onPressItem}
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
};

const ClosetGridItem = React.memo(function ClosetGridItem({ item, cellWidth, onPress }: ClosetGridItemProps) {
  const { theme } = useTheme();
  const hasBoth = Boolean(item.sketchImageUrl) && Boolean(item.uploadedImageUrl);
  const primaryUri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1, gap: spacing.xs }} onPress={() => onPress(item)}>
        <View
          style={{
            aspectRatio: 3 / 4,
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: 16,
            borderWidth: 1,
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
            <AppIcon color={theme.colors.subtleText} name="clock" size={22} />
          ) : (
            <AppIcon color={theme.colors.subtleText} name="shirt" size={22} />
          )}

          {hasBoth ? (
            <View style={{ bottom: 6, flexDirection: 'row', gap: 4, position: 'absolute', alignSelf: 'center' }}>
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.9 }} />
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.45 }} />
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
