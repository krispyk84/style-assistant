import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase R7B — stale ClosetSketchJob reconciliation. Mocks prisma directly
// (same convention as closet-outfit-sync.repository.phase1a.test.ts) so this
// runs DB-free. The atomic-CAS behavior of Postgres's own UPDATE ... WHERE
// (that a concurrent completion write really does exclude that row from a
// simultaneous updateMany, per that same repository test's precedent note)
// is a property of the database engine, not re-simulated here — this file
// proves OUR code builds the right query: the right predicate (status +
// age), the right terminal transition, and nothing else (no delete, no
// read-then-write gap that could race).

const updateMany = vi.fn();

vi.mock('../../../db/prisma.js', () => ({
  prisma: {
    closetSketchJob: { updateMany },
  },
}));

const { closetRepository } = await import('../closet.repository.js');

beforeEach(() => {
  updateMany.mockReset();
});

describe('closetRepository.reconcileStaleSketchJobs', () => {
  it('issues a single atomic updateMany — no prior read, no per-row loop', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    await closetRepository.reconcileStaleSketchJobs(cutoff);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('the predicate matches ONLY pending jobs older than the cutoff — this is the entire race-safety and eligibility guarantee', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    await closetRepository.reconcileStaleSketchJobs(cutoff);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'pending', createdAt: { lt: cutoff } },
      }),
    );
  });

  it('transitions eligible rows to "failed" (an already-understood terminal status) — never deletes, never rewrites a ready row', async () => {
    updateMany.mockResolvedValue({ count: 3 });
    await closetRepository.reconcileStaleSketchJobs(new Date());
    const call = updateMany.mock.calls[0][0];
    expect(call.data.status).toBe('failed');
  });

  it('nulls every image/storage field on the rows it touches — no stale blob/url left dangling on a job now marked failed', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await closetRepository.reconcileStaleSketchJobs(new Date());
    const call = updateMany.mock.calls[0][0];
    expect(call.data.sketchImageUrl).toBeNull();
    expect(call.data.sketchStorageKey).toBeNull();
    expect(call.data.sketchMimeType).toBeNull();
    expect(call.data.sketchImageData).toBeNull();
  });

  it('records a distinct, filterable error code and a human-readable message', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await closetRepository.reconcileStaleSketchJobs(new Date());
    const call = updateMany.mock.calls[0][0];
    expect(call.data.sketchErrorCode).toBe('SKETCH_JOB_STALE');
    expect(typeof call.data.sketchErrorMessage).toBe('string');
    expect(call.data.sketchErrorMessage.length).toBeGreaterThan(0);
  });

  it('returns the number of rows the database actually matched and updated', async () => {
    updateMany.mockResolvedValue({ count: 7 });
    const result = await closetRepository.reconcileStaleSketchJobs(new Date());
    expect(result).toBe(7);
  });

  it('is idempotent: running it twice in a row is safe — the second run finds nothing left to touch (predicate excludes already-failed rows)', async () => {
    updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 0 });
    const cutoff = new Date();
    const first = await closetRepository.reconcileStaleSketchJobs(cutoff);
    const second = await closetRepository.reconcileStaleSketchJobs(cutoff);
    expect(first).toBe(2);
    expect(second).toBe(0);
    // Both calls used the identical status-scoped predicate — a row this
    // function already flipped to 'failed' can never match a later call's
    // where clause again, by construction, not by any run-tracking state.
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { status: 'pending', createdAt: { lt: cutoff } } }));
    expect(updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { status: 'pending', createdAt: { lt: cutoff } } }));
  });

  it('propagates a database error rather than swallowing it — the caller (the scheduler tick) is responsible for the .catch() guard, matching every existing reconciliation precedent', async () => {
    updateMany.mockRejectedValue(new Error('db unavailable'));
    await expect(closetRepository.reconcileStaleSketchJobs(new Date())).rejects.toThrow('db unavailable');
  });
});
