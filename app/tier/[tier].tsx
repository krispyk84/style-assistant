import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { StylistChooserModal } from '@/components/second-opinion/stylist-chooser-modal';

import { LookTierDetailCard } from '@/components/cards/look-tier-detail-card';
import { ClosetItemSheet } from '@/components/closet/closet-item-sheet';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import { findBestClosetMatch, isClosetMatchValid } from '@/lib/closet-match';
import { getLookTierDefinition } from '@/lib/look-mock-data';
import { parseLookInput, parseLookRecommendation, type LookRouteParams } from '@/lib/look-route';
import { closetService } from '@/services/closet';
import { outfitsService } from '@/services/outfits';
import { useMatchFeedback } from '@/hooks/use-match-feedback';
import type { ClosetItem } from '@/types/closet';
import type { LookRecommendation } from '@/types/look-request';

export default function TierScreen() {
  const params = useLocalSearchParams<LookRouteParams & { tier: string; requestId?: string }>();
  const routeKey = JSON.stringify(params);
  const stableParams = useMemo(
    () => JSON.parse(routeKey) as LookRouteParams & { tier: string; requestId?: string },
    [routeKey]
  );
  const matchedTier = stableParams.tier ? getLookTierDefinition(stableParams.tier) : undefined;
  const requestInput = useMemo(() => parseLookInput(stableParams), [stableParams]);
  const initialRecommendation = useMemo(() => parseLookRecommendation(stableParams), [stableParams]);
  const [liveRecommendation, setLiveRecommendation] = useState<LookRecommendation | null>(initialRecommendation);

  // ── Closet matching state ──────────────────────────────────────────────────
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  // suggestion string → ClosetItem | null (LLM no match, fallback runs) | false (rematch exhausted, no fallback)
  const [matchMap, setMatchMap] = useState<Record<string, ClosetItem | null | false>>({});
  // Tracks which piece is open in the "In Your Closet" sheet: item + suggestion for feedback identity
  const [sheetPiece, setSheetPiece] = useState<{ item: ClosetItem; suggestion: string } | null>(null);
  const [secondOpinionVisible, setSecondOpinionVisible] = useState(false);
  const { matchFeedbackMap, regeneratingMatches, handleMatchThumbsUp, handleMatchThumbsDown } =
    useMatchFeedback({
      requestId: stableParams.requestId ?? '',
      closetItems,
      onSlotRematched: (suggestion, item) =>
        // null from rematch means all candidates exhausted → false sentinel prevents local-scoring fallback
        setMatchMap((prev) => ({ ...prev, [suggestion]: item ?? false })),
    });

  // ── Sketch polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const requestId = stableParams.requestId;
    const tier = stableParams.tier;

    if (!requestId || !tier || liveRecommendation?.sketchStatus !== 'pending') {
      return;
    }

    const interval = setInterval(async () => {
      const serviceResponse = await outfitsService.getOutfitResult(requestId);

      if (!serviceResponse.success || !serviceResponse.data) {
        return;
      }

      const nextRecommendation = serviceResponse.data.recommendations.find((item) => item.tier === tier);
      if (nextRecommendation) {
        setLiveRecommendation(nextRecommendation);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [liveRecommendation?.sketchStatus, stableParams.requestId, stableParams.tier]);

  // ── Load closet items once on mount ───────────────────────────────────────
  useEffect(() => {
    void closetService.getItems().then((response) => {
      if (response.success && response.data) {
        setClosetItems(response.data.items);
      }
    });
  }, []);

  // ── LLM-based closet matching (runs when both closet and recommendation are ready) ──
  useEffect(() => {
    if (!liveRecommendation || !closetItems.length) return;

    const suggestions = [
      ...liveRecommendation.keyPieces,
      ...liveRecommendation.shoes,
      ...liveRecommendation.accessories,
    ];
    const uniqueSuggestions = [...new Set(suggestions)];
    if (!uniqueSuggestions.length) return;

    void (async () => {
      const { closetMatchSensitivity } = await loadAppSettings();
      return closetService.matchItems({
        suggestions: uniqueSuggestions,
        items: closetItems.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          brand: item.brand || undefined,
        })),
        sensitivity: closetMatchSensitivity,
      });
    })().then((matchResponse) => {
      if (!matchResponse.success || !matchResponse.data) return;
      const resolved: Record<string, ClosetItem | null> = {};
      for (const match of matchResponse.data.matches) {
        const item = match.matchedItemId
          ? (closetItems.find((c) => c.id === match.matchedItemId) ?? null)
          : null;
        resolved[match.suggestion] = item;
      }
      setMatchMap(resolved);
    });
  // Re-run only when the closet reloads — piece suggestions don't change after load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closetItems]);

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

  const piecesToCheck = buildPiecesToCheck(liveRecommendation, closetItems, matchMap);
  const hasAnyMatch = piecesToCheck.some((p) => p.matchedClosetItem !== null);

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
                onPress={() =>
                  router.push({
                    pathname: '/check-piece',
                    params: {
                      requestId: stableParams.requestId,
                      tier: liveRecommendation.tier,
                      outfitTitle: liveRecommendation.title,
                      anchorItemDescription: requestInput?.anchorItemDescription,
                      pieceName: piece.value,
                    },
                  })
                }>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="sectionTitle">{piece.label}</AppText>
                  <AppText tone="muted">{piece.value}</AppText>
                </View>
                {/* Closet match checkmark — tapping opens ClosetItemSheet with feedback */}
                {isRematching ? (
                  <ActivityIndicator color={theme.colors.accent} size="small" />
                ) : piece.matchedClosetItem ? (
                  <Pressable
                    accessibilityLabel={`You own a similar piece: ${piece.matchedClosetItem.title}. Tap to view and rate.`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setSheetPiece({ item: piece.matchedClosetItem!, suggestion: piece.value })}
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
          <PrimaryButton
            label="Continue to selfie check"
            onPress={() =>
              router.push({
                pathname: '/selfie-review',
                params: {
                  requestId: stableParams.requestId,
                  tier: liveRecommendation.tier,
                  outfitTitle: liveRecommendation.title,
                  anchorItemDescription: requestInput?.anchorItemDescription,
                  sketchImageUrl: liveRecommendation.sketchImageUrl ?? '',
                },
              })
            }
          />
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
            onThumbsUp={
              currentItem
                ? () => handleMatchThumbsUp(stableParams.tier, sheetPiece.suggestion, currentItem.id, liveRecommendation.title)
                : undefined
            }
            onThumbsDown={
              currentItem
                ? () => handleMatchThumbsDown(stableParams.tier, sheetPiece.suggestion, currentItem.id, liveRecommendation.title)
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

// ── Piece list construction ────────────────────────────────────────────────────

type LabeledPiece = {
  label: string;
  value: string;
  matchedClosetItem: ClosetItem | null;
};

function resolveMatch(
  suggestion: string,
  closetItems: ClosetItem[],
  matchMap: Record<string, ClosetItem | null | false>
): ClosetItem | null {
  if (Object.prototype.hasOwnProperty.call(matchMap, suggestion)) {
    const entry = matchMap[suggestion];
    // false = rematch explicitly exhausted all candidates — do not fall back to local scoring
    if (entry === false) return null;
    if (entry) {
      if (isClosetMatchValid(suggestion, entry)) return entry;
      return findBestClosetMatch(suggestion, closetItems);
    }
    // LLM returned null — run local scoring as safety net
    return findBestClosetMatch(suggestion, closetItems);
  }
  // matchMap not yet populated — fall back to local scoring while LLM loads
  return findBestClosetMatch(suggestion, closetItems);
}

function buildPiecesToCheck(
  recommendation: LookRecommendation,
  closetItems: ClosetItem[],
  matchMap: Record<string, ClosetItem | null | false>
): LabeledPiece[] {
  const rows = recommendation.keyPieces.map((piece, index) => ({
    label: labelForKeyPiece(piece, index),
    value: piece,
    matchedClosetItem: resolveMatch(piece, closetItems, matchMap),
  }));

  recommendation.shoes.forEach((shoe, index) => {
    rows.push({
      label: index === 0 ? 'Shoes' : `Shoe ${index + 1}`,
      value: shoe,
      matchedClosetItem: resolveMatch(shoe, closetItems, matchMap),
    });
  });

  recommendation.accessories.forEach((accessory, index) => {
    rows.push({
      label: `Accessory ${index + 1}`,
      value: accessory,
      matchedClosetItem: resolveMatch(accessory, closetItems, matchMap),
    });
  });

  return rows;
}

function labelForKeyPiece(piece: string, index: number) {
  const normalized = piece.toLowerCase();

  if (/(suit)/.test(normalized)) return 'Suit';
  if (/(blazer|jacket|coat|topcoat|overshirt|chore)/.test(normalized)) return 'Outerwear';
  if (/(shirt|tee|t-shirt|polo|crewneck|sweater|knit|cardigan|hoodie)/.test(normalized)) return 'Top';
  if (/(trouser|pant|pants|jean|denim)/.test(normalized)) return 'Pants';
  if (/(shorts)/.test(normalized)) return 'Shorts';

  return `Piece ${index + 1}`;
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
