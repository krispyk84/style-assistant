import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
import { spacing, theme } from '@/constants/theme';
import { buildSavedOutfitId } from '@/lib/saved-outfits-storage';
import { buildTierHref, type LookRouteParams } from '@/lib/look-route';
import { LOOK_TIER_OPTIONS } from '@/types/look-request';
import { formatTierLabel } from '@/lib/outfit-utils';

import { useResultsData } from './useResultsData';
import { useResultsPolling } from './useResultsPolling';
import { useResultsMatchFeedback } from './useResultsMatchFeedback';
import { useResultsActions } from './useResultsActions';

export default function ResultDetailsScreen() {
  const params = useLocalSearchParams<LookRouteParams & { requestId: string }>();
  const routeKey = JSON.stringify(params);
  const stableParams = useMemo(() => JSON.parse(routeKey) as LookRouteParams & { requestId: string }, [routeKey]);

  const {
    response,
    setResponse,
    isLoading,
    loadingTiers,
    errorMessage,
    setErrorMessage,
    regeneratingTiers,
    setRegeneratingTiers,
    regeneratingTiersRef,
    tierGenerations,
    setTierGenerations,
    parsedInput,
    handleCancelGeneration,
    handleRetry,
  } = useResultsData(stableParams);

  useResultsPolling({ response, loadingTiers, regeneratingTiersRef, setResponse });

  const {
    closetItems,
    matchMap,
    matchFeedbackMap,
    regeneratingMatches,
    handleMatchThumbsUp,
    handleMatchThumbsDown,
  } = useResultsMatchFeedback(stableParams.requestId ?? '', response);

  const {
    savedOutfitIds,
    savingTier,
    weekPickerTier,
    setWeekPickerTier,
    secondOpinionTier,
    setSecondOpinionTier,
    outfitFeedbackMap,
    handleRegenerate,
    handleSave,
    handleAssignToWeek,
    handleOutfitFeedback,
  } = useResultsActions({
    response,
    setResponse,
    tierGenerations,
    setTierGenerations,
    setRegeneratingTiers,
    setErrorMessage,
  });

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
            onPress={handleRetry}
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
        {LOOK_TIER_OPTIONS.filter((tier) => response.input.selectedTiers.includes(tier)).map((tier) => {
          const recommendation = response.recommendations.find((r) => r.tier === tier);
          if (!recommendation) {
            // Tier is still being generated — show a loading placeholder.
            return <LoadingState key={tier} label={formatTierLabel(tier)} />;
          }
          return (
            <LookResultCard
              key={`${recommendation.tier}-${recommendation.title}`}
              recommendation={recommendation}
              isSaved={savedOutfitIds.includes(buildSavedOutfitId(response.requestId, recommendation.tier, tierGenerations[recommendation.tier] ?? 0))}
              isSaving={savingTier === recommendation.tier}
              onSave={() => void handleSave(recommendation.tier)}
              onAddToWeek={() => setWeekPickerTier(recommendation.tier)}
              onSecondOpinion={() => setSecondOpinionTier(recommendation.tier)}
              outfitFeedback={outfitFeedbackMap[recommendation.tier] ?? null}
              onOutfitFeedback={(thumb) => void handleOutfitFeedback(recommendation.tier, thumb)}
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
                recommendation,
              )}
            />
          );
        })}
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
