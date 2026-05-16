import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { openAiClient } from '../../ai/openai-client.js';
import {
  buildClosetFitCheckSystemPrompt,
  buildClosetFitCheckUserPrompt,
  type FitCheckClosetIndexItem,
} from '../../ai/prompts/closet-fit-check.prompts.js';
import { storageConfig } from '../../config/storage.js';
import {
  CLOSET_FIT_CHECK_WEIGHTS,
  computeOverallScore,
  verdictFromScore,
  type ClosetFitCheckResponse,
} from '../../contracts/closet-fit-check.contracts.js';
import { HttpError } from '../../lib/http-error.js';
import { closetRepository } from '../closet/closet.repository.js';
import { profileRepository } from '../profile/profile.repository.js';
import { CLOSET_FIT_CHECK_JSON_SCHEMA, closetFitCheckAiSchema, type ClosetFitCheckRequestPayload } from './closet-fit-check.schemas.js';

// Reuses the same disk-then-HTTP image resolution pattern as closet-analysis.
async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;
  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const buffer = await fsPromises.readFile(filePath);
      const ext = path.extname(storageKey).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      // File not on disk — fall through to HTTP fetch
    }
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new HttpError(422, 'IMAGE_UNAVAILABLE', `The candidate image could not be fetched (HTTP ${res.status}).`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

export const closetFitCheckService = {
  async evaluate(payload: ClosetFitCheckRequestPayload, supabaseUserId: string): Promise<ClosetFitCheckResponse> {
    const [profile, closet] = await Promise.all([
      profileRepository.findByUserId(supabaseUserId),
      closetRepository.getItems(supabaseUserId),
    ]);

    const dataUrl = await imageUrlToDataUrl(payload.uploadedImageUrl);

    const closetIndex: FitCheckClosetIndexItem[] = closet.map((item) => ({
      id: item.id,
      name: item.title,
      category: item.category,
      subcategory: item.subcategory ?? null,
      color_family: item.colorFamily ?? null,
      primary_color: item.primaryColor ?? null,
      formality: item.formality ?? null,
      silhouette: item.silhouette ?? null,
      season: item.season ?? null,
      material: item.material ?? null,
      pattern: item.pattern ?? null,
      brand: item.brand?.trim() || null,
    }));

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: closetFitCheckAiSchema,
      jsonSchema: CLOSET_FIT_CHECK_JSON_SCHEMA,
      instructions: buildClosetFitCheckSystemPrompt(),
      userContent: [
        { type: 'input_image' as const, image_url: dataUrl, detail: 'high' as const },
        {
          type: 'input_text' as const,
          text: buildClosetFitCheckUserPrompt({
            profile,
            closetIndex,
            trendiness: payload.trendiness,
            notes: payload.notes,
          }),
        },
      ],
      supabaseUserId,
      feature: 'closet-fit-check',
    });

    // Filter the AI-returned similar IDs against the actual inventory so a hallucinated
    // ID never leaks to the client.
    const validIds = new Set(closet.map((item) => item.id));
    const similarClosetItemIds = aiOutput.similarClosetItemIds.filter((id) => validIds.has(id));

    const overallScore = computeOverallScore(aiOutput.scores);
    const verdict = verdictFromScore(overallScore);

    return {
      item: aiOutput.item,
      scores: aiOutput.scores,
      weights: CLOSET_FIT_CHECK_WEIGHTS,
      overallScore,
      verdict,
      summary: aiOutput.summary,
      reasoning: aiOutput.reasoning,
      closetImpact: aiOutput.closetImpact,
      stylistTake: aiOutput.stylistTake,
      similarClosetItemIds,
      imageUrl: payload.uploadedImageUrl,
    };
  },
};
