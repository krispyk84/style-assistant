import { openAiClient } from '../../ai/openai-client.js';
import { secondOpinionJsonSchema, secondOpinionModelSchema } from './second-opinion.schemas.js';
import { buildSecondOpinionInstructions, buildSecondOpinionUserPrompt, type StylistId } from '../../ai/prompts/second-opinion.prompts.js';
import { profileRepository } from '../profile/profile.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';

export type SecondOpinionRequest = {
  stylistId: StylistId;
  profileId?: string;
  outfitTitle?: string;
  tier?: string;
  anchorItem?: string;
  keyPieces?: string[];
  shoes?: string[];
  accessories?: string[];
  fitNotes?: string[];
  whyItWorks?: string;
  stylingDirection?: string;
};

export type SecondOpinionResponse = {
  id: string;
  stylistId: StylistId;
  perspective: string;
  createdAt: string;
};

export const secondOpinionService = {
  async createOpinion(input: SecondOpinionRequest, supabaseUserId: string): Promise<SecondOpinionResponse> {
    const profile = input.profileId
      ? await profileRepository.findById(input.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    // No-ops (returns null) unless a style guide has actually been uploaded and
    // STYLE_GUIDE_ENABLED is on — see backend/scripts/setup-style-guide.ts.
    const guidance = await styleGuideService.retrieveGuidance({
      task: 'second-opinion',
      query: [
        'current menswear trends, key aesthetic directions, standout pieces, styling philosophy',
        input.outfitTitle,
        ...(input.keyPieces ?? []),
        ...(input.shoes ?? []),
        ...(input.accessories ?? []),
      ].filter(Boolean).join(', '),
    });

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: secondOpinionModelSchema,
      jsonSchema: {
        name: 'second_opinion_on_outfit',
        description: profile?.gender === 'woman' ? 'A stylist\'s second opinion on a recommended womenswear outfit.' : 'A stylist\'s second opinion on a recommended menswear outfit.',
        schema: secondOpinionJsonSchema,
      },
      instructions: buildSecondOpinionInstructions(input.stylistId, profile?.gender),
      userContent: [
        {
          type: 'input_text',
          text: buildSecondOpinionUserPrompt({
            profile,
            stylistId: input.stylistId,
            outfitTitle: input.outfitTitle,
            tier: input.tier,
            anchorItem: input.anchorItem,
            keyPieces: input.keyPieces,
            shoes: input.shoes,
            accessories: input.accessories,
            fitNotes: input.fitNotes,
            whyItWorks: input.whyItWorks,
            stylingDirection: input.stylingDirection,
            styleGuideContext: guidance?.promptContext,
          }),
        },
      ],
      supabaseUserId,
      feature: 'second-opinion',
    });

    return {
      id: crypto.randomUUID(),
      stylistId: input.stylistId,
      perspective: aiOutput.perspective,
      createdAt: new Date().toISOString(),
    };
  },
};
