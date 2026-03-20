import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LookResultCard } from '@/components/cards/look-result-card';
import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { SectionHeader } from '@/components/ui/section-header';
import { useToast } from '@/components/ui/toast-provider';
import { spacing, theme } from '@/constants/theme';
import { buildSavedOutfitId, loadSavedOutfits, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay, getNextSevenDays, loadWeekPlan } from '@/lib/week-plan-storage';
import { buildTierHref, parseLookInput } from '@/lib/look-route';
import type { GenerateOutfitsResponse } from '@/types/api';
import { outfitsService } from '@/services/outfits';
import type { LookTierSlug } from '@/types/look-request';
import type { WeekPlannedOutfit } from '@/types/style';

export default function ResultDetailsScreen() {
  const params = useLocalSearchParams<{
    requestId: string;
    anchorItems?: string;
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
    weatherTemperatureC?: string;
    weatherApparentTemperatureC?: string;
    weatherCode?: string;
    weatherSeason?: string;
    weatherSummary?: string;
    weatherStylingHint?: string;
    weatherLocationLabel?: string;
    weatherFetchedAt?: string;
  }>();
  const [response, setResponse] = useState<GenerateOutfitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingTier, setRegeneratingTier] = useState<LookTierSlug | null>(null);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingTier, setSavingTier] = useState<LookTierSlug | null>(null);
  const [weekPickerTier, setWeekPickerTier] = useState<LookTierSlug | null>(null);
  const { showToast } = useToast();
  const parsedInput = useMemo(
    () =>
      parseLookInput({
        anchorItemDescription: params.anchorItemDescription,
        anchorItems: params.anchorItems,
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
      params.anchorItems,
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
          messages={[
            'Tailoring your next great outfit.',
            'Pressing lapels and polishing loafers.',
            'Arguing softly with the imaginary stylist in Milan.',
            'Checking whether this deserves a compliment at dinner.',
            'Steaming the lookbook and adjusting the hem.',
            'Making sure the outfit says effortless, not accidental.',
            'Deciding how much swagger is appropriate here.',
          ]}
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
          <PrimaryButton label="Retry" onPress={retryLoad} variant="secondary" />
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
            isRegenerating={regeneratingTier === recommendation.tier}
            isSaved={savedOutfitIds.includes(buildSavedOutfitId(response.requestId, recommendation.tier))}
            isSaving={savingTier === recommendation.tier}
            onSave={() => void handleSave(recommendation.tier)}
            onAddToWeek={() => setWeekPickerTier(recommendation.tier)}
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
      <WeekPickerModal
        visible={Boolean(weekPickerTier)}
        onClose={() => setWeekPickerTier(null)}
        onSelectDay={handleAssignToWeek}
      />
    </AppScreen>
  );
}

function WeekPickerModal({
  visible,
  onClose,
  onSelectDay,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectDay: (dayKey: string, dayLabel: string) => void;
}) {
  const days = getNextSevenDays();
  const [assignedDays, setAssignedDays] = useState<WeekPlannedOutfit[]>([]);
  const [replacementCandidate, setReplacementCandidate] = useState<WeekPlannedOutfit | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateWeekPlan() {
      const items = await loadWeekPlan();

      if (isMounted) {
        setAssignedDays(items);
      }
    }

    if (visible) {
      void hydrateWeekPlan();
      setReplacementCandidate(null);
    }

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const activeAssignment = replacementCandidate
    ? assignedDays.find((item) => item.dayKey === replacementCandidate.dayKey) ?? replacementCandidate
    : null;

  function handleDayPress(dayKey: string, dayLabel: string) {
    const existingAssignment = assignedDays.find((item) => item.dayKey === dayKey);

    if (existingAssignment) {
      setReplacementCandidate(existingAssignment);
      return;
    }

    onSelectDay(dayKey, dayLabel);
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(24, 18, 14, 0.24)',
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: '#FFFDFC',
            borderRadius: 28,
            gap: spacing.md,
            maxWidth: 420,
            padding: spacing.lg,
            width: '100%',
          }}>
          {activeAssignment ? (
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Replace planned outfit?"
                subtitle="There's already an outfit assigned to that day. Are you sure you want to replace it?"
              />
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 22,
                  borderWidth: 1,
                  gap: spacing.md,
                  padding: spacing.md,
                }}>
                <AppText variant="sectionTitle">{activeAssignment.dayLabel}</AppText>
                {activeAssignment.recommendation.sketchImageUrl ? (
                  <RemoteImagePanel
                    uri={activeAssignment.recommendation.sketchImageUrl}
                    aspectRatio={4 / 5}
                    minHeight={180}
                    fallbackTitle="Sketch unavailable"
                    fallbackMessage="The assigned illustration could not be displayed."
                  />
                ) : null}
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="sectionTitle">{activeAssignment.recommendation.title}</AppText>
                  <AppText tone="muted">{formatTierLabel(activeAssignment.recommendation.tier)}</AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PrimaryButton
                  label="No"
                  onPress={() => setReplacementCandidate(null)}
                  style={{ flex: 1 }}
                  variant="secondary"
                />
                <PrimaryButton
                  label="Yes"
                  onPress={() => onSelectDay(activeAssignment.dayKey, activeAssignment.dayLabel)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <>
              <SectionHeader title="Add to week" subtitle="Choose one of the next 7 days." />
              {days.map((day) => {
                const existingAssignment = assignedDays.find((item) => item.dayKey === day.dayKey);
                const isAssigned = Boolean(existingAssignment);

                return (
                  <Pressable
                    key={day.dayKey}
                    onPress={() => handleDayPress(day.dayKey, day.dayLabel)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: 999,
                      borderWidth: 1,
                      flexDirection: 'row',
                      gap: spacing.sm,
                      justifyContent: 'space-between',
                      minHeight: 54,
                      paddingHorizontal: spacing.lg,
                    }}>
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                      <Ionicons
                        color={isAssigned ? theme.colors.accent : theme.colors.subtleText}
                        name={isAssigned ? 'calendar' : 'ellipse-outline'}
                        size={18}
                      />
                      <AppText>{day.dayLabel}</AppText>
                    </View>
                    <AppText tone="muted">{isAssigned ? 'Assigned' : 'Open'}</AppText>
                  </Pressable>
                );
              })}
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatTierLabel(tier: LookTierSlug) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
