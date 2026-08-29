import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';

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
  const { isOpen, close, formality, setFormality, additionalDetails, setAdditionalDetails } = hook;
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  function handleGenerate() {
    close();
    router.push(buildGenerateOutfitsHref(formality, additionalDetails));
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
            overflow: 'hidden',
            width: '100%',
          }}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}>
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

            {/* Additional Details — collapsible, mirrors the Create-a-New-Look form */}
            <View style={{ gap: spacing.md }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isDetailsExpanded }}
                accessibilityLabel={isDetailsExpanded ? 'Collapse Additional Details' : 'Expand Additional Details'}
                onPress={() => setIsDetailsExpanded((v) => !v)}
                style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Additional Details</AppText>
                  {additionalDetails.trim() && !isDetailsExpanded ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.accent,
                        borderRadius: 999,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                      }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.inverseText, letterSpacing: 1 }}>Added</AppText>
                    </View>
                  ) : null}
                </View>
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    borderRadius: 999,
                    borderWidth: 1,
                    height: 28,
                    justifyContent: 'center',
                    width: 28,
                  }}>
                  <AppIcon
                    color={theme.colors.text}
                    name={isDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                  />
                </View>
              </Pressable>
              {isDetailsExpanded ? (
                <View style={{ gap: spacing.md }}>
                  <AppText tone="muted">Steer these outfits toward a look or event — occasion, style direction, things to avoid.</AppText>
                  <TextInput
                    multiline
                    autoCapitalize="sentences"
                    onChangeText={setAdditionalDetails}
                    placeholder="e.g. black-tie gala, prefer to skip black"
                    placeholderTextColor={theme.colors.subtleText}
                    maxLength={500}
                    style={{
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      borderRadius: 18,
                      borderWidth: 1,
                      color: theme.colors.text,
                      fontFamily: theme.fonts.sans,
                      fontSize: 16,
                      minHeight: 100,
                      paddingHorizontal: spacing.md,
                      paddingTop: spacing.md,
                      textAlignVertical: 'top',
                    }}
                    value={additionalDetails}
                  />
                </View>
              ) : null}
            </View>

            <PrimaryButton label="Generate" onPress={handleGenerate} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
