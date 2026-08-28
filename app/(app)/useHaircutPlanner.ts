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

  // Poll while generating — stop once every option has resolved to ready/failed.
  // Depends on `activeSessionId` (set once per session), not `session` (replaced on
  // every tick), so the interval isn't torn down and recreated on every poll response.
  useEffect(() => {
    if (stage !== 'generating' || !activeSessionId) return;
    const sessionId = activeSessionId;

    const interval = setInterval(async () => {
      const response = await haircutService.getSession(sessionId);
      if (!response.success || !response.data) return;
      setSession(response.data);
      if (response.data.status === 'ready') {
        clearInterval(interval);
        const readyOptions = response.data.options.filter((option) => option.status === 'ready');
        if (readyOptions.length === 0) {
          setError('None of the haircuts could be generated. Please try a different photo.');
          setStage('error');
          return;
        }
        setLikedOptions([]);
        setStage('swipe');
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // setSession/setStage/setError/setLikedOptions are stable dispatchers — omitted intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, activeSessionId]);

  const readyOptions = session?.options.filter((option) => option.status === 'ready') ?? [];

  function handleSwipedRight(cardIndex: number) {
    const swiped = readyOptions[cardIndex];
    if (swiped) setLikedOptions((prev) => [...prev, swiped]);
  }

  function handleSwipedAll() {
    setLikedOptions((current) => {
      if (current.length === 0) {
        setError('You swiped left on all of them. Try again with a different photo.');
        setStage('error');
      } else {
        setStage('narrowed');
      }
      return current;
    });
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
    setSelectedOption(null);
    setGuide(null);
    setError(null);
    setStage('upload');
  }

  return {
    image, isPicking, isUploading, uploadError,
    pickFromLibrary, handleOpenCamera,
    stage, session, error,
    readyOptions, likedOptions,
    selectedOption, guide,
    startSession, handleSwipedRight, handleSwipedAll, selectFinal, reset,
  };
}
