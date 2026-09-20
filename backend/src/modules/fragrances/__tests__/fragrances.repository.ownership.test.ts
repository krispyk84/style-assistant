import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ownership pattern for this repository (matching closet.repository.ts's
// convention): every per-user query/mutation is scoped by supabaseUserId
// directly in the Prisma where clause, not a separate authorization check.
// These tests pin that every ownership-sensitive method actually includes
// supabaseUserId in its where clause, so User A can never read/mutate/delete
// User B's owned fragrance by guessing an id.

const findFirst = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();
const findUnique = vi.fn();

vi.mock('../../../db/prisma.js', () => ({
  prisma: {
    userFragrance: { findFirst, findMany, updateMany, deleteMany, findUnique },
    fragrance: {},
  },
}));

const { fragrancesRepository } = await import('../fragrances.repository.js');

beforeEach(() => {
  findFirst.mockReset();
  findMany.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
  findUnique.mockReset();
});

describe('fragrancesRepository — ownership scoping', () => {
  it('getUserFragrance scopes by id AND supabaseUserId', async () => {
    findFirst.mockResolvedValue(null);
    await fragrancesRepository.getUserFragrance('frag-1', 'userA');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'frag-1', supabaseUserId: 'userA' }, include: { fragrance: true } });
  });

  it('listUserFragrances scopes strictly to the requesting user', async () => {
    findMany.mockResolvedValue([]);
    await fragrancesRepository.listUserFragrances('userA');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { supabaseUserId: 'userA' } }));
  });

  it('updateUserFragrance scopes the update by id AND supabaseUserId — User A cannot update User B\'s row by guessing its id', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await fragrancesRepository.updateUserFragrance('bs-fragrance-id', 'userA', { isSignature: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'bs-fragrance-id', supabaseUserId: 'userA' },
      data: { isSignature: true },
    });
  });

  it('deleteUserFragrance scopes the delete by id AND supabaseUserId', async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    await fragrancesRepository.deleteUserFragrance('bs-fragrance-id', 'userA');
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'bs-fragrance-id', supabaseUserId: 'userA' } });
  });

  it('findExistingOwnership looks up via the compound (supabaseUserId, fragranceId) key, never fragranceId alone', async () => {
    findUnique.mockResolvedValue(null);
    await fragrancesRepository.findExistingOwnership('userA', 'catalog-frag-1');
    expect(findUnique).toHaveBeenCalledWith({
      where: { supabaseUserId_fragranceId: { supabaseUserId: 'userA', fragranceId: 'catalog-frag-1' } },
      include: { fragrance: true },
    });
  });
});
