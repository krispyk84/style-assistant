import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { STYLISTS, type StylistId } from '@/lib/stylists';
import type { LookRecommendation } from '@/types/look-request';
import { StylistOpinionResultView } from './StylistOpinionResultView';
import { useSecondOpinionRequest } from './useSecondOpinionRequest';

// ── Types ──────────────────────────────────────────────────────────────────────

export type StylistChooserModalProps = {
  visible: boolean;
  recommendation: LookRecommendation;
  onClose: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function StylistChooserModal({ visible, recommendation, onClose }: StylistChooserModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<StylistId | null>(null);

  const { isLoading, result, errorMessage, handleGetOpinion, clearResult } = useSecondOpinionRequest();

  const selectedStylist = STYLISTS.find((s) => s.id === selectedId) ?? null;

  // Pixel-based maxHeight ensures the ScrollView gets a bounded layout context in Yoga.
  // Percentage-based maxHeight on a Pressable does not reliably create a scroll boundary.
  const modalMaxHeight = screenHeight * 0.88;

  function handleClose() {
    clearResult();
    setSelectedId(null);
    onClose();
  }

  function handleReset() {
    clearResult();
    setSelectedId(null);
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      {/* Backdrop — tapping outside closes */}
      <Pressable
        onPress={handleClose}
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(24, 18, 14, 0.5)',
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        {/* Card — stops tap propagation; pixel maxHeight so ScrollView can scroll */}
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 28,
            maxHeight: modalMaxHeight,
            maxWidth: 440,
            overflow: 'hidden',
            width: '100%',
          }}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}>

            {/* Header */}
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <AppText variant="sectionTitle">Second Opinion</AppText>
                <AppText tone="muted" style={{ fontSize: 13 }}>Choose your stylist</AppText>
              </View>
              <Pressable hitSlop={8} onPress={handleClose}>
                <Ionicons color={theme.colors.mutedText} name="close" size={22} />
              </Pressable>
            </View>

            {result ? (
              <StylistOpinionResultView result={result} onReset={handleReset} />
            ) : (
              <>
                {/* Stylist cards */}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  {STYLISTS.map((stylist) => {
                    const isSelected = selectedId === stylist.id;
                    return (
                      <Pressable
                        key={stylist.id}
                        onPress={() => setSelectedId(stylist.id)}
                        style={{
                          alignItems: 'center',
                          backgroundColor: isSelected ? theme.colors.card : theme.colors.background,
                          borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                          borderRadius: 22,
                          borderWidth: isSelected ? 2 : 1,
                          flex: 1,
                          gap: spacing.sm,
                          padding: spacing.md,
                        }}>
                        {/* Round headshot */}
                        <View
                          style={{
                            borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                            borderRadius: 48,
                            borderWidth: 2,
                            height: 96,
                            overflow: 'hidden',
                            width: 96,
                          }}>
                          <Image
                            contentFit="cover"
                            contentPosition="top"
                            source={stylist.image}
                            style={{ height: '100%', width: '100%' }}
                          />
                        </View>

                        {/* Name — first name only */}
                        <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
                          {stylist.name}
                        </AppText>

                        {/* Keywords */}
                        <View style={{ alignItems: 'center', gap: 4 }}>
                          {stylist.keywords.map((kw) => (
                            <AppText
                              key={kw}
                              tone="subtle"
                              style={{ fontSize: 11, textAlign: 'center', letterSpacing: 0.2 }}>
                              {kw}
                            </AppText>
                          ))}
                        </View>

                        {isSelected ? (
                          <Ionicons color={theme.colors.accent} name="checkmark-circle" size={18} />
                        ) : (
                          <Ionicons color={theme.colors.border} name="ellipse-outline" size={18} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {errorMessage ? (
                  <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
                    {errorMessage}
                  </AppText>
                ) : null}

                {isLoading ? (
                  <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
                    <ActivityIndicator color={theme.colors.accent} />
                    <AppText tone="muted" style={{ fontSize: 13, textAlign: 'center' }}>
                      {selectedStylist?.name ?? 'Stylist'} is reviewing the look...
                    </AppText>
                  </View>
                ) : (
                  <PrimaryButton
                    disabled={!selectedId}
                    label={selectedId ? `Ask ${selectedStylist?.name}` : 'Select a stylist'}
                    onPress={() => void handleGetOpinion({ selectedId: selectedId!, recommendation })}
                  />
                )}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
