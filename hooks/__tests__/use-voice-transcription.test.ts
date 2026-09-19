// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── What this file is ───────────────────────────────────────────────────────
//
// Voice input for "Ask a Stylist": proves permission handling, the
// recording/transcribing state machine, and — critically — that a
// transcription failure resolves to null rather than throwing, since voice
// must never be able to block the caller from typing instead.

const { requestRecordingPermissionsAsyncMock, setAudioModeAsyncMock, recorderMock } = vi.hoisted(() => ({
  requestRecordingPermissionsAsyncMock: vi.fn(),
  setAudioModeAsyncMock: vi.fn(),
  recorderMock: {
    prepareToRecordAsync: vi.fn(),
    record: vi.fn(),
    stop: vi.fn(),
    uri: null as string | null,
  },
}));

vi.mock('expo-audio', () => ({
  useAudioRecorder: () => recorderMock,
  useAudioRecorderState: () => ({ durationMillis: 0, isRecording: false, canRecord: true }),
  requestRecordingPermissionsAsync: requestRecordingPermissionsAsyncMock,
  setAudioModeAsync: setAudioModeAsyncMock,
  RecordingPresets: { HIGH_QUALITY: {} },
}));

const { transcribeAudioMock } = vi.hoisted(() => ({ transcribeAudioMock: vi.fn() }));
vi.mock('@/services/transcription', () => ({ transcriptionService: { transcribeAudio: transcribeAudioMock } }));

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({ recordError: recordErrorMock }));

const { useVoiceTranscription } = await import('@/hooks/use-voice-transcription');

beforeEach(() => {
  vi.clearAllMocks();
  recorderMock.uri = null;
  recorderMock.stop.mockResolvedValue(undefined);
  recorderMock.prepareToRecordAsync.mockResolvedValue(undefined);
});

describe('useVoiceTranscription — recording lifecycle', () => {
  it('starts recording when permission is granted', async () => {
    requestRecordingPermissionsAsyncMock.mockResolvedValue({ granted: true });

    const { result } = renderHook(() => useVoiceTranscription());
    await act(async () => { result.current.startRecording(); });

    expect(recorderMock.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(recorderMock.record).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.permissionDenied).toBe(false);
  });

  it('does not start recording when permission is denied, and surfaces permissionDenied', async () => {
    requestRecordingPermissionsAsyncMock.mockResolvedValue({ granted: false });

    const { result } = renderHook(() => useVoiceTranscription());
    await act(async () => { result.current.startRecording(); });

    expect(recorderMock.record).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.permissionDenied).toBe(true);
  });
});

describe('useVoiceTranscription — stopRecordingAndTranscribe', () => {
  async function startRecording(result: { current: ReturnType<typeof useVoiceTranscription> }) {
    requestRecordingPermissionsAsyncMock.mockResolvedValue({ granted: true });
    await act(async () => { result.current.startRecording(); });
  }

  it('returns the transcript on success and settles back to idle', async () => {
    const { result } = renderHook(() => useVoiceTranscription());
    await startRecording(result);
    recorderMock.uri = 'file://recording.m4a';
    transcribeAudioMock.mockResolvedValue({ success: true, data: { text: 'drinks with friends downtown' }, error: null });

    let transcript: string | null = null;
    await act(async () => { transcript = await result.current.stopRecordingAndTranscribe(); });

    expect(transcript).toBe('drinks with friends downtown');
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('returns null and surfaces an error on transcription failure — never throws', async () => {
    const { result } = renderHook(() => useVoiceTranscription());
    await startRecording(result);
    recorderMock.uri = 'file://recording.m4a';
    transcribeAudioMock.mockResolvedValue({ success: false, data: null, error: { code: 'TRANSCRIPTION_FAILED', message: 'Could not transcribe.' } });

    let transcript: string | null = 'not-null-yet';
    await expect(act(async () => { transcript = await result.current.stopRecordingAndTranscribe(); })).resolves.not.toThrow();

    expect(transcript).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.status).toBe('idle');
  });

  it('returns null with an inline error when the recording was empty (no uri)', async () => {
    const { result } = renderHook(() => useVoiceTranscription());
    await startRecording(result);
    recorderMock.uri = null;

    let transcript: string | null = 'not-null-yet';
    await act(async () => { transcript = await result.current.stopRecordingAndTranscribe(); });

    expect(transcript).toBeNull();
    expect(result.current.error).toContain('empty');
    expect(transcribeAudioMock).not.toHaveBeenCalled();
  });

  it('does nothing when called while not recording', async () => {
    const { result } = renderHook(() => useVoiceTranscription());

    let transcript: string | null = 'not-null-yet';
    await act(async () => { transcript = await result.current.stopRecordingAndTranscribe(); });

    expect(transcript).toBeNull();
    expect(recorderMock.stop).not.toHaveBeenCalled();
  });
});
