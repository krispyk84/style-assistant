import { Image, Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { SelectedAnchor } from '@/app/trip-anchors-types';

type AnchorChipProps = {
  anchor: SelectedAnchor;
  onRemove: () => void;
};

export function AnchorChip({ anchor, onRemove }: AnchorChipProps) {
  const { theme } = useTheme();
  const imageUri = anchor.closetItemImageUrl ?? anchor.localImageUri ?? anchor.imageUrl;

  return (
    <View style={{
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
    }}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.subtleSurface }}
          resizeMode="cover"
        />
      ) : (
        <View style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: theme.colors.subtleSurface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AppIcon name="shirt" color={theme.colors.subtleText} size={18} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }} numberOfLines={1}>
          {anchor.label}
        </AppText>
        <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>
          {anchor.source === 'closet' ? 'Selected from closet'
           : anchor.source === 'ai_suggested' ? 'Suggested by Vesture'
           : anchor.source === 'camera' ? 'Captured with camera'
           : 'Uploaded from library'} · {anchor.category}
        </AppText>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 4 }}>
        <AppIcon name="close" color={theme.colors.subtleText} size={14} />
      </Pressable>
    </View>
  );
}
