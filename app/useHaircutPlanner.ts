import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { cameraCaptureResult } from '@/lib/camera-capture-result';
import { haircutService } from '@/services/haircut';
import type {
  HaircutAngleShots,
  HaircutGuideResponse,
  HaircutOption,
  HaircutSessionResponse,
  SavedHaircutSession,
} from '@/types/api';

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
  // The cards actively being swiped through right now. This is real state, set
  // ONCE per batch (not derived by filtering on every render) — the swipe deck
  // relies on card index staying stable for the life of a batch; a derived array
  // that shrinks as each card is swiped desyncs the deck's internal index from
  // this array, causing wrong cards to disappear and eventually an out-of-bounds
  // (undefined) card crash.
  const [currentBatch, setCurrentBatch] = useState<HaircutOption[]>([]);
  // Every option id already dealt into a batch so far (any batch, this session) —
  // used only to compute which ready options belong in the NEXT fresh batch.
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  // Bumped every time a fresh batch of cards is ready to show — used as the
  // swipe deck's `key` so it remounts cleanly instead of reusing stale internal state.
  const [batchIndex, setBatchIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<HaircutOption | null>(null);
  const [guide, setGuide] = useState<HaircutGuideResponse | null>(null);
  const [angleShots, setAngleShots] = useState<HaircutAngleShots | null>(null);
  // Distinct from angleShots === null so the guide screen can show a visible
  // "generating..." state instead of silently showing nothing while in flight,
  // and can tell "still loading" apart from "failed with no data" if the
  // request rejects outright instead of resolving to {success:false}.
  const [angleShotsError, setAngleShotsError] = useState<string | null>(null);
  const [isLoadingAngleShots, setIsLoadingAngleShots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once when a session is created and held constant across poll ticks — unlike
  // `session` (replaced on every poll response), this only changes on a NEW session,
  // so it's safe as an effect dependency without recreating the interval every tick.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [savedSessions, setSavedSessions] = useState<SavedHaircutSession[]>([]);
  const [isLoadingSavedSessions, setIsLoadingSavedSessions] = useState(true);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isCurrentSessionSaved, setIsCurrentSessionSaved] = useState(false);
  // True when the guide stage is showing a previously-saved session opened
  // directly from the upload screen, rather than one just reached by swiping —
  // there's no swipe/favorites context to step back into, so goBack() treats
  // it as its own flow and returns to the upload screen instead of 'narrowed'.
  const [viewingSaved, setViewingSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void haircutService.listSavedSessions().then((response) => {
      if (cancelled) return;
      if (response.success && response.data) setSavedSessions(response.data.sessions);
      setIsLoadingSavedSessions(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setCurrentBatch([]);
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
            setCurrentBatch(freshBatch);
            setBatchIndex((i) => i + 1);
            setStage('swipe');
          }

          // Unchanged here — swipedIds only grows as the user actually swipes
          // (see markSwiped), not when a batch is merely dealt.
          return currentSwipedIds;
        });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // setSession/setStage/setError/setBatchIndex/setSwipedIds are stable dispatchers — omitted intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, activeSessionId]);

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
    setAngleShots(null);
    setAngleShotsError(null);
    setIsCurrentSessionSaved(false);
    setViewingSaved(false);

    // Kick off the angle shots (front-angled/side/back) alongside the text guide —
    // they take longer (3 more image generations), so don't block entering the
    // guide stage on them; they fill in progressively via the poll effect below.
    // isLoadingAngleShots is tracked separately from angleShots so the guide
    // screen can show a visible "generating..." state instead of silently
    // showing nothing while this is in flight (or if it fails outright).
    if (activeSessionId) {
      setIsLoadingAngleShots(true);
      void haircutService.generateAngleShots(activeSessionId, { optionId: option.id })
        .then((angleResponse) => {
          if (angleResponse.success && angleResponse.data) {
            setAngleShots({
              frontAngled: angleResponse.data.frontAngled,
              side: angleResponse.data.side,
              back: angleResponse.data.back,
            });
          } else {
            setAngleShotsError(angleResponse.error?.message ?? 'Could not generate the other angles.');
          }
        })
        .catch(() => {
          setAngleShotsError('Could not generate the other angles.');
        })
        .finally(() => {
          setIsLoadingAngleShots(false);
        });
    }

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

  // Poll the angle shots (front-angled/side/back) while any are still pending —
  // reuses the same session-status endpoint since they're just more HaircutOption
  // rows on the same session.
  useEffect(() => {
    if (stage !== 'guide' || !activeSessionId || !angleShots) return;
    const anyPending = [angleShots.frontAngled, angleShots.side, angleShots.back].some((o) => o.status === 'pending');
    if (!anyPending) return;
    const sessionId = activeSessionId;

    const interval = setInterval(async () => {
      const response = await haircutService.getSession(sessionId);
      if (!response.success || !response.data) return;
      const byId = new Map(response.data.options.map((o) => [o.id, o]));
      setAngleShots((prev) => {
        if (!prev) return prev;
        return {
          frontAngled: byId.get(prev.frontAngled.id) ?? prev.frontAngled,
          side: byId.get(prev.side.id) ?? prev.side,
          back: byId.get(prev.back.id) ?? prev.back,
        };
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [stage, activeSessionId, angleShots]);

  // Only 'narrowed' (the liked-options list) and 'guide' have a meaningful
  // prior stage to step back to. Every other stage is either the entry point
  // or mid-flight work with nothing useful to resume — back from there exits
  // the whole flow via the navigator instead.
  function goBack() {
    if (stage === 'guide') {
      if (viewingSaved) {
        reset();
        return;
      }
      setGuide(null);
      setSelectedOption(null);
      setAngleShots(null);
      setAngleShotsError(null);
      setIsLoadingAngleShots(false);
      setStage('narrowed');
      return;
    }
    if (stage === 'narrowed') {
      setStage('swipe-choice');
      return;
    }
    router.back();
  }

  function reset() {
    removeImage();
    setActiveSessionId(null);
    setSession(null);
    setLikedOptions([]);
    setSwipedIds(new Set());
    setCurrentBatch([]);
    setBatchIndex(0);
    setSelectedOption(null);
    setGuide(null);
    setAngleShots(null);
    setAngleShotsError(null);
    setIsLoadingAngleShots(false);
    setIsCurrentSessionSaved(false);
    setViewingSaved(false);
    setError(null);
    setStage('upload');
  }

  async function saveHaircut() {
    if (!activeSessionId || !selectedOption || !guide || isSavingSession) return;
    setIsSavingSession(true);
    const response = await haircutService.saveSession(activeSessionId, { optionId: selectedOption.id, guide });
    setIsSavingSession(false);
    if (!response.success) {
      setError(response.error?.message ?? 'Could not save this haircut. Please try again.');
      return;
    }
    setIsCurrentSessionSaved(true);
    setSavedSessions((prev) => [
      {
        sessionId: activeSessionId,
        styleLabel: selectedOption.styleLabel,
        savedAt: new Date().toISOString(),
        option: selectedOption,
        angleShots,
        guide,
      },
      ...prev.filter((saved) => saved.sessionId !== activeSessionId),
    ]);
  }

  async function unsaveHaircut() {
    if (!activeSessionId || isSavingSession) return;
    setIsSavingSession(true);
    const response = await haircutService.unsaveSession(activeSessionId);
    setIsSavingSession(false);
    if (!response.success) {
      setError(response.error?.message ?? 'Could not remove this saved haircut. Please try again.');
      return;
    }
    setIsCurrentSessionSaved(false);
    setSavedSessions((prev) => prev.filter((saved) => saved.sessionId !== activeSessionId));
  }

  function openSavedSession(saved: SavedHaircutSession) {
    setActiveSessionId(saved.sessionId);
    setSelectedOption(saved.option);
    setGuide(saved.guide);
    setAngleShots(saved.angleShots);
    setAngleShotsError(null);
    setIsLoadingAngleShots(false);
    setIsCurrentSessionSaved(true);
    setViewingSaved(true);
    setError(null);
    setStage('guide');
  }

  return {
    image, isPicking, isUploading, uploadError,
    pickFromLibrary, handleOpenCamera,
    stage, session, error,
    currentBatch, batchIndex, likedOptions,
    selectedOption, guide, angleShots, angleShotsError, isLoadingAngleShots,
    savedSessions, isLoadingSavedSessions, isSavingSession, isCurrentSessionSaved,
    startSession, handleSwipedRight, handleSwipedLeft, handleSwipedAll,
    reviewFavorites, requestMoreHaircuts, selectFinal, reset, goBack,
    saveHaircut, unsaveHaircut, openSavedSession,
  };
}
