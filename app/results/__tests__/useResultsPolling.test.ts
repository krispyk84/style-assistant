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

// Phase R3B: useResultsPolling is now a generic N-target batch poller (both
// [requestId].tsx and MultiLookResults.tsx call the same hook) — these
// tests exercise it the way the single-response caller does: one target,
// key === 'main', requestId fixed. The batching/isolation behavior across
// MULTIPLE simultaneous targets is covered by
// MultiLookResults.characterization.test.tsx, which is the real multi-target
// caller; duplicating that here would just be the same assertions twice.
function poll(requestId: string) {
  const onResult = vi.fn();
  const rendered = renderHook(() => useResultsPolling({ targets: [{ key: 'main', requestId }], onResult }));
  return { ...rendered, onResult };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useResultsPolling', () => {
  it('only one async poll batch can be active at a time — an overlapping tick is skipped, not run in parallel', async () => {
    let resolveFirst!: (value: unknown) => void;
    getOutfitResultMock.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    poll('req-1');

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

  it('polling continues normally after the active request completes, and onResult is called with the target\'s key', async () => {
    getOutfitResultMock.mockResolvedValue({ success: true, data: fakeResponse('req-1', ['pending']) });

    const { onResult } = poll('req-1');

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('main', fakeResponse('req-1', ['pending']));
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(2);
  });

  it('cleanup (unmount) stops polling', async () => {
    getOutfitResultMock.mockResolvedValue({ success: true, data: fakeResponse('req-1', ['pending']) });

    const { unmount } = poll('req-1');

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(1); // no further calls after unmount
  });

  it('an empty target list never schedules a poll at all', async () => {
    const onResult = vi.fn();
    renderHook(() => useResultsPolling({ targets: [], onResult }));
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(getOutfitResultMock).not.toHaveBeenCalled();
  });

  it('a rejected poll tick is logged, not left as an unhandled rejection, and polling continues on the next tick', async () => {
    getOutfitResultMock
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ success: true, data: fakeResponse('req-1', ['pending']) });

    poll('req-1');

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'results_polling_tick_failed');

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getOutfitResultMock).toHaveBeenCalledTimes(2); // the failed tick didn't kill polling
  });

  it('a stable target list (same key+requestId content, fresh array each render) does not recreate the interval', async () => {
    getOutfitResultMock.mockResolvedValue({ success: true, data: fakeResponse('req-1', ['pending']) });
    const onResult = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const { rerender } = renderHook(
      ({ requestId }) => useResultsPolling({ targets: [{ key: 'main', requestId }], onResult }),
      { initialProps: { requestId: 'req-1' } },
    );
    const callsAfterMount = setIntervalSpy.mock.calls.length;

    // Fresh array, same content — must not recreate the interval.
    rerender({ requestId: 'req-1' });
    expect(setIntervalSpy.mock.calls.length).toBe(callsAfterMount);
  });
});
