import type { ApiResponse, ClosetFitCheckRequest, ClosetFitCheckResponse } from '@/types/api';
import type { ClosetFitCheckService } from './closet-fit-check-service';

const MOCK_WEIGHTS = {
  profileFit: 0.3,
  utility: 0.25,
  redundancyComplementarity: 0.2,
  stylistOpinion: 0.15,
  trendiness: 0.1,
};

export const mockClosetFitCheckService: ClosetFitCheckService = {
  async evaluate(request: ClosetFitCheckRequest): Promise<ApiResponse<ClosetFitCheckResponse>> {
    const scores = {
      trendiness: 72,
      profileFit: 68,
      redundancyComplementarity: 55,
      stylistOpinion: 70,
      utility: 60,
    };
    const overallScore = Math.round(
      scores.trendiness * MOCK_WEIGHTS.trendiness +
        scores.profileFit * MOCK_WEIGHTS.profileFit +
        scores.redundancyComplementarity * MOCK_WEIGHTS.redundancyComplementarity +
        scores.stylistOpinion * MOCK_WEIGHTS.stylistOpinion +
        scores.utility * MOCK_WEIGHTS.utility,
    );
    return {
      success: true,
      data: {
        item: {
          title: 'Sample Sport Coat',
          category: 'Blazer',
          primaryColor: 'Camel',
          colorFamily: 'camel',
          material: 'Wool blend',
          formality: 'Refined Casual',
        },
        scores,
        weights: MOCK_WEIGHTS,
        overallScore,
        verdict: overallScore >= 80 ? 'strong-buy' : overallScore >= 65 ? 'worth-considering' : overallScore >= 50 ? 'only-if-you-love-it' : 'skip',
        summary: 'A solid piece that fits your direction, but consider the overlap with what you already own.',
        reasoning: {
          trendiness: 'Reads current without chasing a trend — the silhouette and material would not date quickly.',
          profileFit: 'Aligns with the smart-casual direction in your profile and harmonises with your warmer neutrals.',
          redundancyComplementarity: 'Adds a different texture to your jacket rotation, though there is some overlap with what you already own.',
          stylistOpinion: 'Well-considered design, restrained details, good proportions for everyday wear.',
          utility: 'Pairs cleanly with most of your trousers and several knits — strong rotation potential.',
        },
        closetImpact: 'Slots between your existing tailoring and casual outerwear. Some overlap with similar items in your closet, but a meaningfully different texture and tone.',
        stylistTake: 'It is a good piece, not a great one. If you find yourself reaching for similar items often, it earns its place; if not, it sits at the back of the closet.',
        similarClosetItemIds: [],
        imageUrl: request.uploadedImageUrl,
      },
      error: null,
    };
  },
};
