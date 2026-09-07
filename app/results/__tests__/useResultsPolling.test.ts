// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GenerateOutfitsResponse } from '@/types/api';
import type { LookTierSlug } from '@/types/look-request';

const { getOutfitResultMock } = vi.hoisted(() => ({ getOutfitResultMock: vi.fn() }));
vi.mock('@/services/outfits', () => ({ outfitsService: { getOutfitResult: getOutfitResultMock } }));

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({ recordError: recordErrorMock, log: vi.fn() }));

const { useResultsPolling } = await import('@/app/results/useResultsPolling');

function fakeResponse(requestId: string, statuses: ('pending' | 'ready')[]): GenerateOutfitsResponse {
  return {
    requestId,
    recommendations: statuses.map((sketchStatus, i) => ({ tier: `tier-${i}` as LookTierSlug, sketchStatus })),
  } as unknown as GenerateOutfitsResponse;
}

function poll(response: GenerateOutfitsResponse) {
  const setResponse = vi.fn();
  const regeneratingTiersRef = { current: [] as LookTierSlug[] };
  const rendered = renderHook(() => useResultsPolling({ response, loadingTiers: [], regeneratingTiersRef, setResponse }));
  return { ...rendered, setResponse };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useResultsPolling', () => {
  it('only one async poll can be active at a time — an overlapping tick is skipped, not run in parallel', async () => {
    let resolveFirst!: (value: unknown) => void;
    getOutfitResultMock.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    poll(fakeResponse('req-1', ['pending']));

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1);

    // A second interval tick fires while the first call is still awaiting.
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1); // still 1 — the overlapping tick was skipped

    await act(async () => {
      resolveFirst({ success: true, data: fakeResponse('req-1', ['pending']) });
      await Promise.resolve();
    });
  });

  it('polling continues normally after the active request completes', async () => {
    getOutfitResultMock.mockResolvedValue({ success: true, data: fakeResponse('req-1', ['pending']) });

    poll(fakeResponse('req-1', ['pending']));

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(2);
  });

  it('cleanup (unmount) stops polling', async () => {
    getOutfitResultMock.mockResolvedValue({ success: true, data: fakeResponse('req-1', ['pending']) });

    const { unmount } = poll(fakeResponse('req-1', ['pending']));

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1); // no further calls after unmount
  });

  it('the completion condition (no pending tiers) never schedules a poll at all', async () => {
    poll(fakeResponse('req-1', ['ready']));
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(getOutfitResultMock).not.toHaveBeenCalled();
  });

  it('a rejected poll tick is logged, not left as an unhandled rejection, and polling continues on the next tick', async () => {
    getOutfitResultMock
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ success: true, data: fakeResponse('req-1', ['pending']) });

    poll(fakeResponse('req-1', ['pending']));

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'results_polling_tick_failed');

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(2); // the failed tick didn't kill polling
  });
});
