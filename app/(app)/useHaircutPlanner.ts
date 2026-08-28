import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { cameraCaptureResult } from '@/lib/camera-capture-result';
import { haircutService } from '@/services/haircut';
import type { HaircutGuideResponse, HaircutOption, HaircutSessionResponse } from '@/types/api';

export type HaircutPlannerStage =
  | 'upload'
  | 'generating'
  | 'swipe'
  | 'swipe-choice'
  | 'more-loading'
  | 'narrowed'
  | 'guide-loading'
  | 'guide'
  | 'error';

const POLL_INTERVAL_MS = 3000;

export function useHaircutPlanner() {
  const router = useRouter();
  const {
    image, uploadedImage, isPicking, isUploading, error: uploadError,
    pickFromLibrary, removeImage, setImage, uploadImage,
  } = useUploadedImage('selfie');

  const [stage, setStage] = useState<HaircutPlannerStage>('upload');
  const [session, setSession] = useState<HaircutSessionResponse | null>(null);
  const [likedOptions, setLikedOptions] = useState<HaircutOption[]>([]);
  // Every option id the user has already swiped (either direction), across all
  // batches — used to compute which ready options belong in the CURRENT batch.
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  // Bumped every time a fresh batch of cards is ready to show — used as the
  // swipe deck's `key` so it remounts cleanly instead of reusing stale internal state.
  const [batchIndex, setBatchIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<HaircutOption | null>(null);
  const [guide, setGuide] = useState<HaircutGuideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once when a session is created and held constant across poll ticks — unlike
  // `session` (replaced on every poll response), this only changes on a NEW session,
  // so it's safe as an effect dependency without recreating the interval every tick.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  function handleOpenCamera() {
    cameraCaptureResult.setListener(async (captured) => {
      setImage(captured);
      await uploadImage(captured);
    });
    router.push('/camera-capture');
  }

  async function startSession() {
    if (!uploadedImage) return;
    setError(null);
    setLikedOptions([]);
    setSwipedIds(new Set());
    setBatchIndex(0);
    setStage('generating');
    const response = await haircutService.createSession({ headshotImageUrl: uploadedImage.publicUrl });
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'Could not start the haircut planner. Please try again.');
      setStage('error');
      return;
    }
    setSession(response.data);
    setActiveSessionId(response.data.sessionId);
  }

  // Poll while generating (initial batch or a "see more" batch) — stop once every
  // option in the session has resolved to ready/failed. Depends on `activeSessionId`
  // (set once per session), not `session` (replaced on every tick), so the interval
  // isn't torn down and recreated on every poll response.
  useEffect(() => {
    if ((stage !== 'generating' && stage !== 'more-loading') || !activeSessionId) return;
    const sessionId = activeSessionId;

    const interval = setInterval(async () => {
      const response = await haircutService.getSession(sessionId);
      if (!response.success || !response.data) return;
      setSession(response.data);
      if (response.data.status === 'ready') {
        clearInterval(interval);

        setSwipedIds((currentSwipedIds) => {
          const freshBatch = response.data!.options.filter(
            (option) => option.status === 'ready' && !currentSwipedIds.has(option.id),
          );

          if (freshBatch.length === 0) {
            // First-ever batch fully failed — a hard dead end. A "more" batch that
            // fully failed just returns to the choice screen with existing favorites intact.
            if (currentSwipedIds.size === 0) {
              setError('None of the haircuts could be generated. Please try a different photo.');
              setStage('error');
            } else {
              setError('Those didn\'t come through. Try again, or review your favorites.');
              setStage('swipe-choice');
            }
          } else {
            setBatchIndex((i) => i + 1);
            setStage('swipe');
          }

          return currentSwipedIds;
        });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // setSession/setStage/setError/setBatchIndex/setSwipedIds are stable dispatchers — omitted intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, activeSessionId]);

  const readyOptions = session?.options.filter((option) => option.status === 'ready') ?? [];
  const currentBatch = readyOptions.filter((option) => !swipedIds.has(option.id));

  function markSwiped(cardIndex: number) {
    const swiped = currentBatch[cardIndex];
    if (swiped) setSwipedIds((prev) => new Set(prev).add(swiped.id));
    return swiped;
  }

  function handleSwipedRight(cardIndex: number) {
    const swiped = markSwiped(cardIndex);
    if (swiped) setLikedOptions((prev) => [...prev, swiped]);
  }

  function handleSwipedLeft(cardIndex: number) {
    markSwiped(cardIndex);
  }

  function handleSwipedAll() {
    setStage('swipe-choice');
  }

  function reviewFavorites() {
    if (likedOptions.length === 0) {
      setError('You haven\'t liked any yet. Swipe right on the ones you like, or start over with a different photo.');
      setStage('error');
      return;
    }
    setStage('narrowed');
  }

  async function requestMoreHaircuts() {
    if (!activeSessionId) return;
    setError(null);
    setStage('more-loading');
    const response = await haircutService.addMoreOptions(activeSessionId);
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'No more haircut styles to try for this photo.');
      setStage('swipe-choice');
      return;
    }
    setSession(response.data);
  }

  async function selectFinal(option: HaircutOption) {
    setSelectedOption(option);
    setStage('guide-loading');
    setError(null);
    const response = await haircutService.generateGuide({
      styleLabel: option.styleLabel,
      styleSummary: option.styleSummary,
    });
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'Could not generate the guide. Please try again.');
      setStage('narrowed');
      return;
    }
    setGuide(response.data);
    setStage('guide');
  }

  function reset() {
    removeImage();
    setActiveSessionId(null);
    setSession(null);
    setLikedOptions([]);
    setSwipedIds(new Set());
    setBatchIndex(0);
    setSelectedOption(null);
    setGuide(null);
    setError(null);
    setStage('upload');
  }

  return {
    image, isPicking, isUploading, uploadError,
    pickFromLibrary, handleOpenCamera,
    stage, session, error,
    currentBatch, batchIndex, likedOptions,
    selectedOption, guide,
    startSession, handleSwipedRight, handleSwipedLeft, handleSwipedAll,
    reviewFavorites, requestMoreHaircuts, selectFinal, reset,
  };
}
