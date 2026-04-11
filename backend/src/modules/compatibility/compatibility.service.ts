import type { AnalysisRequest, AnalysisResponse } from '../../contracts/analysis.contracts.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput, resolveImageUrlForAI } from '../../ai/image-input.js';
import { compatibilityJsonSchema, compatibilityModelSchema } from './analysis.schemas.js';
import { buildCompatibilityInstructions, buildCompatibilityUserPrompt } from '../../ai/prompts/analysis.prompts.js';
import { profileRepository } from '../profile/profile.repository.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { compatibilityRepository } from './compatibility.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';

export const compatibilityService = {
  async createCheck(input: AnalysisRequest, supabaseUserId: string) {
    const uploadedImage = input.imageId ? await uploadsRepository.findById(input.imageId) : null;
    const profile = input.profileId ? await profileRepository.findById(input.profileId) : await profileRepository.findByUserId(supabaseUserId);
    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'compatibility-check',
      query: [
        'menswear compatibility guidance for evaluating a candidate piece',
        input.pieceName ? `piece: ${input.pieceName}` : null,
        input.anchorItemDescription ? `anchor item: ${input.anchorItemDescription}` : null,
        input.outfitTitle ? `outfit title: ${input.outfitTitle}` : null,
        input.tier ? `tier: ${input.tier}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    });
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildCompatibilityUserPrompt({
          profile,
          outfitTitle: input.outfitTitle,
          anchorItemDescription: input.anchorItemDescription,
          tier: input.tier,
          pieceName: input.pieceName,
          candidateItemDescription: input.candidateItemDescription,
          imageFilename: input.imageFilename ?? uploadedImage?.originalFilename ?? undefined,
          styleGuideContext: styleGuideContext?.promptContext,
        }),
      },
    ];

    if (uploadedImage) {
      userContent.push(await buildModelImageInput(uploadedImage));
    } else if (input.imageUrl) {
      const imageInput = await resolveImageUrlForAI(input.imageUrl);
      if (imageInput) userContent.push(imageInput);
    }

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: compatibilityModelSchema,
      jsonSchema: {
        name: 'candidate_piece_compatibility',
        description: 'Compatibility verdict for a candidate menswear piece.',
        schema: compatibilityJsonSchema,
      },
      instructions: buildCompatibilityInstructions(profile?.gender),
      userContent,
      supabaseUserId,
      feature: 'compatibility-check',
    });

    const output: AnalysisResponse = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      verdict: aiOutput.verdict,
      explanation: aiOutput.explanation,
      concerns: aiOutput.concerns,
      suggestedAlternatives: aiOutput.suggestedAlternatives,
      stylistNotes: [aiOutput.explanation, ...aiOutput.concerns.map((concern: string) => `Concern: ${concern}`)],
      suggestedChanges: aiOutput.suggestedAlternatives,
    };

    await compatibilityRepository.create({
      profileId: input.profileId,
      imageId: uploadedImage?.id,
      imageUrl: input.imageUrl ?? uploadedImage?.publicUrl,
      imageKey: uploadedImage?.storageKey,
      imageFilename: input.imageFilename ?? uploadedImage?.originalFilename ?? undefined,
      imageMimeType: uploadedImage?.mimeType ?? undefined,
      imageWidth: uploadedImage?.width ?? undefined,
      imageHeight: uploadedImage?.height ?? undefined,
      imageSizeBytes: uploadedImage?.sizeBytes ?? undefined,
      output,
    });

    return output;
  },
};
