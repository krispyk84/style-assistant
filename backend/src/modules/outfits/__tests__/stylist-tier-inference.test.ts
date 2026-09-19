import { describe, expect, it, vi, beforeEach } from 'vitest';

const createStructuredResponse = vi.fn();
vi.mock('../../../ai/openai-client.js', () => ({
  openAiClient: { createStructuredResponse },
}));

const { inferStylistBriefTier } = await import('../stylist-tier-inference.js');

// ── What this file is ───────────────────────────────────────────────────────
//
// "Ask a Stylist" has no explicit formality picker — this classification
// step is what stands in for it, and it must run BEFORE the real generation
// call (the closet-only shortlist/rule scaffolding is built per-tier, so the
// tier has to be known first). Tests the deterministic request construction
// (schema, feature tag, prompt content) and the pass-through of whatever
// tier the model returns — not the model's actual judgment.

beforeEach(() => {
  createStructuredResponse.mockReset();
});

describe('inferStylistBriefTier', () => {
  it('calls openAiClient.createStructuredResponse with the brief text and the stylist-tier-inference feature tag', async () => {
    createStructuredResponse.mockResolvedValue({ tier: 'smart-casual' });

    await inferStylistBriefTier('drinks with friends downtown', 'user-1');

    expect(createStructuredResponse).toHaveBeenCalledTimes(1);
    const call = createStructuredResponse.mock.calls[0]![0];
    expect(call.feature).toBe('stylist-tier-inference');
    expect(call.supabaseUserId).toBe('user-1');
    expect(call.userContent[0].text).toContain('drinks with friends downtown');
  });

  it('returns the tier the model chose', async () => {
    createStructuredResponse.mockResolvedValue({ tier: 'business' });
    const tier = await inferStylistBriefTier('important client meeting', 'user-1');
    expect(tier).toBe('business');
  });

  it('the request schema only allows the three real tiers', async () => {
    createStructuredResponse.mockResolvedValue({ tier: 'casual' });
    await inferStylistBriefTier('weekend errands', 'user-1');
    const call = createStructuredResponse.mock.calls[0]![0];
    expect(call.jsonSchema.schema.properties.tier.enum).toEqual(['business', 'smart-casual', 'casual']);
  });
});
