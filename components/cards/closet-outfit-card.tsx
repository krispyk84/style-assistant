import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { ClosetGeneratedOutfit } from '@/types/api';

type ClosetOutfitCardProps = {
  outfit: ClosetGeneratedOutfit;
  onPress?: () => void;
  selected?: boolean;
};

export function ClosetOutfitCard({ outfit, onPress, selected }: ClosetOutfitCardProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        borderRadius: 20,
        borderWidth: selected ? 2 : 1,
        gap: spacing.sm,
        padding: spacing.md,
      }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="sectionTitle">{outfit.title}</AppText>
        {selected ? <AppIcon color={theme.colors.accent} name="check-circle" size={18} /> : null}
      </View>

      <AppText tone="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>{outfit.whyItWorks}</AppText>

      <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden' }}>
        <GeneratedSketchPanel
          mode="compact"
          status={outfit.sketchStatus}
          imageUrl={outfit.sketchImageUrl}
          pendingTitle="Sketching this outfit..."
          pendingMessage="The illustration will appear automatically when it's ready."
          failedLabel="Sketch unavailable"
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {outfit.items.map((item) => {
          const imageUri = item.sketchImageUrl ?? item.uploadedImageUrl;
          return (
            <View key={item.id} style={{ alignItems: 'center', width: 72 }}>
              <View
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  height: 72,
                  overflow: 'hidden',
                  width: 72,
                }}>
                {imageUri ? (
                  <Image contentFit="cover" source={{ uri: imageUri }} style={{ height: '100%', width: '100%' }} />
                ) : (
                  <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                    <AppIcon color={theme.colors.subtleText} name="closet" size={20} />
                  </View>
                )}
              </View>
              <AppText tone="subtle" numberOfLines={1} style={{ fontSize: 10, marginTop: 2, textAlign: 'center', width: 72 }}>
                {item.title}
              </AppText>
            </View>
          );
        })}
      </View>

      {onPress ? (
        <AppText tone="muted" style={{ fontSize: 12 }}>
          {selected ? 'Selected' : 'Tap to generate 5 variations'}
        </AppText>
      ) : null}
    </Pressable>
  );
}
