// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Stylist } from '@/lib/stylists';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// "Tell your stylist": typing must always work regardless of voice state,
// and a transcript must append to (not silently clobber) whatever the user
// already typed/dictated — this file protects both, plus that a
// transcription failure never disables the text field.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Pressable: (props: { children?: unknown; onPress?: () => void; disabled?: boolean; accessibilityLabel?: string }) => (
    <button aria-label={props.accessibilityLabel} disabled={props.disabled} onClick={props.disabled ? undefined : props.onPress}>
      {props.children as any}
    </button>
  ),
  TextInput: (props: { value?: string; onChangeText?: (t: string) => void; placeholder?: string }) => (
    <textarea
      aria-label="Stylist brief"
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e) => props.onChangeText?.(e.target.value)}
    />
  ),
}));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({
    theme: { colors: { accent: '#000', danger: '#c00', inverseText: '#fff', mutedText: '#666', subtleSurface: '#eee', subtleText: '#999', surface: '#fff', text: '#000' }, fonts: { sans: 'System' } },
  }),
}));
vi.mock('@/lib/analytics', () => ({ trackAskStylistVoiceUsed: vi.fn() }));

const { useVoiceTranscriptionMock } = vi.hoisted(() => ({ useVoiceTranscriptionMock: vi.fn() }));
vi.mock('@/hooks/use-voice-transcription', () => ({ useVoiceTranscription: useVoiceTranscriptionMock }));

const { StylistBriefInput } = await import('@/components/forms/StylistBriefInput');

function fakeVoice(overrides: Partial<ReturnType<typeof baseVoice>> = {}) {
  return { ...baseVoice(), ...overrides };
}
function baseVoice() {
  return {
    status: 'idle' as const,
    isRecording: false,
    isTranscribing: false,
    durationMillis: 0,
    error: null as string | null,
    permissionDenied: false,
    startRecording: vi.fn(),
    stopRecordingAndTranscribe: vi.fn(),
    cancelRecording: vi.fn(),
    clearError: vi.fn(),
  };
}

const vittorio: Stylist = { id: 'vittorio', name: 'Vittorio', title: 'Sartori', keywords: [], description: '', image: 1 };
const alessandra: Stylist = { id: 'alessandra', name: 'Alessandra', title: 'Sartori', keywords: [], description: '', image: 2 };

beforeEach(() => {
  useVoiceTranscriptionMock.mockReturnValue(fakeVoice());
});

afterEach(() => {
  cleanup();
});

describe('StylistBriefInput — typing', () => {
  it('typing calls onChangeText', () => {
    const onChangeText = vi.fn();
    render(<StylistBriefInput value="" onChangeText={onChangeText} stylist={vittorio} />);
    fireEvent.change(screen.getByLabelText('Stylist brief'), { target: { value: 'drinks with friends' } });
    expect(onChangeText).toHaveBeenCalledWith('drinks with friends');
  });

  it("the placeholder reflects the selected stylist's name and persona pronoun", () => {
    const { rerender } = render(<StylistBriefInput value="" onChangeText={vi.fn()} stylist={vittorio} />);
    expect(screen.getByPlaceholderText(/Tell Vittorio.*he should know/)).toBeTruthy();

    rerender(<StylistBriefInput value="" onChangeText={vi.fn()} stylist={alessandra} />);
    expect(screen.getByPlaceholderText(/Tell Alessandra.*she should know/)).toBeTruthy();
  });
});

describe('StylistBriefInput — voice', () => {
  it('tapping the mic while idle starts recording', () => {
    const startRecording = vi.fn();
    useVoiceTranscriptionMock.mockReturnValue(fakeVoice({ startRecording }));
    render(<StylistBriefInput value="" onChangeText={vi.fn()} stylist={vittorio} />);
    fireEvent.click(screen.getByLabelText('Speak your stylist brief'));
    expect(startRecording).toHaveBeenCalledTimes(1);
  });

  it('an empty field is REPLACED by the transcript', async () => {
    const stopRecordingAndTranscribe = vi.fn().mockResolvedValue('drinks with friends downtown');
    useVoiceTranscriptionMock.mockReturnValue(fakeVoice({ isRecording: true, stopRecordingAndTranscribe }));
    const onChangeText = vi.fn();
    render(<StylistBriefInput value="" onChangeText={onChangeText} stylist={vittorio} />);

    await fireEvent.click(screen.getByLabelText('Stop recording'));

    expect(onChangeText).toHaveBeenCalledWith('drinks with friends downtown');
  });

  it('a non-empty field has the transcript APPENDED, not overwritten', async () => {
    const stopRecordingAndTranscribe = vi.fn().mockResolvedValue('and I want to wear these loafers');
    useVoiceTranscriptionMock.mockReturnValue(fakeVoice({ isRecording: true, stopRecordingAndTranscribe }));
    const onChangeText = vi.fn();
    render(<StylistBriefInput value="Dinner downtown" onChangeText={onChangeText} stylist={vittorio} />);

    await fireEvent.click(screen.getByLabelText('Stop recording'));

    expect(onChangeText).toHaveBeenCalledWith('Dinner downtown and I want to wear these loafers');
  });

  it('a transcription failure (null transcript) does not call onChangeText, and typing remains available', async () => {
    const stopRecordingAndTranscribe = vi.fn().mockResolvedValue(null);
    useVoiceTranscriptionMock.mockReturnValue(fakeVoice({
      isRecording: true,
      stopRecordingAndTranscribe,
      error: 'Could not transcribe the recording. You can still type your brief.',
    }));
    const onChangeText = vi.fn();
    render(<StylistBriefInput value="" onChangeText={onChangeText} stylist={vittorio} />);

    await fireEvent.click(screen.getByLabelText('Stop recording'));
    expect(onChangeText).not.toHaveBeenCalled();

    // Typing still works after a failed transcription.
    fireEvent.change(screen.getByLabelText('Stylist brief'), { target: { value: 'typed instead' } });
    expect(onChangeText).toHaveBeenCalledWith('typed instead');

    expect(screen.getByText('Could not transcribe the recording. You can still type your brief.')).toBeTruthy();
  });

  it('shows a permission-denied message without disabling the text field', () => {
    useVoiceTranscriptionMock.mockReturnValue(fakeVoice({ permissionDenied: true }));
    render(<StylistBriefInput value="" onChangeText={vi.fn()} stylist={vittorio} />);
    expect(screen.getByText(/microphone access/)).toBeTruthy();
    expect((screen.getByLabelText('Stylist brief') as HTMLTextAreaElement).disabled).toBe(false);
  });
});
