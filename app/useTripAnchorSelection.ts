import { useCallback, useEffect, useRef, useState } from 'react';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import {
  nextAnchorSlot,
  rankCandidatesForSlot,
  recommendTripAnchors,
} from '@/lib/trip-anchor-recommender';
import type { AnchorRecommendation, AnchorSlot, TripAnchorContext } from '@/lib/trip-anchor-recommender';
import type { ClosetItem } from '@/types/closet';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import type { AnchorMode, SelectedAnchor } from './trip-anchors-types';

type PickerTarget = { slotId: string; mode: AnchorMode };
type ImagePickerTarget = PickerTarget & { imageSource: 'camera' | 'library' };

type UseTripAnchorSelectionParams = {
  mode: AnchorMode;
  recommendation: AnchorRecommendation | null;
  tripCtx: TripAnchorContext | null;
  closetItems: ClosetItem[];
  closetLoaded: boolean;
  numDays?: number;
};

export function useTripAnchorSelection({
  mode,
  recommendation,
  tripCtx,
  closetItems,
  closetLoaded,
  numDays = 7,
}: UseTripAnchorSelectionParams) {
  const [guidedAnchors, setGuidedAnchors] = useState<Record<string, SelectedAnchor>>({});
  const [extraGuidedSlots, setExtraGuidedSlots] = useState<AnchorSlot[]>([]);
  const [autoAnchors, setAutoAnchors] = useState<SelectedAnchor[]>([]);
  const [autoLoadState, setAutoLoadState] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [manualAnchors, setManualAnchors] = useState<SelectedAnchor[]>([]);
  const [closetPickerVisible, setClosetPickerVisible] = useState(false);
  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);

  const closetPickerTargetRef = useRef<PickerTarget | null>(null);
  const sourceSheetTargetRef = useRef<PickerTarget | null>(null);
  const pendingSlotRef = useRef<ImagePickerTarget | null>(null);
  const prevUploadedImageIdRef = useRef<string | null>(null);

  const {
    image: pickedImage,
    uploadedImage,
    pickFromLibrary,
    takePhoto,
  } = useUploadedImage('anchor-item');

  const buildAutoSuggestions = useCallback((
    slots: ReturnType<typeof recommendTripAnchors>['slots'],
    items: ClosetItem[],
    ctx: TripAnchorContext,
  ): SelectedAnchor[] => {
    if (items.length === 0) return [];
    const usedItemIds = new Set<string>();
    const anchors: SelectedAnchor[] = [];

    for (const slot of slots) {
      const allCandidates = rankCandidatesForSlot(items, slot, ctx);
      const unusedCandidates = allCandidates.filter((candidate) => !usedItemIds.has(candidate.item.id));

      if (unusedCandidates.length > 0) {
        const best = unusedCandidates[0]!;
        usedItemIds.add(best.item.id);
        anchors.push({
          id: `auto-${slot.id}`,
          slotId: slot.id,
          label: best.item.title,
          category: slot.category,
          source: 'closet',
          closetItemId: best.item.id,
          closetItemTitle: best.item.title,
          closetItemImageUrl: best.item.sketchImageUrl ?? best.item.uploadedImageUrl ?? undefined,
          rationale: best.rationale,
          slotLabel: slot.label,
          slotRationale: slot.rationale,
          alternates: unusedCandidates.slice(1),
          alternateIndex: -1,
        });
      } else {
        anchors.push({
          id: `auto-${slot.id}`,
          slotId: slot.id,
          label: slot.label,
          category: slot.category,
          source: 'ai_suggested',
          slotLabel: slot.label,
          slotRationale: slot.rationale,
          rationale: `We couldn't find a strong match for "${slot.label}" in your closet. You can add one below.`,
        });
      }
    }
    return anchors;
  }, []);

  useEffect(() => {
    if (mode !== 'auto' || !recommendation || !closetLoaded || !tripCtx) return;
    setAutoLoadState('loading');
    const suggestions = buildAutoSuggestions(recommendation.slots, closetItems, tripCtx);
    setAutoAnchors(suggestions);
    setAutoLoadState(suggestions.length === 0 ? 'empty' : 'ready');
  }, [buildAutoSuggestions, closetItems, closetLoaded, mode, recommendation, tripCtx]);

  function applyAnchorToMode(slotId: string, anchorMode: AnchorMode, anchor: SelectedAnchor) {
    if (anchorMode === 'guided') {
      setGuidedAnchors((prev) => ({ ...prev, [slotId]: anchor }));
    } else if (anchorMode === 'auto') {
      setAutoAnchors((prev) => prev.map((current) => current.slotId === slotId ? { ...anchor, slotId: current.slotId } : current));
    } else {
      setManualAnchors((prev) => [...prev, anchor]);
    }
  }

  const getSlotCategory = useCallback((slotId: string, anchorMode: AnchorMode): string | undefined => {
    if (anchorMode === 'guided' && recommendation) {
      return recommendation.slots.find((slot) => slot.id === slotId)?.category;
    }
    return undefined;
  }, [recommendation]);

  const addAnchorFromClosetItem = useCallback((slotId: string, anchorMode: AnchorMode, item: ClosetItem) => {
    const anchor: SelectedAnchor = {
      id: `anchor-${Date.now()}`,
      slotId: slotId !== '__manual__' ? slotId : undefined,
      label: item.title,
      category: item.category ?? 'top',
      source: 'closet',
      closetItemId: item.id,
      closetItemTitle: item.title,
      closetItemImageUrl: item.sketchImageUrl ?? item.uploadedImageUrl ?? undefined,
    };
    applyAnchorToMode(slotId, anchorMode, anchor);
  }, []);

  const addAnchorFromUploadedImage = useCallback((
    slotId: string,
    anchorMode: AnchorMode,
    imageSource: 'camera' | 'library',
    img: LocalImageAsset,
    uploaded: UploadedImageAsset,
  ) => {
    const catHint = getSlotCategory(slotId, anchorMode);
    const anchor: SelectedAnchor = {
      id: `anchor-${Date.now()}`,
      slotId: slotId !== '__manual__' ? slotId : undefined,
      label: 'Your picked piece',
      category: catHint ?? 'top',
      source: imageSource,
      localImageUri: img.uri,
      uploadedImageId: uploaded.id,
      imageUrl: uploaded.publicUrl,
    };
    applyAnchorToMode(slotId, anchorMode, anchor);
  }, [getSlotCategory]);

  useEffect(() => {
    if (!uploadedImage?.id || uploadedImage.id === prevUploadedImageIdRef.current) return;
    prevUploadedImageIdRef.current = uploadedImage.id;
    const pending = pendingSlotRef.current;
    if (!pending || !pickedImage) return;
    pendingSlotRef.current = null;
    addAnchorFromUploadedImage(pending.slotId, pending.mode, pending.imageSource, pickedImage, uploadedImage);
  }, [addAnchorFromUploadedImage, pickedImage, uploadedImage]);

  const openSourceSheet = useCallback((slotId: string, targetMode: AnchorMode) => {
    sourceSheetTargetRef.current = { slotId, mode: targetMode };
    setSourceSheetVisible(true);
  }, []);

  const handlePickCamera = useCallback(() => {
    const target = sourceSheetTargetRef.current;
    if (!target) return;
    pendingSlotRef.current = { ...target, imageSource: 'camera' };
    void takePhoto();
  }, [takePhoto]);

  const handlePickLibrary = useCallback(() => {
    const target = sourceSheetTargetRef.current;
    if (!target) return;
    pendingSlotRef.current = { ...target, imageSource: 'library' };
    void pickFromLibrary();
  }, [pickFromLibrary]);

  const handlePickCloset = useCallback(() => {
    const target = sourceSheetTargetRef.current;
    if (!target) return;
    closetPickerTargetRef.current = target;
    setClosetPickerVisible(true);
  }, []);

  const handleClosetItemSelected = useCallback((item: ClosetItem) => {
    const target = closetPickerTargetRef.current;
    if (!target) return;
    closetPickerTargetRef.current = null;
    setClosetPickerVisible(false);
    addAnchorFromClosetItem(target.slotId, target.mode, item);
  }, [addAnchorFromClosetItem]);

  const handleAddGuidedSlot = useCallback(() => {
    if (!tripCtx || !recommendation) return;
    const usedIds = [...recommendation.slots, ...extraGuidedSlots].map((slot) => slot.id);
    const slot = nextAnchorSlot(tripCtx, usedIds);
    setExtraGuidedSlots((prev) => [...prev, slot]);
  }, [extraGuidedSlots, recommendation, tripCtx]);

  const handleAutoRetry = useCallback((anchor: SelectedAnchor) => {
    const alternates = anchor.alternates ?? [];
    if (alternates.length === 0) return;

    const currentIdx = anchor.alternateIndex ?? -1;
    const nextIdx = (currentIdx + 1) % alternates.length;
    const next = alternates[nextIdx]!;

    setAutoAnchors((prev) =>
      prev.map((current) =>
        current.id === anchor.id
          ? {
              ...current,
              label: next.item.title,
              source: 'closet',
              closetItemId: next.item.id,
              closetItemTitle: next.item.title,
              closetItemImageUrl: next.item.sketchImageUrl ?? next.item.uploadedImageUrl ?? undefined,
              rationale: next.rationale,
              alternateIndex: nextIdx,
            }
          : current
      )
    );
  }, []);

  const handleAutoReplace = useCallback((anchor: SelectedAnchor) => {
    openSourceSheet(anchor.slotId ?? anchor.id, 'auto');
  }, [openSourceSheet]);

  const handleAddAutoAnchor = useCallback(() => {
    if (!tripCtx || !recommendation) return;
    const usedIds = autoAnchors.map((anchor) => anchor.slotId ?? anchor.id);
    const slot = nextAnchorSlot(tripCtx, usedIds);
    const candidates = rankCandidatesForSlot(closetItems, slot, tripCtx);
    const usedItemIds = new Set(autoAnchors.map((anchor) => anchor.closetItemId).filter(Boolean));
    const best = candidates.find((candidate) => !usedItemIds.has(candidate.item.id));

    if (best) {
      setAutoAnchors((prev) => [
        ...prev,
        {
          id: `auto-extra-${Date.now()}`,
          slotId: slot.id,
          label: best.item.title,
          category: slot.category,
          source: 'closet',
          closetItemId: best.item.id,
          closetItemTitle: best.item.title,
          closetItemImageUrl: best.item.sketchImageUrl ?? best.item.uploadedImageUrl ?? undefined,
          rationale: best.rationale,
          slotLabel: slot.label,
          slotRationale: slot.rationale,
          alternates: candidates.slice(candidates.indexOf(best) + 1),
          alternateIndex: -1,
        },
      ]);
    } else {
      openSourceSheet(slot.id, 'auto');
    }
  }, [autoAnchors, closetItems, openSourceSheet, recommendation, tripCtx]);

  const activeAnchors: SelectedAnchor[] =
    mode === 'guided' ? Object.values(guidedAnchors)
    : mode === 'auto' ? autoAnchors
    : manualAnchors;

  const manualCap = numDays + 3;
  const manualExceedsCap = mode === 'manual' && manualAnchors.length > manualCap;
  const canContinue = !manualExceedsCap && (mode !== 'auto' || autoLoadState !== 'loading');

  return {
    guidedAnchors,
    setGuidedAnchors,
    extraGuidedSlots,
    autoAnchors,
    autoLoadState,
    manualAnchors,
    setManualAnchors,
    activeAnchors,
    manualExceedsCap,
    canContinue,
    closetPickerVisible,
    setClosetPickerVisible,
    sourceSheetVisible,
    setSourceSheetVisible,
    openSourceSheet,
    handlePickCamera,
    handlePickLibrary,
    handlePickCloset,
    handleClosetItemSelected,
    handleAddGuidedSlot,
    handleAutoRetry,
    handleAutoReplace,
    handleAddAutoAnchor,
  };
}
