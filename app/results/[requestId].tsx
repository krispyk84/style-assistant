import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { LookResultCard } from '@/components/cards/look-result-card';
import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState, extendedFashionLoadingMessages } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { WeekPickerModal } from '@/components/week/week-picker-modal';
import { useToast } from '@/components/ui/toast-provider';
import { spacing } from '@/constants/theme';
import { buildSavedOutfitId, loadSavedOutfits, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import { buildTierHref, parseLookInput, type LookRouteParams } from '@/lib/look-route';
import type { GenerateOutfitsResponse } from '@/types/api';
import { outfitsService } from '@/services/outfits';
import type { LookTierSlug } from '@/types/look-request';

export default function ResultDetailsScreen() {
  const params = useLocalSearchParams<LookRouteParams & { requestId: string }>();
  const routeKey = JSON.stringify(params);
  const stableParams = useMemo(() => JSON.parse(routeKey) as LookRouteParams & { requestId: string }, [routeKey]);
  const [response, setResponse] = useState<GenerateOutfitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingTiers, setRegeneratingTiers] = useState<LookTierSlug[]>([]);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingTier, setSavingTier] = useState<LookTierSlug | null>(null);
  const [weekPickerTier, setWeekPickerTier] = useState<LookTierSlug | null>(null);
  const { showToast } = useToast();
  const parsedInput = useMemo(() => parseLookInput(stableParams), [stableParams]);

  async function fetchOutfits(requestId: string, input: typeof parsedInput) {
    setIsLoading(true);
    setErrorMessage(null);

    const serviceResponse = input
      ? await outfitsService.generateOutfits({ ...input, requestId })
      : await outfitsService.getOutfitResult(requestId);

    if (!serviceResponse.success || !serviceResponse.data) {
      setErrorMessage(serviceResponse.error?.message ?? 'Failed to load outfit results.');
      setResponse(null);
    } else {
      setResponse(serviceResponse.data);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    if (!stableParams.requestId) {
      setIsLoading(false);
      setErrorMessage('Missing request id.');
      return;
    }

    void fetchOutfits(stableParams.requestId, parsedInput);
  // fetchOutfits is stable within the effect — deps are the actual inputs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableParams.requestId, parsedInput]);

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

  useEffect(() => {
    let isMounted = true;

    async function loadSavedState() {
      const savedOutfits = await loadSavedOutfits();

      if (!isMounted) {
        return;
      }

      setSavedOutfitIds(savedOutfits.map((item) => item.id));
    }

    void loadSavedState();

    return () => {
      isMounted = false;
    };
  }, [response?.requestId]);

  async function handleRegenerate(tier: LookTierSlug) {
    if (!response) {
      return;
    }

    setRegeneratingTiers((current) => (current.includes(tier) ? current : [...current, tier]));
    setErrorMessage(null);
    setResponse((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.map((item) =>
              item.tier === tier
                ? {
                    ...item,
                    sketchStatus: 'pending',
                    sketchImageUrl: null,
                  }
                : item
            ),
          }
        : current
    );

    const serviceResponse = await outfitsService.regenerateTier(response.requestId, tier);

    if (!serviceResponse.success || !serviceResponse.data) {
      setErrorMessage(serviceResponse.error?.message ?? 'Failed to regenerate this tier.');
    } else {
      const latestResponse = await outfitsService.getOutfitResult(response.requestId);
      setResponse(latestResponse.success && latestResponse.data ? latestResponse.data : serviceResponse.data);
    }

    setRegeneratingTiers((current) => current.filter((item) => item !== tier));
  }

  async function handleSave(tier: LookTierSlug) {
    if (!response) {
      return;
    }

    const recommendation = response.recommendations.find((item) => item.tier === tier);
    if (!recommendation) {
      return;
    }

    const savedOutfitId = buildSavedOutfitId(response.requestId, tier);
    if (savedOutfitIds.includes(savedOutfitId)) {
      return;
    }

    setSavingTier(tier);

    try {
      await saveSavedOutfit(response.input, recommendation, response.requestId);
      setSavedOutfitIds((current) => [...current, savedOutfitId]);
      showToast('Outfit saved to history.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }

    setSavingTier(null);
  }

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!response || !weekPickerTier) {
      return;
    }

    const recommendation = response.recommendations.find((item) => item.tier === weekPickerTier);
    if (!recommendation) {
      return;
    }

    try {
      await assignOutfitToWeekDay(dayKey, dayLabel, response.input, recommendation, response.requestId);
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }

    setWeekPickerTier(null);
  }

  if (isLoading) {
    return (
      <AppScreen topInset={false}>
        <LoadingState
          label="Generating outfit options..."
          messages={extendedFashionLoadingMessages}
        />
      </AppScreen>
    );
  }

  if (!response) {
    return (
      <AppScreen topInset={false}>
        <View style={{ gap: spacing.md }}>
          <ErrorState
            title="Result not found"
            message={errorMessage ?? 'The app could not load outfit results for this request.'}
            actionLabel="Go to history"
            actionHref="/(app)/history"
          />
          <PrimaryButton
            label="Retry"
            onPress={() => stableParams.requestId ? void fetchOutfits(stableParams.requestId, parsedInput) : undefined}
            variant="secondary"
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable topInset={false}>
      <View style={{ gap: spacing.lg, marginTop: -spacing.sm }}>
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
            isRegenerating={regeneratingTiers.includes(recommendation.tier)}
            isSaved={savedOutfitIds.includes(buildSavedOutfitId(response.requestId, recommendation.tier))}
            isSaving={savingTier === recommendation.tier}
            onSave={() => void handleSave(recommendation.tier)}
            onAddToWeek={() => setWeekPickerTier(recommendation.tier)}
            detailHref={buildTierHref(
              recommendation.tier,
              response.requestId,
              response.input,
              recommendation
            )}
          />
        ))}
      </View>
      <WeekPickerModal
        visible={Boolean(weekPickerTier)}
        onClose={() => setWeekPickerTier(null)}
        onSelectDay={handleAssignToWeek}
      />
    </AppScreen>
  );
}
