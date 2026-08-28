import { router } from 'expo-router';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { buildGenerateOutfitsHref } from '@/lib/closet-outfits-route';
import { formatTierLabel } from '@/lib/outfit-utils';
import { LOOK_TIER_OPTIONS, type LookTierSlug } from '@/types/look-request';
import type { useGenerateOutfits } from './useGenerateOutfits';

const FORMALITY_ICONS: Record<LookTierSlug, AppIconName> = {
  business: 'briefcase',
  'smart-casual': 'sparkles',
  casual: 'sun',
};

type GenerateOutfitsModalProps = {
  hook: ReturnType<typeof useGenerateOutfits>;
};

export function GenerateOutfitsModal({ hook }: GenerateOutfitsModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const { isOpen, close, formality, setFormality } = hook;

  function handleGenerate() {
    close();
    router.push(buildGenerateOutfitsHref(formality));
  }

  return (
    <Modal animationType="fade" transparent visible={isOpen} onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(24, 18, 14, 0.5)',
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 28,
            maxHeight: screenHeight * 0.88,
            maxWidth: 440,
            padding: spacing.lg,
            width: '100%',
            gap: spacing.lg,
          }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: 2 }}>
              <AppText variant="sectionTitle">Generate 5 Outfits</AppText>
              <AppText tone="muted" style={{ fontSize: 13 }}>Built entirely from your closet</AppText>
            </View>
            <Pressable hitSlop={8} onPress={close}>
              <AppIcon color={theme.colors.mutedText} name="close" size={22} />
            </Pressable>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
              Index to which formality?
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {LOOK_TIER_OPTIONS.map((tier) => {
                const isSelected = formality === tier;
                return (
                  <Pressable
                    key={tier}
                    onPress={() => setFormality(tier)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: isSelected ? theme.colors.card : theme.colors.background,
                      borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                      borderRadius: 20,
                      borderWidth: isSelected ? 2 : 1,
                      flex: 1,
                      gap: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.md,
                    }}>
                    <AppIcon color={isSelected ? theme.colors.accent : theme.colors.mutedText} name={FORMALITY_ICONS[tier]} size={22} />
                    <AppText style={{ fontSize: 13, fontFamily: theme.fonts.sansMedium, textAlign: 'center' }}>
                      {formatTierLabel(tier)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton label="Generate" onPress={handleGenerate} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
