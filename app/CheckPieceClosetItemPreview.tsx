import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { ClosetItem } from '@/types/closet';

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  closetItem: ClosetItem;
  onChangePress: () => void;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function CheckPieceClosetItemPreview({ closetItem, onChangePress }: Props) {
  const imageUri = closetItem.uploadedImageUrl ?? closetItem.sketchImageUrl ?? null;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 22,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.md,
      }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
        <AppIcon color={theme.colors.accent} name="check-circle" size={16} />
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
          From Your Closet
        </AppText>
      </View>

      {imageUri ? (
        <View
          style={{
            aspectRatio: 3 / 4,
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            overflow: 'hidden',
          }}>
          <Image contentFit="contain" source={{ uri: imageUri }} style={{ height: '100%', width: '100%' }} />
        </View>
      ) : null}

      <AppText style={{ fontFamily: theme.fonts.sansMedium }}>{closetItem.title}</AppText>
      {closetItem.category ? (
        <AppText tone="muted" style={{ fontSize: 13 }}>{closetItem.category}</AppText>
      ) : null}

      <Pressable
        onPress={onChangePress}
        style={{
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: theme.colors.subtleSurface,
          borderColor: theme.colors.border,
          borderRadius: 999,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}>
        <AppIcon color={theme.colors.text} name="swap" size={15} />
        <AppText style={{ fontSize: 13 }}>Change item</AppText>
      </Pressable>
    </View>
  );
}
