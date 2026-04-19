import type { AnalysisRequest, AnalysisResponse } from '../../contracts/analysis.contracts.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput, resolveImageUrlForAI } from '../../ai/image-input.js';
import { selfieReviewJsonSchema, selfieReviewModelSchema } from '../compatibility/analysis.schemas.js';
import { buildSelfieReviewInstructions, buildSelfieReviewUserPrompt } from '../../ai/prompts/analysis.prompts.js';
import { profileRepository } from '../profile/profile.repository.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { selfieReviewRepository } from './selfie-review.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';

export const selfieReviewService = {
  async createReview(input: AnalysisRequest, supabaseUserId: string) {
    const uploadedImage = input.imageId ? await uploadsRepository.findById(input.imageId) : null;
    const profile = input.profileId ? await profileRepository.findById(input.profileId) : await profileRepository.findByUserId(supabaseUserId);
    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'selfie-review',
      query: [
        profile?.gender === 'woman' ? 'womenswear guidance for evaluating a finished outfit on-body' : 'menswear guidance for evaluating a finished outfit on-body',
        input.outfitTitle ? `outfit title: ${input.outfitTitle}` : null,
        input.anchorItemDescription ? `anchor item: ${input.anchorItemDescription}` : null,
        input.tier ? `tier: ${input.tier}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    });
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildSelfieReviewUserPrompt({
          profile,
          outfitTitle: input.outfitTitle,
          anchorItemDescription: input.anchorItemDescription,
          tier: input.tier,
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
      schema: selfieReviewModelSchema,
      jsonSchema: {
        name: 'selfie_review_against_outfit',
        description: 'Selfie-based review of a completed menswear outfit.',
        schema: selfieReviewJsonSchema,
      },
      instructions: buildSelfieReviewInstructions(profile?.gender),
      userContent,
      supabaseUserId,
      feature: 'selfie-review',
    });

    const output: AnalysisResponse = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      verdict: aiOutput.verdict,
      lookFidelity: aiOutput.lookFidelity,
      overallLook: aiOutput.overallLook,
      summary: aiOutput.summary,
      substitutionImpact: aiOutput.substitutionImpact,
      stylistNotes: aiOutput.summary ? [aiOutput.summary, ...aiOutput.substitutionImpact] : aiOutput.substitutionImpact,
      suggestedChanges: [],
    };

    await selfieReviewRepository.create({
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
