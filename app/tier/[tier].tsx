import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { LookTierDetailCard } from '@/components/cards/look-tier-detail-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { getLookTierDefinition } from '@/lib/look-mock-data';
import { parseLookInput, parseLookRecommendation } from '@/lib/look-route';
import type { LookRecommendation } from '@/types/look-request';
import { outfitsService } from '@/services/outfits';

export default function TierScreen() {
  const params = useLocalSearchParams<{
    tier: string;
    requestId?: string;
    anchorItemDescription?: string;
    photoPending?: string;
    anchorImageUri?: string;
    anchorImageWidth?: string;
    anchorImageHeight?: string;
    anchorImageFileName?: string;
    anchorImageMimeType?: string;
    uploadedAnchorImageId?: string;
    uploadedAnchorImageCategory?: string;
    uploadedAnchorImageStorageProvider?: string;
    uploadedAnchorImageStorageKey?: string;
    uploadedAnchorImagePublicUrl?: string;
    uploadedAnchorImageOriginalFilename?: string;
    uploadedAnchorImageSizeBytes?: string;
    weatherTemperatureC?: string;
    weatherApparentTemperatureC?: string;
    weatherCode?: string;
    weatherSeason?: string;
    weatherSummary?: string;
    weatherStylingHint?: string;
    weatherLocationLabel?: string;
    weatherFetchedAt?: string;
    recommendationTitle?: string;
    recommendationAnchorItem?: string;
    recommendationKeyPieces?: string;
    recommendationShoes?: string;
    recommendationAccessories?: string;
    recommendationFitNotes?: string;
    recommendationWhyItWorks?: string;
    recommendationStylingDirection?: string;
    recommendationDetailNotes?: string;
    recommendationSketchStatus?: string;
    recommendationSketchImageUrl?: string;
    recommendationSketchStorageKey?: string;
    recommendationSketchMimeType?: string;
    variantIndex?: string;
  }>();
  const matchedTier = params.tier ? getLookTierDefinition(params.tier) : undefined;
  const [liveRecommendation, setLiveRecommendation] = useState<LookRecommendation | null>(null);

  const requestInput = useMemo(
    () =>
      parseLookInput({
        anchorItemDescription: params.anchorItemDescription,
        photoPending: params.photoPending,
        tiers: 'business,smart-casual,casual',
        anchorImageUri: params.anchorImageUri,
        anchorImageWidth: params.anchorImageWidth,
        anchorImageHeight: params.anchorImageHeight,
        anchorImageFileName: params.anchorImageFileName,
        anchorImageMimeType: params.anchorImageMimeType,
        uploadedAnchorImageId: params.uploadedAnchorImageId,
        uploadedAnchorImageCategory: params.uploadedAnchorImageCategory,
        uploadedAnchorImageStorageProvider: params.uploadedAnchorImageStorageProvider,
        uploadedAnchorImageStorageKey: params.uploadedAnchorImageStorageKey,
        uploadedAnchorImagePublicUrl: params.uploadedAnchorImagePublicUrl,
        uploadedAnchorImageOriginalFilename: params.uploadedAnchorImageOriginalFilename,
        uploadedAnchorImageSizeBytes: params.uploadedAnchorImageSizeBytes,
        weatherTemperatureC: params.weatherTemperatureC,
        weatherApparentTemperatureC: params.weatherApparentTemperatureC,
        weatherCode: params.weatherCode,
        weatherSeason: params.weatherSeason,
        weatherSummary: params.weatherSummary,
        weatherStylingHint: params.weatherStylingHint,
        weatherLocationLabel: params.weatherLocationLabel,
        weatherFetchedAt: params.weatherFetchedAt,
      }),
    [
      params.anchorImageFileName,
      params.anchorImageHeight,
      params.anchorImageMimeType,
      params.anchorImageUri,
      params.anchorImageWidth,
      params.anchorItemDescription,
      params.photoPending,
      params.uploadedAnchorImageCategory,
      params.uploadedAnchorImageId,
      params.uploadedAnchorImageOriginalFilename,
      params.uploadedAnchorImagePublicUrl,
      params.uploadedAnchorImageSizeBytes,
      params.uploadedAnchorImageStorageKey,
      params.uploadedAnchorImageStorageProvider,
      params.weatherApparentTemperatureC,
      params.weatherCode,
      params.weatherFetchedAt,
      params.weatherLocationLabel,
      params.weatherSeason,
      params.weatherStylingHint,
      params.weatherSummary,
      params.weatherTemperatureC,
    ]
  );
  const recommendation = useMemo(
    () =>
      parseLookRecommendation({
        tier: params.tier,
        recommendationTitle: params.recommendationTitle,
        recommendationAnchorItem: params.recommendationAnchorItem,
        recommendationKeyPieces: params.recommendationKeyPieces,
        recommendationShoes: params.recommendationShoes,
        recommendationAccessories: params.recommendationAccessories,
        recommendationFitNotes: params.recommendationFitNotes,
        recommendationWhyItWorks: params.recommendationWhyItWorks,
        recommendationStylingDirection: params.recommendationStylingDirection,
        recommendationDetailNotes: params.recommendationDetailNotes,
        recommendationSketchStatus: params.recommendationSketchStatus,
        recommendationSketchImageUrl: params.recommendationSketchImageUrl,
        recommendationSketchStorageKey: params.recommendationSketchStorageKey,
        recommendationSketchMimeType: params.recommendationSketchMimeType,
      }),
    [
      params.recommendationAccessories,
      params.recommendationAnchorItem,
      params.recommendationDetailNotes,
      params.recommendationFitNotes,
      params.recommendationKeyPieces,
      params.recommendationSketchImageUrl,
      params.recommendationSketchMimeType,
      params.recommendationSketchStatus,
      params.recommendationSketchStorageKey,
      params.recommendationShoes,
      params.recommendationStylingDirection,
      params.recommendationTitle,
      params.recommendationWhyItWorks,
      params.tier,
    ]
  );

  useEffect(() => {
    setLiveRecommendation(recommendation);
  }, [recommendation]);

  useEffect(() => {
    const requestId = params.requestId;
    const tier = params.tier;

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
  }, [liveRecommendation?.sketchStatus, params.requestId, params.tier]);

  if (!matchedTier || !liveRecommendation) {
    return (
      <AppScreen topInset={false}>
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
    <AppScreen scrollable topInset={false}>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader title={matchedTier.label} subtitle={matchedTier.shortDescription} />
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
                  requestId: params.requestId,
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
                  requestId: params.requestId,
                  tier: liveRecommendation.tier,
                  outfitTitle: liveRecommendation.title,
                  anchorItemDescription: requestInput?.anchorItemDescription,
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
