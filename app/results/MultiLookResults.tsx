import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { LookResultCard } from '@/components/cards/look-result-card';
import { LookRequestReviewCard } from '@/components/cards/look-request-review-card';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState, extendedFashionLoadingMessages } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StylistChooserModal } from '@/components/second-opinion/stylist-chooser-modal';
import { WeekPickerModal } from '@/components/week/week-picker-modal';
import { spacing, theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useTrendiness } from '@/hooks/use-trendiness';
import { closetService } from '@/services/closet';
import { findBestClosetMatch } from '@/lib/closet-match';
import {
  buildSavedOutfitId,
  loadSavedOutfits,
  saveSavedOutfit,
} from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import {
  loadRecommendationFeedback,
  saveRecommendationFeedback,
} from '@/lib/recommendation-feedback-storage';
import { buildTierHref } from '@/lib/look-route';
import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse, VariationSummary } from '@/types/api';
import type { ClosetItem } from '@/types/closet';
import {
  normalizePiece,
  type CreateLookInput,
  type LookRecommendation,
  type LookTierSlug,
  type OutfitPiece,
} from '@/types/look-request';
import { useToast } from '@/components/ui/toast-provider';
import { trackSaveOutfit, trackAddToWeek } from '@/lib/analytics';

const SKETCH_POLL_INTERVAL_MS = 4000;

type SlotState = {
  requestId: string;
  response: GenerateOutfitsResponse | null;
  isLoading: boolean;
  isRegenerating: boolean;
  errorMessage: string | null;
  /** Summary of this slot's recommendation — populated once generation completes. */
  summary: VariationSummary | null;
  tierGeneration: number;
};

type MultiLookResultsProps = {
  primaryRequestId: string;
  variantRequestIds: string[];
  parsedInput: CreateLookInput;
  addAnchorToCloset: boolean;
};

function buildSummary(recommendation: LookRecommendation): VariationSummary {
  return {
    title: recommendation.title,
    stylingDirection: recommendation.stylingDirection,
    keyPieces: recommendation.keyPieces.map((piece) => normalizePiece(piece).display_name),
    shoes: recommendation.shoes.map((piece) => normalizePiece(piece).display_name),
    accessories: recommendation.accessories.map((piece) => normalizePiece(piece).display_name),
  };
}

export function MultiLookResults({
  primaryRequestId,
  variantRequestIds,
  parsedInput,
  addAnchorToCloset,
}: MultiLookResultsProps) {
  const trendiness = useTrendiness();
  const { showToast } = useToast();
  const { theme: themeCtx } = useTheme();

  // Single tier — guaranteed by the form gate, but defensively fall back to the first selected tier.
  const tier: LookTierSlug = parsedInput.selectedTiers[0] ?? 'casual';
  const totalLooks = 1 + variantRequestIds.length;

  // ── Slots ───────────────────────────────────────────────────────────────────
  const allRequestIds = useMemo(() => [primaryRequestId, ...variantRequestIds], [primaryRequestId, variantRequestIds]);
  const [slots, setSlots] = useState<SlotState[]>(() =>
    allRequestIds.map((requestId) => ({
      requestId,
      response: null,
      isLoading: true,
      isRegenerating: false,
      errorMessage: null,
      summary: null,
      tierGeneration: 0,
    })),
  );

  // ── Save state, week-picker, feedback, second-opinion ──────────────────────
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [weekPickerRequestId, setWeekPickerRequestId] = useState<string | null>(null);
  const [secondOpinionRequestId, setSecondOpinionRequestId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'love' | 'hate'>>({});

  // ── Closet items (shared across all variations) ────────────────────────────
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  useEffect(() => {
    void closetService.getItems().then((r) => {
      if (r.success && r.data) setClosetItems(r.data.items);
    });
  }, []);

  // ── Closet-add modal: shown during loading when user opted to save anchor ──
  const [closetModalVisible, setClosetModalVisible] = useState(addAnchorToCloset);
  const [closetModalResolved, setClosetModalResolved] = useState(!addAnchorToCloset);
  const [anchorAddedToCloset, setAnchorAddedToCloset] = useState(false);

  function handleClosetModalClose() {
    setClosetModalVisible(false);
    setClosetModalResolved(true);
  }

  // ── Load saved + feedback state for these requestIds on mount ───────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const [savedOutfits, allFeedback] = await Promise.all([
        loadSavedOutfits(),
        loadRecommendationFeedback(),
      ]);
      if (!isMounted) return;
      setSavedOutfitIds(savedOutfits.map((item) => item.id));
      const idSet = new Set(allRequestIds);
      const map: Record<string, 'love' | 'hate'> = {};
      for (const f of allFeedback) {
        if (idSet.has(f.requestId) && (f.thumb === 'love' || f.thumb === 'hate')) {
          map[f.requestId] = f.thumb;
        }
      }
      setFeedbackMap(map);
    })();
    return () => {
      isMounted = false;
    };
  }, [allRequestIds]);

  // ── Sequential generation with previousVariations carry-forward ────────────
  const generationRunRef = useRef(false);
  useEffect(() => {
    if (generationRunRef.current) return;
    generationRunRef.current = true;
    const abortController = new AbortController();

    (async () => {
      const priorSummaries: VariationSummary[] = [];
      for (let i = 0; i < allRequestIds.length; i += 1) {
        if (abortController.signal.aborted) return;
        const requestId = allRequestIds[i]!;
        const variantContext = totalLooks > 1
          ? { index: i + 1, total: totalLooks, previousVariations: [...priorSummaries] }
          : undefined;

        const serviceResponse = await outfitsService.generateOutfits(
          {
            ...parsedInput,
            requestId,
            selectedTiers: [tier],
            generateOnlyTier: tier,
            trendiness,
            variantContext,
          },
          { signal: abortController.signal },
        );
        if (abortController.signal.aborted) return;

        if (!serviceResponse.success || !serviceResponse.data) {
          setSlots((prev) =>
            prev.map((slot, idx) =>
              idx === i
                ? { ...slot, isLoading: false, errorMessage: serviceResponse.error?.message ?? 'Failed to generate this look.' }
                : slot,
            ),
          );
          continue;
        }

        const response = serviceResponse.data;
        const recommendation = response.recommendations.find((r) => r.tier === tier);
        const summary = recommendation ? buildSummary(recommendation) : null;
        if (summary) priorSummaries.push(summary);
        setSlots((prev) =>
          prev.map((slot, idx) =>
            idx === i
              ? { ...slot, isLoading: false, response, summary }
              : slot,
          ),
        );
      }
    })();

    return () => abortController.abort();
    // allRequestIds is stable across renders (memoised on the input list). trendiness/parsedInput
    // are intentionally captured at first run — re-generating mid-screen would be confusing UX.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sketch polling: poll each pending slot every 4s ────────────────────────
  useEffect(() => {
    const pendingSlots = slots.filter((slot) => {
      if (!slot.response) return false;
      return slot.response.recommendations.some((r) => r.sketchStatus === 'pending');
    });
    if (!pendingSlots.length) return;

    const interval = setInterval(async () => {
      await Promise.all(
        pendingSlots.map(async (slot) => {
          const result = await outfitsService.getOutfitResult(slot.requestId);
          if (!result.success || !result.data) return;
          setSlots((prev) =>
            prev.map((s) => (s.requestId === slot.requestId ? { ...s, response: result.data } : s)),
          );
        }),
      );
    }, SKETCH_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [slots]);

  // ── Per-slot match lookup (initial deterministic match; rematch via thumbs-down deferred) ──
  const matchMaps = useMemo(() => {
    const result: Record<string, Record<string, ClosetItem | null>> = {};
    for (const slot of slots) {
      if (!slot.response || !closetItems.length) {
        result[slot.requestId] = {};
        continue;
      }
      const recommendation = slot.response.recommendations.find((r) => r.tier === tier);
      if (!recommendation) {
        result[slot.requestId] = {};
        continue;
      }
      const pieces: OutfitPiece[] = [
        ...recommendation.keyPieces,
        ...recommendation.shoes,
        ...recommendation.accessories,
      ].map((p) => normalizePiece(p));
      const map: Record<string, ClosetItem | null> = {};
      for (const piece of pieces) {
        map[piece.display_name] = findBestClosetMatch(piece, closetItems, undefined);
      }
      result[slot.requestId] = map;
    }
    return result;
  }, [slots, closetItems, tier]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSave(slot: SlotState) {
    if (!slot.response) return;
    const recommendation = slot.response.recommendations.find((r) => r.tier === tier);
    if (!recommendation) return;
    const savedId = buildSavedOutfitId(slot.requestId, tier, slot.tierGeneration);
    if (savedOutfitIds.includes(savedId)) return;
    setSavingRequestId(slot.requestId);
    try {
      await saveSavedOutfit(slot.response.input, { ...recommendation }, slot.requestId, slot.tierGeneration);
      setSavedOutfitIds((prev) => [...prev, savedId]);
      trackSaveOutfit({ tier });
      showToast('Outfit saved to history.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }
    setSavingRequestId(null);
  }

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!weekPickerRequestId) return;
    const slot = slots.find((s) => s.requestId === weekPickerRequestId);
    if (!slot?.response) return;
    const recommendation = slot.response.recommendations.find((r) => r.tier === tier);
    if (!recommendation) return;
    try {
      await assignOutfitToWeekDay(dayKey, dayLabel, slot.response.input, { ...recommendation }, slot.requestId);
      trackAddToWeek({ tier, day_label: dayLabel });
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }
    setWeekPickerRequestId(null);
  }

  async function handleOutfitFeedback(slot: SlotState, thumb: 'love' | 'hate') {
    if (!slot.response) return;
    const recommendation = slot.response.recommendations.find((r) => r.tier === tier);
    if (!recommendation) return;
    if (feedbackMap[slot.requestId] === thumb) {
      setFeedbackMap((prev) => {
        const next = { ...prev };
        delete next[slot.requestId];
        return next;
      });
      return;
    }
    setFeedbackMap((prev) => ({ ...prev, [slot.requestId]: thumb }));
    await saveRecommendationFeedback({
      id: `${slot.requestId}:${tier}:outfit`,
      requestId: slot.requestId,
      tier,
      outfitTitle: recommendation.title,
      thumb,
      regenerated: false,
      createdAt: new Date().toISOString(),
    });
    showToast(thumb === 'love' ? 'Noted — glad you love it.' : "Noted — we'll keep that in mind.");
  }

  // ── Initial loading gate (closet modal + at least one slot in flight) ──────
  const allLoading = slots.every((s) => s.isLoading);
  if ((allLoading && !slots[0]?.response) || !closetModalResolved) {
    return (
      <AppScreen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingState
            label={`Generating ${totalLooks} ${totalLooks === 1 ? 'look' : 'looks'}...`}
            messages={extendedFashionLoadingMessages}
          />
        </View>
        <SaveToClosetModal
          visible={closetModalVisible}
          uploadedImage={parsedInput.uploadedAnchorImage ?? null}
          onClose={handleClosetModalClose}
          onSaved={() => {
            setAnchorAddedToCloset(true);
            handleClosetModalClose();
          }}
          loadingContext
        />
      </AppScreen>
    );
  }

  if (slots.every((s) => !s.response && !s.isLoading)) {
    return (
      <AppScreen>
        <ErrorState
          title="Result not found"
          message={slots[0]?.errorMessage ?? 'The app could not generate outfits for this request.'}
          actionLabel="Go to history"
          actionHref="/(app)/history"
        />
      </AppScreen>
    );
  }

  const reviewResponse = slots[0]?.response;
  const reviewInput = reviewResponse?.input ?? parsedInput;

  return (
    <AppScreen scrollable floatingBack>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Outfit Results" showBack />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Your Looks</AppText>
          <AppText tone="muted">
            {totalLooks} distinct styling directions built from the same anchor.
          </AppText>
        </View>
        <LookRequestReviewCard
          input={reviewInput}
          hideInfoBox
          recommendations={reviewResponse?.recommendations}
        />

        {slots.map((slot, index) => {
          if (slot.isLoading) {
            return (
              <View key={slot.requestId} style={{ gap: spacing.sm }}>
                <AppText variant="eyebrow" style={{ color: themeCtx.colors.mutedText, letterSpacing: 1.6 }}>
                  Look {index + 1} of {totalLooks}
                </AppText>
                <LoadingState label="Generating outfit..." />
              </View>
            );
          }
          if (!slot.response || slot.errorMessage) {
            return (
              <View key={slot.requestId} style={{ gap: spacing.sm }}>
                <AppText variant="eyebrow" style={{ color: themeCtx.colors.mutedText, letterSpacing: 1.6 }}>
                  Look {index + 1} of {totalLooks}
                </AppText>
                <View
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: 24,
                    borderWidth: 1,
                    gap: spacing.sm,
                    padding: spacing.lg,
                  }}>
                  <AppText>{slot.errorMessage ?? 'This look could not be generated.'}</AppText>
                </View>
              </View>
            );
          }

          const recommendation = slot.response.recommendations.find((r) => r.tier === tier);
          if (!recommendation) {
            return (
              <View key={slot.requestId} style={{ gap: spacing.sm }}>
                <AppText tone="muted">Look {index + 1} of {totalLooks} returned no recommendation.</AppText>
              </View>
            );
          }
          const savedId = buildSavedOutfitId(slot.requestId, tier, slot.tierGeneration);
          return (
            <View key={slot.requestId} style={{ gap: spacing.sm }}>
              <AppText variant="eyebrow" style={{ color: themeCtx.colors.mutedText, letterSpacing: 1.6 }}>
                Look {index + 1} of {totalLooks}
              </AppText>
              <LookResultCard
                recommendation={recommendation}
                isSaved={savedOutfitIds.includes(savedId)}
                isSaving={savingRequestId === slot.requestId}
                onSave={() => void handleSave(slot)}
                onAddToWeek={() => setWeekPickerRequestId(slot.requestId)}
                onSecondOpinion={() => setSecondOpinionRequestId(slot.requestId)}
                outfitFeedback={feedbackMap[slot.requestId] ?? null}
                onOutfitFeedback={(thumb) => void handleOutfitFeedback(slot, thumb)}
                closetItems={closetItems}
                matchMap={matchMaps[slot.requestId]}
                anchorDescription={parsedInput.anchorItemDescription}
                detailHref={buildTierHref(tier, slot.requestId, slot.response.input, recommendation)}
              />
            </View>
          );
        })}
      </View>

      <WeekPickerModal
        visible={Boolean(weekPickerRequestId)}
        onClose={() => setWeekPickerRequestId(null)}
        onSelectDay={handleAssignToWeek}
      />
      {secondOpinionRequestId
        ? (() => {
            const slot = slots.find((s) => s.requestId === secondOpinionRequestId);
            const recommendation = slot?.response?.recommendations.find((r) => r.tier === tier);
            if (!recommendation) return null;
            return (
              <StylistChooserModal
                visible
                recommendation={recommendation}
                onClose={() => setSecondOpinionRequestId(null)}
              />
            );
          })()
        : null}
      <SaveToClosetModal
        visible={closetModalVisible}
        uploadedImage={parsedInput.uploadedAnchorImage ?? null}
        onClose={handleClosetModalClose}
        onSaved={() => {
          setAnchorAddedToCloset(true);
          handleClosetModalClose();
        }}
      />
    </AppScreen>
  );
}
