import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// This session's fix: the legacy upsertFavourite path (still used by the
// installed frontend) had no ownership check — `where: { id }` alone lets
// any caller silently overwrite another user's favourite content if they
// know/reuse that id. Verifies the fix (update scoped by supabaseUserId,
// falling through to create only when nothing this caller owns was
// updated) without touching a live database, same convention as this
// module's other repository tests.

const create = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

vi.mock('../../../db/prisma.js', () => ({
  prisma: {
    closetOutfitFavourite: { create, updateMany, deleteMany },
  },
}));

const { closetOutfitSyncRepository } = await import('../closet-outfit-sync.repository.js');

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

beforeEach(() => {
  create.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
});

describe('closetOutfitSyncRepository.upsertFavourite — ownership fix', () => {
  it('updates User A\'s own existing favourite, scoped by id AND supabaseUserId', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await closetOutfitSyncRepository.upsertFavourite({ id: 'f1', supabaseUserId: 'userA', formality: 'Business', outfit: { a: 1 }, savedAt: '2026-01-02' });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'f1', supabaseUserId: 'userA' },
      data: { formality: 'Business', outfit: { a: 1 }, savedAt: '2026-01-02' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a brand-new favourite for User A when nothing existed yet (update matches 0 rows, create succeeds)', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    create.mockResolvedValue({ id: 'f2', supabaseUserId: 'userA', formality: 'Casual', outfit: {}, savedAt: '2026-01-01' });

    await closetOutfitSyncRepository.upsertFavourite({ id: 'f2', supabaseUserId: 'userA', formality: 'Casual', outfit: {}, savedAt: '2026-01-01' });

    expect(create).toHaveBeenCalledWith({
      data: { id: 'f2', supabaseUserId: 'userA', formality: 'Casual', outfit: {}, savedAt: '2026-01-01' },
    });
  });

  it('does NOT overwrite User B\'s favourite when User A submits B\'s id: update matches nothing, create hits the PK conflict, error is swallowed', async () => {
    updateMany.mockResolvedValue({ count: 0 }); // A doesn't own id 'f1' (it's B's), so the ownership-scoped update matches nothing
    create.mockRejectedValue(p2002()); // id 'f1' already exists (owned by B) — PK conflict

    await expect(
      closetOutfitSyncRepository.upsertFavourite({ id: 'f1', supabaseUserId: 'userA', formality: 'Business', outfit: { attacker: true }, savedAt: '2026-01-02' })
    ).resolves.toBeUndefined();

    // The critical assertion: no call ever targeted B's row without an
    // owner check, and the content update that WOULD have corrupted B's
    // row was scoped to an id+owner pair that doesn't exist for A.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'f1', supabaseUserId: 'userA' },
      data: { formality: 'Business', outfit: { attacker: true }, savedAt: '2026-01-02' },
    });
  });

  it('rethrows a non-P2002 error from create instead of swallowing it', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    create.mockRejectedValue(new Error('connection lost'));

    await expect(
      closetOutfitSyncRepository.upsertFavourite({ id: 'f1', supabaseUserId: 'userA', formality: 'Business', outfit: {}, savedAt: '2026-01-02' })
    ).rejects.toThrow('connection lost');
  });
});

describe('closetOutfitSyncRepository.deleteFavourite — was already ownership-scoped, confirmed unchanged', () => {
  it('scopes the delete by both id and supabaseUserId, so User A cannot delete User B\'s favourite by knowing its id', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await closetOutfitSyncRepository.deleteFavourite('f1', 'userA');

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'f1', supabaseUserId: 'userA' } });
  });
});
