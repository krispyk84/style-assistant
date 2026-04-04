import type { SecondOpinionService } from '@/services/second-opinion/second-opinion-service';

export const mockSecondOpinionService: SecondOpinionService = {
  async getOpinion(request) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      success: true,
      data: {
        id: 'mock-opinion-1',
        stylistId: request.stylistId,
        perspective:
          request.stylistId === 'vittorio'
            ? 'The foundation here is genuinely good — the anchor piece has real authority and the palette is disciplined. What I would look at next is the trouser break and the collar space, because those two things will either confirm the intention or quietly undermine it. The accessories are sound but perhaps a touch too harmonious; a single material contrast would give the whole thing more character without disrupting what is already working.'
            : 'Okay, there is something real here — I like the tonal restraint, it shows a certain confidence. But I want to push you slightly: this reads very safe for someone who clearly has good taste. The silhouette is solid but it is not saying anything yet. One stronger choice — in the shoe, the outer layer, or even just the watch strap — and this goes from considered to genuinely interesting.',
        suggestions: [
          'Bring the trouser break to half-break — it sharpens the whole leg line.',
          'Swap one accessory for something with a different material register, leather against cloth or matte against shine.',
          'Consider an unstructured layer in the same weight cloth — it adds depth without breaking the palette.',
        ],
        createdAt: new Date().toISOString(),
      },
      error: null,
    };
  },
};
