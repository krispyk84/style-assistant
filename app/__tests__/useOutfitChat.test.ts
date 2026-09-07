// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Representative loading-state-recovery test using the OTHER common shape:
// an ApiResponse ({success:false, error}) rather than use-image-picker's
// permission-style resolved-failure — this pattern repeats across most of
// the 37 sites fixed in the prior async-reliability pass (useSecondOpinionRequest,
// useHaircutPlanner, useFashionTrendReport, etc.); sendQuestion is the
// smallest, most self-contained example of it.

const { askQuestionMock } = vi.hoisted(() => ({ askQuestionMock: vi.fn() }));
vi.mock('@/services/outfit-chat', () => ({ outfitChatService: { askQuestion: askQuestionMock } }));

vi.mock('@/lib/outfit-chat-flow', () => ({
  outfitChatFlow: { consumePendingContext: vi.fn().mockReturnValue({ requestId: 'req-1', tier: 'business' }) },
}));

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({ recordError: recordErrorMock, log: vi.fn() }));

const { useOutfitChat } = await import('@/app/useOutfitChat');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useOutfitChat.sendQuestion — the three outcomes an async send can have', () => {
  it('SUCCESS: appends the assistant reply, isSending settles, no error', async () => {
    askQuestionMock.mockResolvedValue({ success: true, data: { answer: 'Wear the navy blazer.' } });

    const { result } = renderHook(() => useOutfitChat());
    await act(async () => { await result.current.sendQuestion('What goes with this?'); });

    expect(result.current.messages.at(-1)).toEqual({ role: 'assistant', content: 'Wear the navy blazer.' });
    expect(result.current.isSending).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('RESOLVED FAILURE ({success:false} — never throws): surfaces the error, isSending still settles, and a retry remains possible', async () => {
    askQuestionMock.mockResolvedValueOnce({ success: false, error: { message: 'Rate limited, try again shortly.' } });

    const { result } = renderHook(() => useOutfitChat());
    await act(async () => { await result.current.sendQuestion('What goes with this?'); });

    expect(result.current.errorMessage).toBe('Rate limited, try again shortly.');
    expect(result.current.isSending).toBe(false);
    // No assistant message was appended for the failed turn.
    expect(result.current.messages.some((m) => m.role === 'assistant')).toBe(false);

    // Retry: a second call succeeds and clears the error.
    askQuestionMock.mockResolvedValueOnce({ success: true, data: { answer: 'Try the loafers instead.' } });
    await act(async () => { await result.current.sendQuestion('What goes with this?'); });
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.messages.at(-1)).toEqual({ role: 'assistant', content: 'Try the loafers instead.' });
  });

  it('REJECTED (an actual thrown error): logs it, sets a fallback error message, and isSending still settles — previously left the input permanently disabled', async () => {
    askQuestionMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useOutfitChat());
    await act(async () => { await result.current.sendQuestion('What goes with this?'); });

    expect(result.current.errorMessage).toBe('Could not get an answer. Please try again.');
    expect(result.current.isSending).toBe(false); // never gets stuck true
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'outfit_chat_send_question');

    // Retry remains possible — isSending being false means the guard at the
    // top of sendQuestion (`if (!trimmed || isSending) return`) doesn't block it.
    askQuestionMock.mockResolvedValueOnce({ success: true, data: { answer: 'All good now.' } });
    await act(async () => { await result.current.sendQuestion('Try again'); });
    expect(result.current.errorMessage).toBeNull();
  });

  it('a second send while one is already in flight is ignored (isSending guard) — not tested for overlap here, just that the guard exists', async () => {
    let resolveFirst!: (value: unknown) => void;
    askQuestionMock.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    const { result } = renderHook(() => useOutfitChat());

    let firstSend!: Promise<void>;
    act(() => { firstSend = result.current.sendQuestion('First question'); });
    expect(result.current.isSending).toBe(true);

    // A second call while isSending is true must be a no-op (guarded at the top).
    await act(async () => { await result.current.sendQuestion('Second question'); });
    expect(askQuestionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ success: true, data: { answer: 'Answer to the first.' } });
      await firstSend;
    });
    expect(result.current.isSending).toBe(false);
  });
});
