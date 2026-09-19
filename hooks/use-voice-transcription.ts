import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useState } from 'react';

import { recordError } from '@/lib/crashlytics';
import { transcriptionService } from '@/services/transcription';

export type VoiceTranscriptionStatus = 'idle' | 'recording' | 'transcribing';

/**
 * Records a short voice clip and transcribes it via the backend's
 * /stylist-brief/transcribe endpoint (OpenAI transcription, same account/key
 * as every other AI call in this app). Voice is an input METHOD, not a
 * separate workflow — a transcription failure never blocks the caller from
 * typing; it only surfaces `error` for the UI to show alongside the still-
 * editable text field.
 */
export function useVoiceTranscription() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [status, setStatus] = useState<VoiceTranscriptionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

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
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)), 'stylist_brief_recording_start');
      setError('Could not start recording. You can still type your brief.');
      setStatus('idle');
    }
  }

  /** Stops recording, transcribes the clip, and returns the transcript — or null on any failure (typing remains available either way). */
  async function stopRecordingAndTranscribe(): Promise<string | null> {
    if (status !== 'recording') return null;

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
    if (status === 'recording') {
      void recorder.stop();
    }
    setStatus('idle');
  }

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
