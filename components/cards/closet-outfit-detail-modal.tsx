import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { ClosetGeneratedOutfit } from '@/types/api';
import type { ClosetItem } from '@/types/closet';
import { CLOSET_SILHOUETTE_OPTIONS } from '@/types/closet';

export type ClosetOutfitDetailModalProps = {
  visible: boolean;
  outfit: ClosetGeneratedOutfit | null;
  onClose: () => void;
};

export function ClosetOutfitDetailModal({ visible, outfit, onClose }: ClosetOutfitDetailModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: spacing.sm,
            // Modal content renders outside the normal safe-area tree on iOS, so
            // insets.top can read as 0 here even though content draws under the
            // status bar — fall back to a fixed clearance if insets look unset.
            paddingTop: Math.max(insets.top, 50),
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="sectionTitle">{outfit?.title}</AppText>
            {outfit?.whyItWorks ? (
              <AppText tone="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>{outfit.whyItWorks}</AppText>
            ) : null}
          </View>
          <Pressable hitSlop={12} onPress={onClose}>
            <AppIcon color={theme.colors.subtleText} name="close" size={24} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>

          {outfit?.sketchStatus === 'ready' && outfit.sketchImageUrl ? (
            <View style={{ aspectRatio: 3 / 4, backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden', width: '100%' }}>
              <Image contentFit="contain" source={{ uri: outfit.sketchImageUrl }} style={{ height: '100%', width: '100%' }} />
            </View>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
              Pieces in this outfit
            </AppText>
            {(outfit?.items ?? []).map((item, index) => (
              <ItemDetailBlock key={item.id} item={item} showDivider={index > 0} />
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Private helpers ────────────────────────────────────────────────────────────

function ItemDetailBlock({ item, showDivider }: { item: ClosetItem; showDivider: boolean }) {
  const imageUri = item.sketchImageUrl ?? item.uploadedImageUrl;

  return (
    <View style={{ borderTopColor: theme.colors.border, borderTopWidth: showDivider ? 1 : 0, gap: spacing.sm, paddingTop: showDivider ? spacing.md : 0 }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 12, height: 88, overflow: 'hidden', width: 88 }}>
          {imageUri ? (
            <Image contentFit="cover" source={{ uri: imageUri }} style={{ height: '100%', width: '100%' }} />
          ) : (
            <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
              <AppIcon color={theme.colors.subtleText} name="closet" size={22} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
          <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 15 }}>{item.title}</AppText>
          <AppText tone="muted" style={{ fontSize: 12 }}>
            {item.subcategory ? `${item.category} · ${item.subcategory}` : item.category}
          </AppText>
          {item.brand ? <AppText tone="muted" style={{ fontSize: 12 }}>{item.brand}</AppText> : null}
        </View>
      </View>

      <MetadataRow fields={[
        { label: 'Color', value: item.primaryColor },
        { label: 'Material', value: item.material },
        { label: 'Formality', value: item.formality },
      ]} />
      <MetadataRow fields={[
        { label: 'Pattern', value: item.pattern },
        { label: 'Silhouette', value: CLOSET_SILHOUETTE_OPTIONS.find((o) => o.value === item.silhouette)?.label },
        { label: 'Season', value: item.season ? cap(item.season) : undefined },
      ]} />
    </View>
  );
}

/** Renders a horizontal row of up to 3 populated label/value pairs. Skips empty fields gracefully. */
function MetadataRow({ fields }: { fields: { label: string; value?: string | null }[] }) {
  const populated = fields.filter((f) => f.value);
  if (!populated.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {populated.map((f) => (
        <View key={f.label} style={{ flex: 1, gap: 2 }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, fontSize: 10, letterSpacing: 1.2 }}>{f.label}</AppText>
          <AppText style={{ fontSize: 13 }}>{f.value}</AppText>
        </View>
      ))}
    </View>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
