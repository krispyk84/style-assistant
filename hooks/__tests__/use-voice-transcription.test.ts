// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// ── S2 fix: 120s max recording duration ─────────────────────────────────────
describe('useVoiceTranscription — 120s recording limit', () => {
  async function startRecording(result: { current: ReturnType<typeof useVoiceTranscription> }) {
    requestRecordingPermissionsAsyncMock.mockResolvedValue({ granted: true });
    await act(async () => { result.current.startRecording(); });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('manual stop before the limit transcribes normally and disarms the timer — no second transcription when 120s later elapses', async () => {
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useVoiceTranscription({ onAutoStop }));
    await startRecording(result);

    recorderMock.uri = 'file://recording.m4a';
    transcribeAudioMock.mockResolvedValue({ success: true, data: { text: 'manual stop text' }, error: null });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000); // well under the 120s limit
      await result.current.stopRecordingAndTranscribe();
    });

    expect(transcribeAudioMock).toHaveBeenCalledTimes(1);

    // Advance well past where the auto-stop timer would have fired had it
    // not been cleared by the manual stop.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(transcribeAudioMock).toHaveBeenCalledTimes(1); // still just the one, manual call
    expect(onAutoStop).not.toHaveBeenCalled(); // this was a manual stop, not an auto-stop
  });

  it('automatically stops and transcribes at exactly 120s, delivering the result via onAutoStop', async () => {
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useVoiceTranscription({ onAutoStop }));
    await startRecording(result);

    recorderMock.uri = 'file://recording.m4a';
    transcribeAudioMock.mockResolvedValue({ success: true, data: { text: 'auto-stopped text' }, error: null });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(recorderMock.stop).toHaveBeenCalledTimes(1);
    expect(transcribeAudioMock).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledWith('auto-stopped text');
    expect(result.current.status).toBe('idle');
  });

  it('does not fire before 120s', async () => {
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useVoiceTranscription({ onAutoStop }));
    await startRecording(result);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_999);
    });

    expect(recorderMock.stop).not.toHaveBeenCalled();
    expect(onAutoStop).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
  });

  it('a manual stop racing right at the auto-stop boundary only transcribes once (no second-stop race)', async () => {
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useVoiceTranscription({ onAutoStop }));
    await startRecording(result);

    recorderMock.uri = 'file://recording.m4a';
    transcribeAudioMock.mockResolvedValue({ success: true, data: { text: 'race text' }, error: null });

    // Advance to just before the limit, then fire a manual stop and the
    // auto-stop timer in the same tick — the manual call runs first (it's
    // awaited directly), and stopRecordingAndTranscribe's own
    // `status !== 'recording'` guard makes the timer's later call a no-op.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_999);
      await result.current.stopRecordingAndTranscribe();
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(transcribeAudioMock).toHaveBeenCalledTimes(1);
    expect(recorderMock.stop).toHaveBeenCalledTimes(1);
  });

  it('unmounting mid-recording clears the timer and stops the recorder, without transcribing', async () => {
    const onAutoStop = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceTranscription({ onAutoStop }));
    await startRecording(result);

    unmount();
    expect(recorderMock.stop).toHaveBeenCalledTimes(1);

    transcribeAudioMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    // The auto-stop timer must have been cleared on unmount — it must not
    // fire afterward and attempt to transcribe or call back into an
    // unmounted component's state setter.
    expect(transcribeAudioMock).not.toHaveBeenCalled();
    expect(onAutoStop).not.toHaveBeenCalled();
  });
});
