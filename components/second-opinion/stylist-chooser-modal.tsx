import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { STYLISTS, type StylistId } from '@/lib/stylists';
import { secondOpinionService } from '@/services/second-opinion';
import { trackSecondOpinionRequested } from '@/lib/analytics';
import { recordError } from '@/lib/crashlytics';
import type { LookRecommendation } from '@/types/look-request';
import type { SecondOpinionResponse } from '@/types/api';

type StylistChooserModalProps = {
  visible: boolean;
  recommendation: LookRecommendation;
  onClose: () => void;
};

export function StylistChooserModal({ visible, recommendation, onClose }: StylistChooserModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<StylistId | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SecondOpinionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClose() {
    setSelectedId(null);
    setResult(null);
    setErrorMessage(null);
    setIsLoading(false);
    onClose();
  }

  async function handleGetOpinion() {
    if (!selectedId) return;

    setIsLoading(true);
    setErrorMessage(null);
    trackSecondOpinionRequested({ stylist_id: selectedId });

    const response = await secondOpinionService.getOpinion({
      stylistId: selectedId,
      outfitTitle: recommendation.title,
      tier: recommendation.tier,
      anchorItem: recommendation.anchorItem,
      keyPieces: recommendation.keyPieces.map((p) => (typeof p === 'string' ? p : p.display_name)),
      shoes: recommendation.shoes.map((p) => (typeof p === 'string' ? p : p.display_name)),
      accessories: recommendation.accessories.map((p) => (typeof p === 'string' ? p : p.display_name)),
      fitNotes: recommendation.fitNotes,
      whyItWorks: recommendation.whyItWorks,
      stylingDirection: recommendation.stylingDirection,
    });

    setIsLoading(false);

    if (!response.success || !response.data) {
      setErrorMessage(response.error?.message ?? 'Could not get a second opinion. Please try again.');
      recordError(
        new Error(response.error?.message ?? 'Second opinion request failed'),
        'second_opinion_request'
      );
      return;
    }

    setResult(response.data);
  }

  const selectedStylist = STYLISTS.find((s) => s.id === selectedId) ?? null;

  // Pixel-based maxHeight ensures the ScrollView gets a bounded layout context in Yoga.
  // Percentage-based maxHeight on a Pressable does not reliably create a scroll boundary.
  const modalMaxHeight = screenHeight * 0.88;

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
              <SecondOpinionResult result={result} onReset={() => { setResult(null); setSelectedId(null); }} />
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
                    onPress={() => void handleGetOpinion()}
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

function SecondOpinionResult({
  result,
  onReset,
}: {
  result: SecondOpinionResponse;
  onReset: () => void;
}) {
  const stylist = STYLISTS.find((s) => s.id === result.stylistId);

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Stylist identity row */}
      {stylist ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <View
            style={{
              borderColor: theme.colors.border,
              borderRadius: 28,
              borderWidth: 1,
              height: 56,
              overflow: 'hidden',
              width: 56,
            }}>
            <Image contentFit="cover" contentPosition="top" source={stylist.image} style={{ height: '100%', width: '100%' }} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="sectionTitle">{stylist.name}</AppText>
            <AppText tone="muted" style={{ fontSize: 12 }}>Second Opinion</AppText>
          </View>
        </View>
      ) : null}

      {/* Perspective — the main conversational opinion */}
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderLeftWidth: 3,
          borderRadius: 16,
          borderWidth: 1,
          padding: spacing.md,
        }}>
        <AppText tone="muted" style={{ fontStyle: 'italic', lineHeight: 24 }}>
          "{result.perspective}"
        </AppText>
      </View>

      <PrimaryButton label="Ask another stylist" onPress={onReset} variant="secondary" />
    </View>
  );
}
