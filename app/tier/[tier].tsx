import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { LookTierDetailCard } from '@/components/cards/look-tier-detail-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import { getLookTierDefinition } from '@/lib/look-mock-data';
import { parseLookInput, parseLookRecommendation, type LookRouteParams } from '@/lib/look-route';
import type { LookRecommendation } from '@/types/look-request';
import { outfitsService } from '@/services/outfits';

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
  // liveRecommendation starts from URL params and is updated by the sketch-polling effect
  const [liveRecommendation, setLiveRecommendation] = useState<LookRecommendation | null>(initialRecommendation);

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

  if (!matchedTier || !liveRecommendation) {
    return (
      <AppScreen>
        <ErrorState
          title="Tier not found"
          message="Open tier details from a generated look so the route carries the selected recommendation."
          actionLabel="Create a look"
          actionHref="/(app)/create-look"
        />
      </AppScreen>
    );
  }

  const piecesToCheck = buildPiecesToCheck(liveRecommendation);

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title={matchedTier.label} showBack />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">{matchedTier.label}</AppText>
          <AppText tone="muted">{matchedTier.shortDescription}</AppText>
        </View>
        <LookTierDetailCard definition={matchedTier} recommendation={liveRecommendation} />
        <View style={{ gap: spacing.md }}>
          <AppText variant="sectionTitle">Check recommended pieces</AppText>
          <AppText tone="muted">
            Compare the pieces you own against this exact recommendation. You can check any items you want before moving to the selfie review.
          </AppText>
          {piecesToCheck.map((piece) => (
            <Link
              key={`${piece.label}-${piece.value}`}
              href={{
                pathname: '/check-piece',
                params: {
                  requestId: stableParams.requestId,
                  tier: liveRecommendation.tier,
                  outfitTitle: liveRecommendation.title,
                  anchorItemDescription: requestInput?.anchorItemDescription,
                  pieceName: piece.value,
                },
              }}
              asChild>
              <Pressable style={pieceRowStyle}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="sectionTitle">{piece.label}</AppText>
                  <AppText tone="muted">{piece.value}</AppText>
                </View>
                <Ionicons color={theme.colors.text} name="camera-outline" size={22} />
              </Pressable>
            </Link>
          ))}
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
    </AppScreen>
  );
}

function buildPiecesToCheck(recommendation: LookRecommendation) {
  const rows = recommendation.keyPieces.map((piece, index) => ({
    label: labelForKeyPiece(piece, index),
    value: piece,
  }));

  recommendation.shoes.forEach((shoe, index) => {
    rows.push({
      label: index === 0 ? 'Shoes' : `Shoe ${index + 1}`,
      value: shoe,
    });
  });

  recommendation.accessories.forEach((accessory, index) => {
    rows.push({
      label: `Accessory ${index + 1}`,
      value: accessory,
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
