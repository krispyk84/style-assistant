import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';

import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import { findBestClosetMatch } from '@/lib/closet-match';
import type { OutfitPiece } from '@/types/look-request';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';

import { LookResultCard } from '@/components/cards/look-result-card';
import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState, extendedFashionLoadingMessages } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StylistChooserModal } from '@/components/second-opinion/stylist-chooser-modal';
import { WeekPickerModal } from '@/components/week/week-picker-modal';
import { useToast } from '@/components/ui/toast-provider';
import { spacing, theme } from '@/constants/theme';
import { incrementClosetItemCounter } from '@/lib/closet-storage';
import { buildSavedOutfitId, loadSavedOutfits, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import { buildTierHref, parseLookInput, type LookRouteParams } from '@/lib/look-route';
import type { GenerateOutfitsResponse } from '@/types/api';
import { outfitsService } from '@/services/outfits';
import { normalizePiece, type LookTierSlug } from '@/types/look-request';
import { useMatchFeedback } from '@/hooks/use-match-feedback';
import { useMatchSensitivity } from '@/hooks/use-match-sensitivity';
import {
  trackCreateLookCompleted,
  trackCreateLookFailed,
  trackClosetMatchShown,
  trackSaveOutfit,
  trackAddToWeek,
} from '@/lib/analytics';
import { recordError, log } from '@/lib/crashlytics';

export default function ResultDetailsScreen() {
  const params = useLocalSearchParams<LookRouteParams & { requestId: string }>();
  const routeKey = JSON.stringify(params);
  const stableParams = useMemo(() => JSON.parse(routeKey) as LookRouteParams & { requestId: string }, [routeKey]);
  const [response, setResponse] = useState<GenerateOutfitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingTiers, setRegeneratingTiers] = useState<LookTierSlug[]>([]);
  // Ref mirrors state so the sketch-poll callback always sees the current regenerating set
  // without needing to re-create the interval on every state change.
  const regeneratingTiersRef = useRef<LookTierSlug[]>([]);
  const [tierGenerations, setTierGenerations] = useState<Partial<Record<LookTierSlug, number>>>({});
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  // suggestion string → ClosetItem | null (LLM no match, fallback runs) | false (rematch exhausted, no fallback)
  const [matchMap, setMatchMap] = useState<Record<string, ClosetItem | null | false>>({});
  const [savingTier, setSavingTier] = useState<LookTierSlug | null>(null);
  const [weekPickerTier, setWeekPickerTier] = useState<LookTierSlug | null>(null);
  const [secondOpinionTier, setSecondOpinionTier] = useState<LookTierSlug | null>(null);
  // Stable across sketch-poll response updates (memoized on requestId only)
  const uniquePieces = useMemo((): OutfitPiece[] => {
    if (!response) return [];
    const allPieces = response.recommendations.flatMap((r) => [
      ...r.keyPieces,
      ...r.shoes,
      ...r.accessories,
    ]);
    const seen = new Set<string>();
    return allPieces
      .map((p) => normalizePiece(p))
      .filter((piece) => {
        if (seen.has(piece.display_name)) return false;
        seen.add(piece.display_name);
        return true;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response?.requestId]);

  const sensitivity = useMatchSensitivity();

  const { matchFeedbackMap, regeneratingMatches, handleMatchThumbsUp, handleMatchThumbsDown } =
    useMatchFeedback({
      requestId: stableParams.requestId ?? '',
      closetItems,
      pieces: uniquePieces,
      sensitivity,
      onSlotRematched: (suggestion, item) =>
        // null from rematch means all candidates exhausted → false sentinel prevents local-scoring fallback
        setMatchMap((prev) => ({ ...prev, [suggestion]: item ?? false })),
    });
  // Tracks which closet item IDs have already had matchedToRecommendationCount incremented
  const countedMatchedIdsRef = useRef<Set<string>>(new Set());
  const { showToast } = useToast();
  const parsedInput = useMemo(() => parseLookInput(stableParams), [stableParams]);

  // Closet-add modal: shown during loading when user ticked "save to closet" in the form.
  // Results are gated behind closetModalResolved so the user can fill the form in parallel.
  const shouldOfferClosetAdd = stableParams.addAnchorToCloset === 'true';
  const [closetModalVisible, setClosetModalVisible] = useState(shouldOfferClosetAdd);
  const [closetModalResolved, setClosetModalResolved] = useState(!shouldOfferClosetAdd);
  const [anchorAddedToCloset, setAnchorAddedToCloset] = useState(false);

  function handleClosetModalClose() {
    setClosetModalVisible(false);
    setClosetModalResolved(true);
  }

  const [addToClosetModalVisible, setAddToClosetModalVisible] = useState(false);

  async function fetchOutfits(requestId: string, input: typeof parsedInput) {
    setIsLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    generateAbortRef.current = controller;

    const serviceResponse = input
      ? await outfitsService.generateOutfits({ ...input, requestId }, { signal: controller.signal })
      : await outfitsService.getOutfitResult(requestId);

    generateAbortRef.current = null;

    // If the user cancelled, don't update state — navigation back is already handled.
    if (controller.signal.aborted) return;

    if (!serviceResponse.success || !serviceResponse.data) {
      setErrorMessage(serviceResponse.error?.message ?? 'Failed to load outfit results.');
      setResponse(null);
      if (input) {
        // Only track failure for generation requests, not re-fetches of existing results
        trackCreateLookFailed({ error: serviceResponse.error?.code });
        recordError(
          new Error(serviceResponse.error?.message ?? 'Outfit generation failed'),
          'create_look_generation'
        );
      }
    } else {
      setResponse(serviceResponse.data);
      if (input) {
        trackCreateLookCompleted({ tier_count: serviceResponse.data.recommendations.length });
        log(`Look generated: ${requestId} (${serviceResponse.data.recommendations.length} tiers)`);
      }
    }

    setIsLoading(false);
  }

  function handleCancelGeneration() {
    generateAbortRef.current?.abort();
    router.back();
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

  const generateAbortRef = useRef<AbortController | null>(null);

  // Keep screen awake during the initial generation so the loading state stays visible.
  useEffect(() => {
    if (isLoading) {
      void activateKeepAwakeAsync();
    } else {
      void deactivateKeepAwakeAsync();
    }
    return () => { void deactivateKeepAwakeAsync(); };
  }, [isLoading]);

  // Keep ref in sync so the poll closure always reads the current set without re-creating the interval.
  useEffect(() => {
    regeneratingTiersRef.current = regeneratingTiers;
  }, [regeneratingTiers]);

  useEffect(() => {
    if (!response?.requestId || !response.recommendations.some((item) => item.sketchStatus === 'pending')) {
      return;
    }

    const interval = setInterval(async () => {
      const serviceResponse = await outfitsService.getOutfitResult(response.requestId);

      if (serviceResponse.success && serviceResponse.data) {
        setResponse((current) => {
          if (!current || !serviceResponse.data) return current;
          const protecting = regeneratingTiersRef.current;
          // If no tiers are mid-regeneration, apply the full server response as-is.
          if (protecting.length === 0) return serviceResponse.data;
          // Otherwise preserve the in-flight state for any tier currently being regenerated
          // so stale server data doesn't overwrite a pending regeneration.
          return {
            ...serviceResponse.data,
            recommendations: serviceResponse.data.recommendations.map((newRec) =>
              protecting.includes(newRec.tier)
                ? (current.recommendations.find((r) => r.tier === newRec.tier) ?? newRec)
                : newRec
            ),
          };
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [response]);

  // Load closet items once on mount so matching runs against current wardrobe
  useEffect(() => {
    void closetService.getItems().then((response) => {
      if (response.success && response.data) {
        setClosetItems(response.data.items);
      }
    });
  }, []);

  // Once both outfit response and closet items are ready, run local deterministic matching
  useEffect(() => {
    if (!uniquePieces.length || !closetItems.length) return;

    const resolved: Record<string, ClosetItem | null> = {};
    const newlyMatchedIds: string[] = [];

    for (const piece of uniquePieces) {
      const item = findBestClosetMatch(piece, closetItems, undefined, sensitivity);
      resolved[piece.display_name] = item;
      if (item && !countedMatchedIdsRef.current.has(item.id)) {
        countedMatchedIdsRef.current.add(item.id);
        newlyMatchedIds.push(item.id);
      }
    }

    setMatchMap(resolved);
    const matchCount = Object.values(resolved).filter(Boolean).length;
    if (matchCount > 0) {
      trackClosetMatchShown({ match_count: matchCount, tier: 'results' });
    }
    for (const id of newlyMatchedIds) {
      void incrementClosetItemCounter(id, 'matchedToRecommendationCount');
    }
  // uniquePieces is stable across sketch-poll updates (memoized on requestId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniquePieces, closetItems]);

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

    // Capture the current generation BEFORE incrementing so we can remove its save ID.
    const currentGen = tierGenerations[tier] ?? 0;
    const oldSaveId = buildSavedOutfitId(response.requestId, tier, currentGen);

    setTierGenerations((prev) => ({ ...prev, [tier]: currentGen + 1 }));
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
      // Remove the old generation's save marker — the regenerated outfit is a new entity.
      setSavedOutfitIds((current) => current.filter((id) => id !== oldSaveId));
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

    const savedOutfitId = buildSavedOutfitId(response.requestId, tier, tierGenerations[tier] ?? 0);
    if (savedOutfitIds.includes(savedOutfitId)) {
      return;
    }

    setSavingTier(tier);

    try {
      // Deep-copy the recommendation snapshot so later regenerations can't mutate what was saved.
      await saveSavedOutfit(response.input, { ...recommendation }, response.requestId, tierGenerations[tier] ?? 0);
      setSavedOutfitIds((current) => [...current, savedOutfitId]);
      trackSaveOutfit({ tier });
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
      await assignOutfitToWeekDay(dayKey, dayLabel, response.input, { ...recommendation }, response.requestId);
      trackAddToWeek({ tier: weekPickerTier, day_label: dayLabel });
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }

    setWeekPickerTier(null);
  }

  if (isLoading || !closetModalResolved) {
    return (
      <AppScreen>
        {parsedInput ? (
          <Pressable
            hitSlop={12}
            onPress={handleCancelGeneration}
            style={{ alignSelf: 'flex-start', paddingVertical: spacing.xs }}>
            <AppText tone="muted">Cancel</AppText>
          </Pressable>
        ) : null}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingState
            label="Generating outfit options..."
            messages={extendedFashionLoadingMessages}
          />
        </View>
        <SaveToClosetModal
          visible={closetModalVisible}
          uploadedImage={parsedInput?.uploadedAnchorImage ?? null}
          onClose={handleClosetModalClose}
          onSaved={() => { setAnchorAddedToCloset(true); handleClosetModalClose(); }}
          loadingContext
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
    <AppScreen scrollable floatingBack>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Outfit Results" showBack />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Your Looks</AppText>
          <AppText tone="muted">Styling directions built from the same anchor item.</AppText>
        </View>
        <LookRequestReviewCard
          input={response.input}
          hideInfoBox
          recommendations={response.recommendations}
        />
        {(() => {
          const upload = parsedInput?.uploadedAnchorImage ?? null;
          const canAdd =
            upload !== null &&
            upload.storageProvider !== 'closet-ref' &&
            !shouldOfferClosetAdd &&
            !anchorAddedToCloset;
          if (!canAdd) return null;
          return (
            <Pressable
              onPress={() => setAddToClosetModalVisible(true)}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: 'row',
                gap: spacing.sm,
                justifyContent: 'center',
                minHeight: 48,
                paddingHorizontal: spacing.md,
              }}>
              <View style={{ position: 'relative' }}>
                <Ionicons color={theme.colors.text} name="shirt-outline" size={18} />
                <View style={{ alignItems: 'center', backgroundColor: theme.colors.text, borderRadius: 999, height: 11, justifyContent: 'center', position: 'absolute', right: -3, top: -3, width: 11 }}>
                  <Ionicons color={theme.colors.background} name="add" size={8} />
                </View>
              </View>
              <AppText>Add anchor to closet</AppText>
            </Pressable>
          );
        })()}
        {response.recommendations.map((recommendation) => (
          <LookResultCard
            key={`${recommendation.tier}-${recommendation.title}`}
            recommendation={recommendation}
            onRegenerate={() => void handleRegenerate(recommendation.tier)}
            isRegenerating={regeneratingTiers.includes(recommendation.tier)}
            isSaved={savedOutfitIds.includes(buildSavedOutfitId(response.requestId, recommendation.tier, tierGenerations[recommendation.tier] ?? 0))}
            isSaving={savingTier === recommendation.tier}
            onSave={() => void handleSave(recommendation.tier)}
            onAddToWeek={() => setWeekPickerTier(recommendation.tier)}
            onSecondOpinion={() => setSecondOpinionTier(recommendation.tier)}
            onMatchThumbsUp={(suggestion, itemId) => handleMatchThumbsUp(recommendation.tier, suggestion, itemId, recommendation.title)}
            onMatchThumbsDown={(suggestion, itemId) => handleMatchThumbsDown(recommendation.tier, suggestion, itemId, recommendation.title)}
            matchFeedbackMap={matchFeedbackMap}
            regeneratingMatches={regeneratingMatches}
            closetItems={closetItems}
            matchMap={matchMap}
            anchorDescription={parsedInput?.anchorItemDescription ?? response.input.anchorItemDescription}
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
      {secondOpinionTier && response ? (
        <StylistChooserModal
          visible
          recommendation={response.recommendations.find((r) => r.tier === secondOpinionTier)!}
          onClose={() => setSecondOpinionTier(null)}
        />
      ) : null}
      <SaveToClosetModal
        visible={addToClosetModalVisible}
        uploadedImage={parsedInput?.uploadedAnchorImage ?? null}
        onClose={() => setAddToClosetModalVisible(false)}
        onSaved={() => { setAnchorAddedToCloset(true); setAddToClosetModalVisible(false); }}
      />
    </AppScreen>
  );
}
