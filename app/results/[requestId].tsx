import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { LookResultCard } from '@/components/cards/look-result-card';
import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing } from '@/constants/theme';
import { buildTierHref, parseLookInput } from '@/lib/look-route';
import type { GenerateOutfitsResponse } from '@/types/api';
import { outfitsService } from '@/services/outfits';
import type { LookTierSlug } from '@/types/look-request';

export default function ResultDetailsScreen() {
  const params = useLocalSearchParams<{
    requestId: string;
    anchorItemDescription?: string;
    photoPending?: string;
    tiers?: string;
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
  }>();
  const [response, setResponse] = useState<GenerateOutfitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingTier, setRegeneratingTier] = useState<LookTierSlug | null>(null);
  const parsedInput = useMemo(
    () =>
      parseLookInput({
        anchorItemDescription: params.anchorItemDescription,
        photoPending: params.photoPending,
        tiers: params.tiers,
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
      }),
    [
      params.anchorImageFileName,
      params.anchorImageHeight,
      params.anchorImageMimeType,
      params.anchorImageUri,
      params.anchorImageWidth,
      params.anchorItemDescription,
      params.photoPending,
      params.tiers,
      params.uploadedAnchorImageCategory,
      params.uploadedAnchorImageId,
      params.uploadedAnchorImageOriginalFilename,
      params.uploadedAnchorImagePublicUrl,
      params.uploadedAnchorImageSizeBytes,
      params.uploadedAnchorImageStorageKey,
      params.uploadedAnchorImageStorageProvider,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadResponse() {
      if (!params.requestId) {
        setIsLoading(false);
        setErrorMessage('Missing request id.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const serviceResponse = parsedInput
        ? await outfitsService.generateOutfits({
            ...parsedInput,
            requestId: params.requestId,
          })
        : await outfitsService.getOutfitResult(params.requestId);

      if (!isMounted) {
        return;
      }

      if (!serviceResponse.success || !serviceResponse.data) {
        setErrorMessage(serviceResponse.error?.message ?? 'Failed to load outfit results.');
        setResponse(null);
      } else {
        setResponse(serviceResponse.data);
      }

      setIsLoading(false);
    }

    void loadResponse();

    return () => {
      isMounted = false;
    };
  }, [params.requestId, parsedInput]);

  useEffect(() => {
    if (!response?.requestId || !response.recommendations.some((item) => item.sketchStatus === 'pending')) {
      return;
    }

    const interval = setInterval(async () => {
      const serviceResponse = await outfitsService.getOutfitResult(response.requestId);

      if (serviceResponse.success && serviceResponse.data) {
        setResponse(serviceResponse.data);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [response]);

  async function retryLoad() {
    if (!params.requestId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const serviceResponse = parsedInput
      ? await outfitsService.generateOutfits({
          ...parsedInput,
          requestId: params.requestId,
        })
      : await outfitsService.getOutfitResult(params.requestId);

    if (!serviceResponse.success || !serviceResponse.data) {
      setErrorMessage(serviceResponse.error?.message ?? 'Failed to load outfit results.');
      setResponse(null);
    } else {
      setResponse(serviceResponse.data);
    }

    setIsLoading(false);
  }

  async function handleRegenerate(tier: LookTierSlug) {
    if (!response) {
      return;
    }

    setRegeneratingTier(tier);
    setErrorMessage(null);

    const serviceResponse = await outfitsService.regenerateTier(response.requestId, tier);

    if (!serviceResponse.success || !serviceResponse.data) {
      setErrorMessage(serviceResponse.error?.message ?? 'Failed to regenerate this tier.');
    } else {
      setResponse(serviceResponse.data);
    }

    setRegeneratingTier(null);
  }

  if (isLoading) {
    return (
      <AppScreen>
        <LoadingState
          label="Generating outfit options..."
          messages={[
            'Building your selected looks.',
            'Shaping the outfit direction.',
            'Finalizing your recommendations.',
          ]}
        />
      </AppScreen>
    );
  }

  if (!response) {
    return (
      <AppScreen>
        <View style={{ gap: spacing.md }}>
          <ErrorState
            title="Result not found"
            message={errorMessage ?? 'The app could not load outfit results for this request.'}
            actionLabel="Go to history"
            actionHref="/(app)/history"
          />
          <PrimaryButton label="Retry" onPress={retryLoad} variant="secondary" />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          title="Outfit results"
          subtitle="Styling directions built from the same anchor item."
        />
        <LookRequestReviewCard input={response.input} />
        {response.recommendations.map((recommendation) => (
          <LookResultCard
            key={`${recommendation.tier}-${recommendation.title}`}
            recommendation={recommendation}
            onRegenerate={() => void handleRegenerate(recommendation.tier)}
            isRegenerating={regeneratingTier === recommendation.tier}
            detailHref={buildTierHref(
              recommendation.tier,
              response.requestId,
              response.input,
              recommendation,
              0
            )}
          />
        ))}
      </View>
    </AppScreen>
  );
}
