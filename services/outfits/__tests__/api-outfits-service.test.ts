import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Proves the selected stylist actually reaches the generation request body
// — not just the UI/navigation params (covered by
// StylistOutfitFormContainer.test.tsx) — completing the chain from stylist
// selection to the backend prompt layer (persona construction itself is
// proven separately, backend-side, in stylist-generation-persona.prompts.test.ts).

const requestMock = vi.fn();
vi.mock('@/lib/api/api-client', () => ({ createApiClient: () => ({ request: requestMock }) }));
vi.mock('@/services/outfits/mock-outfits-service', () => ({ mockOutfitsService: {} }));
vi.mock('@/services/outfits/outfits-response-normalizers', () => ({
  normalizeOutfitResponse: (data: unknown) => data,
}));

const { apiOutfitsService } = await import('@/services/outfits/api-outfits-service');

const BASE_REQUEST = {
  requestId: 'req-1',
  anchorItems: [],
  anchorItemDescription: 'navy blazer',
  photoPending: false,
  selectedTiers: ['smart-casual'] as const,
};

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({ success: true, data: { requestId: 'req-1', recommendations: [] }, error: null });
});

describe('apiOutfitsService.generateOutfits — stylistId', () => {
  it('includes stylistId in the request body when set', async () => {
    await apiOutfitsService.generateOutfits({ ...BASE_REQUEST, stylistId: 'vittorio' } as any);
    const [, options] = requestMock.mock.calls[0]!;
    expect(options.body.stylistId).toBe('vittorio');
  });

  it('is undefined for the original structured-form flow, which never sets it', async () => {
    await apiOutfitsService.generateOutfits(BASE_REQUEST as any);
    const [, options] = requestMock.mock.calls[0]!;
    expect(options.body.stylistId).toBeUndefined();
  });

  it('still hits the same /outfits/generate endpoint either way — no separate stylist endpoint for generation itself', async () => {
    await apiOutfitsService.generateOutfits({ ...BASE_REQUEST, stylistId: 'alessandra' } as any);
    const [path] = requestMock.mock.calls[0]!;
    expect(path).toBe('/outfits/generate');
  });
});
