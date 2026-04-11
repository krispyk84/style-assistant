import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { StylistChooserModal } from '@/components/second-opinion/stylist-chooser-modal';
import { LookTierDetailCard } from '@/components/cards/look-tier-detail-card';
import { ClosetItemSheet } from '@/components/closet/closet-item-sheet';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { trackClosetMatchThumbUp, trackClosetMatchThumbDown } from '@/lib/analytics';
import { buildPiecesToCheck } from './tier-detail-helpers';
import { useTierDetailData } from './useTierDetailData';
import { useTierDetailMatching } from './useTierDetailMatching';
import { useTierDetailActions } from './useTierDetailActions';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function TierDetailScreen() {
  const { stableParams, requestInput, matchedTier, liveRecommendation, closetItems } = useTierDetailData();

  const {
    matchMap,
    sheetPiece,
    setSheetPiece,
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

  const { secondOpinionVisible, setSecondOpinionVisible, handleCheckPiece, handleSelfieCheck } =
    useTierDetailActions({
      requestId: stableParams.requestId,
      liveRecommendation,
      requestInput,
    });

  const { theme } = useTheme();

  // Early return placed after all hook calls to satisfy Rules of Hooks
  if (!matchedTier || !liveRecommendation) {
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

  const pieceRowStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as const;

  const piecesToCheck = buildPiecesToCheck(
    liveRecommendation,
    closetItems,
    matchMap,
    requestInput?.anchorItemDescription,
  );
  const hasAnyMatch = piecesToCheck.some((p) => !p.isAnchor && p.matchedClosetItem !== null);

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
          <Ionicons color={theme.colors.accent} name="chatbubble-ellipses-outline" size={18} />
          <AppText style={{ color: theme.colors.accent }}>Second Opinion</AppText>
        </Pressable>

        <View style={{ gap: spacing.md }}>
          <AppText variant="sectionTitle">Check recommended pieces</AppText>
          <AppText tone="muted">
            Compare the pieces you own against this exact recommendation. You can check any items you want before moving to the selfie review.
          </AppText>

          {/* Closet match legend — only shown when at least one piece is owned */}
          {hasAnyMatch ? (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
              <Ionicons color={theme.colors.accent} name="checkmark-circle-outline" size={13} />
              <AppText tone="muted" style={{ fontSize: 12 }}>
                You already own a similar piece
              </AppText>
            </View>
          ) : null}

          {piecesToCheck.map((piece) => {
            const isRematching = regeneratingMatches.has(piece.value);
            return (
              <Pressable
                key={`${piece.label}-${piece.value}`}
                style={pieceRowStyle}
                onPress={() => handleCheckPiece(piece.value)}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="sectionTitle">{piece.label}</AppText>
                  <AppText tone="muted">{piece.value}</AppText>
                </View>
                {/* Closet match checkmark — tapping opens ClosetItemSheet with feedback; never shown for anchor */}
                {!piece.isAnchor && isRematching ? (
                  <ActivityIndicator color={theme.colors.accent} size="small" />
                ) : !piece.isAnchor && piece.matchedClosetItem ? (
                  <Pressable
                    accessibilityLabel={`You own a similar piece: ${piece.matchedClosetItem.title}. Tap to view and rate.`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setSheetPiece({ item: piece.matchedClosetItem!, suggestion: piece.value, confidencePercent: piece.confidencePercent })}
                    style={{ paddingTop: 2 }}>
                    <Ionicons color={theme.colors.accent} name="checkmark-circle" size={22} />
                  </Pressable>
                ) : null}
                <Ionicons color={theme.colors.text} name="camera-outline" size={22} />
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
          <AppText variant="sectionTitle">Full outfit check</AppText>
          <AppText tone="muted">
            Once you have checked any pieces you want, upload photos of yourself wearing the outfit and get a final execution review.
          </AppText>
          <PrimaryButton label="Continue to selfie check" onPress={handleSelfieCheck} />
        </View>
      </View>

      {/* Bottom sheet shown when user taps a closet-match checkmark — includes per-match feedback */}
      {sheetPiece ? (() => {
        // Derive current item live from piecesToCheck so the sheet auto-updates after rematch
        const currentItem = piecesToCheck.find(p => p.value === sheetPiece.suggestion)?.matchedClosetItem ?? null;
        const isRematching = regeneratingMatches.has(sheetPiece.suggestion);
        return (
          <ClosetItemSheet
            item={currentItem}
            suggestion={sheetPiece.suggestion}
            isRematching={isRematching}
            thumbsFeedback={matchFeedbackMap[sheetPiece.suggestion] ?? null}
            confidencePercent={sheetPiece.confidencePercent}
            onThumbsUp={
              currentItem
                ? () => {
                    trackClosetMatchThumbUp({ tier: stableParams.tier ?? '' });
                    handleMatchThumbsUp(stableParams.tier, sheetPiece.suggestion, currentItem.id, liveRecommendation.title);
                  }
                : undefined
            }
            onThumbsDown={
              currentItem
                ? () => {
                    trackClosetMatchThumbDown({ tier: stableParams.tier ?? '' });
                    handleMatchThumbsDown(stableParams.tier, sheetPiece.suggestion, currentItem.id, liveRecommendation.title);
                  }
                : undefined
            }
            onClose={() => setSheetPiece(null)}
          />
        );
      })() : null}

      <StylistChooserModal
        visible={secondOpinionVisible}
        recommendation={liveRecommendation}
        onClose={() => setSecondOpinionVisible(false)}
      />
    </AppScreen>
  );
}
