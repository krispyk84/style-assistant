import { openAiClient } from '../../ai/openai-client.js';
import { buildOutfitChatInstructions, buildOutfitChatUserPrompt, type OutfitChatMessage } from '../../ai/prompts/outfit-chat.prompts.js';
import { profileRepository } from '../profile/profile.repository.js';
import { outfitChatJsonSchema, outfitChatModelSchema } from './outfit-chat.schemas.js';

export type OutfitChatRequest = {
  profileId?: string;
  question: string;
  history?: OutfitChatMessage[];
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

export type OutfitChatResponse = {
  answer: string;
};

export const outfitChatService = {
  async askQuestion(input: OutfitChatRequest, supabaseUserId: string): Promise<OutfitChatResponse> {
    const profile = input.profileId
      ? await profileRepository.findById(input.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: outfitChatModelSchema,
      jsonSchema: {
        name: 'outfit_chat_answer',
        description: 'A stylist\'s direct answer to a follow-up question about a specific recommended outfit.',
        schema: outfitChatJsonSchema,
      },
      instructions: buildOutfitChatInstructions(profile?.gender),
      userContent: [
        {
          type: 'input_text',
          text: buildOutfitChatUserPrompt({
            profile,
            question: input.question,
            history: input.history,
            outfitTitle: input.outfitTitle,
            tier: input.tier,
            anchorItem: input.anchorItem,
            keyPieces: input.keyPieces,
            shoes: input.shoes,
            accessories: input.accessories,
            fitNotes: input.fitNotes,
            whyItWorks: input.whyItWorks,
            stylingDirection: input.stylingDirection,
          }),
        },
      ],
      supabaseUserId,
      feature: 'outfit-chat',
    });

    return { answer: aiOutput.answer };
  },
};
