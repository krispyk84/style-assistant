import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { STYLISTS, type StylistId } from '@/lib/stylists';
import { secondOpinionService } from '@/services/second-opinion';
import type { LookRecommendation } from '@/types/look-request';
import type { SecondOpinionResponse } from '@/types/api';

type StylistChooserModalProps = {
  visible: boolean;
  recommendation: LookRecommendation;
  onClose: () => void;
};

export function StylistChooserModal({ visible, recommendation, onClose }: StylistChooserModalProps) {
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

    const response = await secondOpinionService.getOpinion({
      stylistId: selectedId,
      outfitTitle: recommendation.title,
      tier: recommendation.tier,
      anchorItem: recommendation.anchorItem,
      keyPieces: recommendation.keyPieces,
      shoes: recommendation.shoes,
      accessories: recommendation.accessories,
      fitNotes: recommendation.fitNotes,
      whyItWorks: recommendation.whyItWorks,
      stylingDirection: recommendation.stylingDirection,
    });

    setIsLoading(false);

    if (!response.success || !response.data) {
      setErrorMessage(response.error?.message ?? 'Could not get a second opinion. Please try again.');
      return;
    }

    setResult(response.data);
  }

  const selectedStylist = STYLISTS.find((s) => s.id === selectedId) ?? null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
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
            maxHeight: '88%',
            maxWidth: 440,
            width: '100%',
          }}>
          <ScrollView
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}
            showsVerticalScrollIndicator={false}>

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

            {/* Result view */}
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
                            borderRadius: 48,
                            height: 96,
                            overflow: 'hidden',
                            width: 96,
                            borderWidth: 2,
                            borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                          }}>
                          <Image
                            source={stylist.image}
                            style={{ height: '100%', width: '100%' }}
                            contentFit="cover"
                          />
                        </View>

                        {/* Name */}
                        <View style={{ alignItems: 'center', gap: 1 }}>
                          <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
                            {stylist.name}
                          </AppText>
                          <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>
                            {stylist.title}
                          </AppText>
                        </View>

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
                  <AppText tone="muted" style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
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
              borderRadius: 28,
              height: 56,
              overflow: 'hidden',
              width: 56,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
            <Image source={stylist.image} style={{ height: '100%', width: '100%' }} contentFit="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="sectionTitle">{stylist.name} {stylist.title}</AppText>
            <AppText tone="muted" style={{ fontSize: 12 }}>Second Opinion</AppText>
          </View>
        </View>
      ) : null}

      {/* Perspective */}
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderLeftWidth: 3,
          borderRadius: 16,
          borderWidth: 1,
          padding: spacing.md,
        }}>
        <AppText tone="muted" style={{ fontStyle: 'italic', lineHeight: 22 }}>
          "{result.perspective}"
        </AppText>
      </View>

      {/* Key feedback */}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle">Key Observations</AppText>
        {result.keyFeedback.map((item, index) => (
          <View key={index} style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xs }}>
            <Ionicons color={theme.colors.accent} name="ellipse" size={6} style={{ marginTop: 7 }} />
            <AppText tone="muted" style={{ flex: 1 }}>{item}</AppText>
          </View>
        ))}
      </View>

      {/* Suggestions */}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle">Refinements</AppText>
        {result.suggestions.map((item, index) => (
          <View key={index} style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xs }}>
            <AppText tone="muted" style={{ minWidth: 18 }}>{index + 1}.</AppText>
            <AppText tone="muted" style={{ flex: 1 }}>{item}</AppText>
          </View>
        ))}
      </View>

      <PrimaryButton label="Ask another stylist" onPress={onReset} variant="secondary" />
    </View>
  );
}
