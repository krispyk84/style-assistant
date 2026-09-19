import { describe, it, expect, vi, beforeEach } from 'vitest';

const findById = vi.fn();
const findExistingOwnership = vi.fn();
const createUserFragrance = vi.fn();
const getUserFragrance = vi.fn();
const deleteUserFragrance = vi.fn();
const updateUserFragrance = vi.fn();

vi.mock('../fragrances.repository.js', () => ({
  fragrancesRepository: {
    findById,
    findExistingOwnership,
    createUserFragrance,
    getUserFragrance,
    deleteUserFragrance,
    updateUserFragrance,
  },
}));

vi.mock('../fragrance-profile.service.js', () => ({
  resolveFragranceProfile: vi.fn(),
  createOrReuseManualFragrance: vi.fn(),
}));

vi.mock('../fragrance-sketch.service.js', () => ({
  fragranceSketchService: { startSketchJob: vi.fn(), getSketchJobStatus: vi.fn() },
}));

const { fragrancesService } = await import('../fragrances.service.js');

beforeEach(() => {
  findById.mockReset();
  findExistingOwnership.mockReset();
  createUserFragrance.mockReset();
  getUserFragrance.mockReset();
  deleteUserFragrance.mockReset();
  updateUserFragrance.mockReset();
});

describe('fragrancesService.addToCloset', () => {
  it('404s when the catalog fragrance does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      fragrancesService.addToCloset({ fragranceId: 'missing' }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(createUserFragrance).not.toHaveBeenCalled();
  });

  it('409s when the user already owns this fragrance', async () => {
    findById.mockResolvedValue({ id: 'frag-1' });
    findExistingOwnership.mockResolvedValue({ id: 'existing-ownership' });

    await expect(
      fragrancesService.addToCloset({ fragranceId: 'frag-1' }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(createUserFragrance).not.toHaveBeenCalled();
  });

  it('creates ownership when the fragrance exists and is not yet owned', async () => {
    findById.mockResolvedValue({ id: 'frag-1' });
    findExistingOwnership.mockResolvedValue(null);
    createUserFragrance.mockResolvedValue({ id: 'owned-1', fragranceId: 'frag-1' });

    await fragrancesService.addToCloset({ fragranceId: 'frag-1', isSignature: true }, 'user-1');

    expect(createUserFragrance).toHaveBeenCalledWith(
      expect.objectContaining({ supabaseUserId: 'user-1', fragranceId: 'frag-1', isSignature: true }),
    );
  });
});

describe('fragrancesService.removeUserFragrance', () => {
  it('deletes only the UserFragrance ownership row — never touches the shared catalog', async () => {
    getUserFragrance.mockResolvedValue({ id: 'owned-1' });
    deleteUserFragrance.mockResolvedValue({ count: 1 });

    const result = await fragrancesService.removeUserFragrance('owned-1', 'user-1');

    expect(result).toEqual({ deleted: true });
    expect(deleteUserFragrance).toHaveBeenCalledWith('owned-1', 'user-1');
  });

  it('404s when the fragrance is not owned by this user', async () => {
    getUserFragrance.mockResolvedValue(null);

    await expect(fragrancesService.removeUserFragrance('not-mine', 'user-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(deleteUserFragrance).not.toHaveBeenCalled();
  });
});
