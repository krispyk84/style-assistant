import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export type OutfitThumbnailItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
};

type OutfitItemThumbnailRowProps = {
  items: OutfitThumbnailItem[];
  selectedItemIds?: string[];
  onToggleSelect?: (itemId: string) => void;
};

/**
 * The tappable piece-thumbnail row shared by every outfit card style — real
 * photo/sketch when available, a placeholder icon otherwise. Extracted from
 * ClosetOutfitCard so look results, tier detail, and trip days can all use
 * the same visual language.
 */
export function OutfitItemThumbnailRow({ items, selectedItemIds, onToggleSelect }: OutfitItemThumbnailRowProps) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {items.map((item) => {
        const isSelected = !!selectedItemIds?.includes(item.id);
        const thumbnail = (
          <>
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderColor: isSelected ? theme.colors.accent : 'transparent',
                borderRadius: 12,
                borderWidth: 2,
                height: 72,
                overflow: 'hidden',
                width: 72,
              }}>
              {item.imageUrl ? (
                <Image contentFit="cover" source={{ uri: item.imageUrl }} style={{ height: '100%', width: '100%' }} />
              ) : (
                <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                  <AppIcon color={theme.colors.subtleText} name="closet" size={20} />
                </View>
              )}
              {isSelected ? (
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.accent,
                    borderRadius: 999,
                    height: 20,
                    justifyContent: 'center',
                    position: 'absolute',
                    right: 4,
                    top: 4,
                    width: 20,
                  }}>
                  <AppIcon color={theme.colors.inverseText} name="check-circle" size={14} />
                </View>
              ) : null}
            </View>
            <AppText tone="subtle" numberOfLines={1} style={{ fontSize: 10, marginTop: 2, textAlign: 'center', width: 72 }}>
              {item.title}
            </AppText>
          </>
        );

        if (!onToggleSelect) {
          return (
            <View key={item.id} style={{ alignItems: 'center', width: 72 }}>
              {thumbnail}
            </View>
          );
        }

        return (
          <Pressable key={item.id} onPress={() => onToggleSelect(item.id)} style={{ alignItems: 'center', width: 72 }}>
            {thumbnail}
          </Pressable>
        );
      })}
    </View>
  );
}
