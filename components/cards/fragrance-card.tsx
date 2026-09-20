import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { FRAGRANCE_VIBE_OPTIONS } from '@/types/fragrance';
import type { UserFragrance } from '@/types/fragrance';

type FragranceCardProps = {
  item: UserFragrance;
  cellWidth: number;
  onPress: (item: UserFragrance) => void;
};

function vibeLabel(vibe: string | null): string | null {
  return FRAGRANCE_VIBE_OPTIONS.find((v) => v.value === vibe)?.label ?? null;
}

export function FragranceCard({ item, cellWidth, onPress }: FragranceCardProps) {
  const { theme } = useTheme();
  const thumbnailUri = item.bottleSketchUrl ?? item.originalImageUrl;
  const accords = item.fragrance.mainAccords?.slice(0, 2).map((a) => a.name) ?? [];
  const vibe = vibeLabel(item.fragrance.primaryVibe);

  return (
    <Pressable onPress={() => onPress(item)} style={{ width: cellWidth, gap: spacing.xs }}>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            aspectRatio: 3 / 4,
            backgroundColor: theme.colors.card,
            borderRadius: 14,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {thumbnailUri ? (
            <Image contentFit="cover" source={{ uri: thumbnailUri }} style={{ height: '100%', width: '100%' }} />
          ) : (
            <AppIcon color={theme.colors.subtleText} name="tag" size={24} />
          )}
        </View>
        {item.isSignature ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.accent,
              borderRadius: 999,
              height: 22,
              justifyContent: 'center',
              position: 'absolute',
              right: 6,
              top: 6,
              width: 22,
            }}>
            <AppIcon color={theme.colors.inverseText} name="star" size={11} />
          </View>
        ) : null}
      </View>
      <View style={{ gap: 1 }}>
        <AppText numberOfLines={1} style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
          {item.fragrance.brand}
        </AppText>
        <AppText numberOfLines={1} tone="muted" style={{ fontSize: 12 }}>
          {item.fragrance.name}
        </AppText>
        {vibe || accords.length > 0 ? (
          <AppText numberOfLines={1} tone="muted" style={{ fontSize: 11 }}>
            {[vibe, ...accords].filter(Boolean).join(' · ')}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
