import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { recordError } from '@/lib/crashlytics';
import { transcriptionService } from '@/services/transcription';

export type VoiceTranscriptionStatus = 'idle' | 'recording' | 'transcribing';

// S2 fix (pre-push audit): previously no client-side cap existed — recording
// relied incidentally on the backend's generic 8MB upload limit (~8 minutes
// at this preset's bitrate), which was never specifically reasoned about for
// a voice brief. 120s is a generous ceiling for a spoken styling brief.
const MAX_RECORDING_DURATION_MS = 120_000;

type UseVoiceTranscriptionOptions = {
  /**
   * Called when the MAX_RECORDING_DURATION_MS limit auto-stops an
   * in-progress recording. The manual stopRecordingAndTranscribe() path
   * returns its result directly to whichever caller awaited it (a mic-tap
   * handler); a timer-driven auto-stop has no caller awaiting it, so this is
   * how that same result (transcript or null) reaches the UI.
   */
  onAutoStop?: (transcript: string | null) => void;
};

/**
 * Records a short voice clip and transcribes it via the backend's
 * /stylist-brief/transcribe endpoint (OpenAI transcription, same account/key
 * as every other AI call in this app). Voice is an input METHOD, not a
 * separate workflow — a transcription failure never blocks the caller from
 * typing; it only surfaces `error` for the UI to show alongside the still-
 * editable text field.
 */
export function useVoiceTranscription({ onAutoStop }: UseVoiceTranscriptionOptions = {}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [status, setStatus] = useState<VoiceTranscriptionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `status` synchronously for the unmount-cleanup effect below,
  // which must not depend on `status` directly (that would tear down and
  // recreate the effect — and re-run its own cleanup — on every recording
  // state change, not just on actual unmount).
  const statusRef = useRef<VoiceTranscriptionStatus>('idle');
  statusRef.current = status;
  // The auto-stop timer can live for up to 120s. If it captured `onAutoStop`
  // directly, it would call whatever closure existed at the moment
  // startRecording() ran — stale the instant the caller re-renders with a
  // new one (e.g. StylistBriefInput's value prop changing as the user types
  // alongside an in-progress recording). Routing through a ref kept current
  // on every render (mirrors this codebase's established fix for the same
  // class of bug in useTripSketchPolling.ts's persistDayRef) means the timer
  // always calls the latest callback, not whichever was current when
  // recording started.
  const onAutoStopRef = useRef(onAutoStop);
  useEffect(() => {
    onAutoStopRef.current = onAutoStop;
  }, [onAutoStop]);

  function clearAutoStopTimer() {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    setPermissionDenied(false);

    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
      autoStopTimerRef.current = setTimeout(() => {
        void stopRecordingAndTranscribe().then((transcript) => onAutoStopRef.current?.(transcript));
      }, MAX_RECORDING_DURATION_MS);
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)), 'stylist_brief_recording_start');
      setError('Could not start recording. You can still type your brief.');
      setStatus('idle');
    }
  }

  /**
   * Stops recording, transcribes the clip, and returns the transcript — or
   * null on any failure (typing remains available either way). Shared by
   * both the manual mic-tap path and the MAX_RECORDING_DURATION_MS auto-stop
   * timer; the `status !== 'recording'` guard below means whichever of the
   * two fires second is a safe no-op — there is no double-stop/double-
   * transcribe race between a manual stop and an auto-stop landing together.
   */
  async function stopRecordingAndTranscribe(): Promise<string | null> {
    clearAutoStopTimer();
    // Reads statusRef, not `status`, deliberately: the auto-stop timer below
    // captures THIS function as it exists in the render where
    // startRecording() ran — i.e. still closed over status='idle', since
    // setStatus('recording') a few lines below in startRecording() hasn't
    // caused a re-render yet at the point the timer is scheduled. A plain
    // `status` read here would make every timer-driven auto-stop call
    // immediately no-op against that stale 'idle' value. statusRef.current
    // is a stable, shared ref object every closure (old and new) points to,
    // and it's reassigned synchronously on every render, so it always holds
    // the latest value regardless of which render's closure is running.
    if (statusRef.current !== 'recording') return null;

    let uri: string | null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)), 'stylist_brief_recording_stop');
      setError('Could not finish the recording. You can still type your brief.');
      setStatus('idle');
      return null;
    }

    if (!uri) {
      setError('The recording was empty. Please try again or type your brief.');
      setStatus('idle');
      return null;
    }

    setStatus('transcribing');
    try {
      const response = await transcriptionService.transcribeAudio({
        uri,
        fileName: `stylist-brief-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
      });

      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'Could not transcribe the recording. You can still type your brief.');
        return null;
      }

      const text = response.data.text.trim();
      if (!text) {
        setError('No speech was detected. Please try again or type your brief.');
        return null;
      }

      return text;
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)), 'stylist_brief_transcription');
      setError('Could not transcribe the recording. You can still type your brief.');
      return null;
    } finally {
      setStatus('idle');
    }
  }

  function cancelRecording() {
    clearAutoStopTimer();
    if (status === 'recording') {
      void recorder.stop();
    }
    setStatus('idle');
  }

  // Leaving the screen mid-recording must not leak an active recorder or a
  // pending auto-stop timer. This intentionally stops the recorder directly
  // rather than routing through stopRecordingAndTranscribe() — there is no
  // mounted UI left to deliver a transcript to, and calling back into a
  // parent component's state setter after unmount would be its own bug.
  useEffect(() => {
    return () => {
      clearAutoStopTimer();
      if (statusRef.current === 'recording') {
        void recorder.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    isRecording: status === 'recording',
    isTranscribing: status === 'transcribing',
    durationMillis: recorderState.durationMillis,
    error,
    permissionDenied,
    startRecording: () => void startRecording(),
    stopRecordingAndTranscribe,
    cancelRecording,
    clearError: () => setError(null),
  };
}
