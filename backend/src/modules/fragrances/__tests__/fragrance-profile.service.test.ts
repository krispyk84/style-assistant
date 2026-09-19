import { describe, it, expect, vi, beforeEach } from 'vitest';

// Catalog-first ingestion flow (spec section 9): a catalog hit by canonical
// key must make ZERO LLM calls; only a miss calls the LLM, and even then the
// LLM's own (possibly corrected) canonical key is re-checked against the
// catalog before creating a new row, so two users' typo-variant inputs don't
// duplicate a catalog entry.

const createStructuredResponse = vi.fn();
vi.mock('../../../ai/openai-client.js', () => ({
  openAiClient: { createStructuredResponse },
}));

vi.mock('../../../ai/image-input.js', () => ({
  resolveImageUrlForAI: vi.fn(async () => null),
}));

const findByCanonicalKey = vi.fn();
const createFragrance = vi.fn();
vi.mock('../fragrances.repository.js', () => ({
  fragrancesRepository: { findByCanonicalKey, createFragrance },
}));

const { resolveFragranceProfile, createOrReuseManualFragrance } = await import('../fragrance-profile.service.js');

beforeEach(() => {
  createStructuredResponse.mockReset();
  findByCanonicalKey.mockReset();
  createFragrance.mockReset();
});

describe('resolveFragranceProfile — catalog-first ingestion', () => {
  it('a catalog hit by canonical key makes zero LLM calls', async () => {
    const existing = { id: 'cat-1', brand: 'Le Labo', name: 'Santal 33', concentration: 'Eau de Parfum' };
    findByCanonicalKey.mockResolvedValueOnce(existing);

    const result = await resolveFragranceProfile({
      brand: 'Le Labo',
      name: 'Santal 33',
      concentration: 'Eau de Parfum',
      supabaseUserId: 'user-1',
    });

    expect(result).toEqual({ status: 'found', fragrance: existing });
    expect(createStructuredResponse).not.toHaveBeenCalled();
  });

  it('a catalog miss calls the LLM exactly once', async () => {
    findByCanonicalKey.mockResolvedValue(null); // miss both the input-key check and the post-LLM re-check
    createStructuredResponse.mockResolvedValueOnce({
      recognized: true,
      confidence: 0.9,
      canonicalBrand: 'Dior',
      canonicalName: 'Sauvage',
      concentration: 'Eau de Toilette',
    });
    createFragrance.mockResolvedValueOnce({ id: 'new-1', brand: 'Dior', name: 'Sauvage' });

    const result = await resolveFragranceProfile({
      brand: 'Dior',
      name: 'Sauvage',
      supabaseUserId: 'user-1',
    });

    expect(createStructuredResponse).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('created');
  });

  it('re-checks the catalog by the LLM\'s own corrected canonical key before creating a new row — prevents typo-variant duplicates', async () => {
    // Miss on the raw input key, but the LLM corrects the name and that
    // corrected key DOES already exist in the catalog.
    const correctedExisting = { id: 'existing-corrected', brand: 'Dior', name: 'Sauvage' };
    findByCanonicalKey
      .mockResolvedValueOnce(null) // input-key check (typo miss)
      .mockResolvedValueOnce(correctedExisting); // post-LLM corrected-key check (hit)

    createStructuredResponse.mockResolvedValueOnce({
      recognized: true,
      confidence: 0.95,
      canonicalBrand: 'Dior',
      canonicalName: 'Sauvage', // LLM corrected "Savage" -> "Sauvage"
      concentration: null,
    });

    const result = await resolveFragranceProfile({
      brand: 'Dior',
      name: 'Savage', // user typo
      supabaseUserId: 'user-1',
    });

    expect(result).toEqual({ status: 'found', fragrance: correctedExisting });
    expect(createFragrance).not.toHaveBeenCalled();
  });

  it('returns needs_review when the model\'s confidence is below the recognition threshold, without creating a catalog row', async () => {
    findByCanonicalKey.mockResolvedValue(null);
    createStructuredResponse.mockResolvedValueOnce({
      recognized: true,
      confidence: 0.3,
      canonicalBrand: 'Unknown Brand',
      canonicalName: 'Mystery Scent',
      concentration: null,
    });

    const result = await resolveFragranceProfile({ imageUrl: 'https://example.com/bottle.jpg', supabaseUserId: 'user-1' });

    expect(result.status).toBe('needs_review');
    expect(createFragrance).not.toHaveBeenCalled();
  });
});

describe('createOrReuseManualFragrance — no-AI manual fallback', () => {
  it('never calls the LLM', async () => {
    findByCanonicalKey.mockResolvedValueOnce(null);
    createFragrance.mockResolvedValueOnce({ id: 'manual-1', brand: 'House', name: 'Scent' });

    await createOrReuseManualFragrance({ brand: 'House', name: 'Scent' });

    expect(createStructuredResponse).not.toHaveBeenCalled();
  });

  it('still dedupes against the catalog by canonical key', async () => {
    const existing = { id: 'existing-manual', brand: 'House', name: 'Scent' };
    findByCanonicalKey.mockResolvedValueOnce(existing);

    const result = await createOrReuseManualFragrance({ brand: 'House', name: 'Scent' });

    expect(result).toBe(existing);
    expect(createFragrance).not.toHaveBeenCalled();
  });
});
