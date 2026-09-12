import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Phase R7B — closetSketchService.reconcileStaleSketchJobs, the service-level
// wrapper around closetRepository.reconcileStaleSketchJobs (query-shape
// proof lives in closet-sketch-job-reconciliation.test.ts). This file proves
// the cutoff Date passed down is derived from the same STALE_PENDING_MS
// window already established for the identical failure mode elsewhere in
// this repo (trend-sketch.service.ts's retryStuckSketches, STALE_MS = 10
// minutes), and that a repository failure is never swallowed here — the
// scheduler tick that calls this function owns the .catch() guard, matching
// every existing reconciliation precedent (pruneOutfitHistory,
// retryStuckSketches, etc.).

const reconcileStaleSketchJobs = vi.fn();

vi.mock('../closet.repository.js', () => ({
  closetRepository: { reconcileStaleSketchJobs },
}));

const { closetSketchService } = await import('../closet-sketch.service.js');

beforeEach(() => {
  reconcileStaleSketchJobs.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('closetSketchService.reconcileStaleSketchJobs', () => {
  it('passes a cutoff exactly 10 minutes before now — the same window already established for this failure mode elsewhere in the repo', async () => {
    reconcileStaleSketchJobs.mockResolvedValue(0);
    await closetSketchService.reconcileStaleSketchJobs();
    const cutoff: Date = reconcileStaleSketchJobs.mock.calls[0][0];
    expect(cutoff.toISOString()).toBe('2026-01-01T11:50:00.000Z');
  });

  it('returns the reconciled count from the repository unchanged', async () => {
    reconcileStaleSketchJobs.mockResolvedValue(4);
    const result = await closetSketchService.reconcileStaleSketchJobs();
    expect(result).toBe(4);
  });

  it('does not swallow a repository failure — propagates so the scheduler tick\'s own .catch() is what protects the process', async () => {
    reconcileStaleSketchJobs.mockRejectedValue(new Error('db unavailable'));
    await expect(closetSketchService.reconcileStaleSketchJobs()).rejects.toThrow('db unavailable');
  });
});
