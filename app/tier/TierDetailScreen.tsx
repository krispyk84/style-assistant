import { Pressable, View } from 'react-native';

import { LookTierDetailCard } from '@/components/cards/look-tier-detail-card';
import { OutfitPieceListView } from '@/components/cards/OutfitPieceListView';
import { StylistChooserModal } from '@/components/second-opinion/stylist-chooser-modal';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { trackClosetMatchThumbDown, trackClosetMatchThumbUp } from '@/lib/analytics';
import { buildPiecesToCheck } from './tier-detail-helpers';
import { useTierDetailActions } from './useTierDetailActions';
import { useTierDetailData } from './useTierDetailData';
import { useTierDetailMatching } from './useTierDetailMatching';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function TierDetailScreen() {
  const { stableParams, requestInput, matchedTier, liveRecommendation, closetItems } = useTierDetailData();

  const {
    matchMap,
    matchFeedbackMap,
    regeneratingMatches,
    handleMatchThumbsUp,
    handleMatchThumbsDown,
  } = useTierDetailMatching({
    requestId: stableParams.requestId ?? '',
    tier: stableParams.tier ?? '',
    liveRecommendation,
    closetItems,
  });

  const {
    secondOpinionVisible,
    setSecondOpinionVisible,
    outfitFeedback,
    handleOutfitFeedback,
    handleCheckPiece,
    handleSelfieCheck,
  } = useTierDetailActions({
    requestId: stableParams.requestId,
    liveRecommendation,
    requestInput,
  });

  const { theme } = useTheme();

  // Early return placed after all hook calls to satisfy Rules of Hooks
  if (!matchedTier || !liveRecommendation) {
    console.warn(
      '[TierDetailScreen] early return:',
      JSON.stringify({ tier: stableParams.tier, hasMatchedTier: Boolean(matchedTier), hasLiveRecommendation: Boolean(liveRecommendation), hasTitle: Boolean(stableParams.recommendationTitle) }),
    );
    return (
      <AppScreen>
        <ErrorState
          title="Tier not found"
          message="Open tier details from a generated look so the route carries the selected recommendation."
          actionLabel="Create a look"
          actionHref="/create-look"
        />
      </AppScreen>
    );
  }

  const piecesToCheck = buildPiecesToCheck(
    liveRecommendation,
    closetItems,
    matchMap,
    requestInput?.anchorItemDescription,
  );

  const tierSlug = stableParams.tier ?? '';

  return (
    <AppScreen scrollable floatingBack>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title={matchedTier.label} showBack />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">{matchedTier.label}</AppText>
          <AppText tone="muted">{matchedTier.shortDescription}</AppText>
        </View>
        <LookTierDetailCard definition={matchedTier} recommendation={liveRecommendation} />

        {/* Second Opinion — ask a stylist about this specific look */}
        <Pressable
          onPress={() => setSecondOpinionVisible(true)}
          style={{
            alignItems: 'center',
            borderColor: theme.colors.accent,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}>
          <AppIcon color={theme.colors.accent} name="chat" size={18} />
          <AppText style={{ color: theme.colors.accent }}>Second Opinion</AppText>
        </Pressable>

        {/* Outfit-level feedback */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['love', 'hate'] as const).map((thumb) => {
            const isSelected = outfitFeedback === thumb;
            return (
              <Pressable
                key={thumb}
                onPress={() => void handleOutfitFeedback(thumb)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isSelected ? theme.colors.text : 'transparent',
                  borderColor: isSelected ? theme.colors.text : theme.colors.border,
                  borderRadius: 999,
                  borderWidth: 1,
                  flex: 1,
                  flexDirection: 'row',
                  gap: spacing.xs,
                  justifyContent: 'center',
                  paddingVertical: spacing.sm,
                }}>
                <AppIcon
                  color={isSelected ? theme.colors.inverseText : theme.colors.mutedText}
                  name={thumb === 'love' ? 'heart' : 'thumbs-down'}
                  size={16}
                />
                <AppText
                  style={{
                    color: isSelected ? theme.colors.inverseText : theme.colors.mutedText,
                    fontSize: 13,
                  }}>
                  {thumb === 'love' ? 'Love it' : 'Hate it'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.md }}>
          <AppText variant="sectionTitle">Check recommended pieces</AppText>
          <AppText tone="muted">
            Compare the pieces you own against this exact recommendation. You can check any items you want before moving to the selfie review.
          </AppText>

          <OutfitPieceListView
            pieces={piecesToCheck}
            display="card"
            regeneratingMatches={regeneratingMatches}
            matchFeedbackMap={matchFeedbackMap}
            onMatchThumbsUp={(suggestion, matchedItemId) => {
              trackClosetMatchThumbUp({ tier: tierSlug });
              handleMatchThumbsUp(tierSlug, suggestion, matchedItemId, liveRecommendation.title);
            }}
            onMatchThumbsDown={(suggestion, matchedItemId) => {
              trackClosetMatchThumbDown({ tier: tierSlug });
              handleMatchThumbsDown(tierSlug, suggestion, matchedItemId, liveRecommendation.title);
            }}
            onPieceSelect={(piece) => handleCheckPiece(piece.value)}
            trailingIcon="camera"
          />
        </View>

        <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
          <AppText variant="sectionTitle">Full outfit check</AppText>
          <AppText tone="muted">
            Once you have checked any pieces you want, upload photos of yourself wearing the outfit and get a final execution review.
          </AppText>
          <PrimaryButton label="Continue to selfie check" onPress={handleSelfieCheck} />
        </View>
      </View>

      <StylistChooserModal
        visible={secondOpinionVisible}
        recommendation={liveRecommendation}
        onClose={() => setSecondOpinionVisible(false)}
      />
    </AppScreen>
  );
}
