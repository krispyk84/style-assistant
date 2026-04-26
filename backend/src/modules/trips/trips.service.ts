import { z } from 'zod';
import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput, resolveImageUrlForAI } from '../../ai/image-input.js';
import { buildTripOutfitsPrompt, buildTripDaySketchPrompt, buildRegenerateDayPrompt } from '../../ai/prompts/trips.prompts.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { profileRepository } from '../profile/profile.repository.js';
import { closetRepository } from '../closet/closet.repository.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { tripOutfitsResponseSchema, tripDaySchema } from './trips.schemas.js';
import type { GenerateTripOutfitsRequest, GenerateTripOutfitsResponse, RegenerateTripDayRequest, TripOutfitDayDto } from '../../contracts/trips.contracts.js';
import type { InputContent } from '../../ai/openai-request-builder.js';

export const tripsService = {
  async generateTripOutfits(
    request: GenerateTripOutfitsRequest,
    supabaseUserId: string,
  ): Promise<GenerateTripOutfitsResponse> {
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const { instructions, userContent, jsonSchema } = buildTripOutfitsPrompt(request, profile);
    const anchorImageContent = await buildTripAnchorImageContent(request);

    const result = await openAiClient.createStructuredResponse({
      schema: tripOutfitsResponseSchema,
      jsonSchema,
      instructions,
      userContent: [...userContent, ...anchorImageContent],
      supabaseUserId,
      feature: 'trip-generation',
    });

    const days: TripOutfitDayDto[] = result.days.map((day) => ({
      ...day,
      id: `${request.tripId}-day-${day.dayIndex}`,
      tripId: request.tripId,
      bag: day.bag ?? null,
      accessories: day.accessories ?? [],
    }));

    return { tripId: request.tripId, days };
  },

  async startDaySketchJob(params: {
    destination: string;
    dayTitle: string;
    climateLabel: string;
    pieces: string[];
    shoes: string;
    accessories: string[];
    profileId?: string;
    supabaseUserId: string;
  }): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void generateDaySketch(job.id, params);
    return job.id;
  },

  async regenerateDay(
    request: RegenerateTripDayRequest,
    supabaseUserId: string,
  ): Promise<TripOutfitDayDto> {
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const { instructions, userContent, jsonSchema } = buildRegenerateDayPrompt(request, profile);

    const regenerateDayResponseSchema = z.object({ day: tripDaySchema });

    const result = await openAiClient.createStructuredResponse({
      schema: regenerateDayResponseSchema,
      jsonSchema,
      instructions,
      userContent,
      supabaseUserId,
      feature: 'trip-generation',
    });

    return {
      ...result.day,
      id: `${request.tripId}-day-${request.dayIndex}-r${Date.now()}`,
      tripId: request.tripId,
      bag: result.day.bag ?? null,
      accessories: result.day.accessories ?? [],
    };
  },

  async getDaySketchStatus(jobId: string) {
    const job = await closetRepository.getSketchJob(jobId);
    if (!job) return { sketchStatus: 'failed' as const, sketchImageUrl: null };

    if (job.status === 'ready' && job.sketchStorageKey) {
      const url = `${env.STORAGE_PUBLIC_BASE_URL}/media/${job.sketchStorageKey}`;
      return { sketchStatus: 'ready' as const, sketchImageUrl: url };
    }

    return {
      sketchStatus: (job.status === 'pending' ? 'pending' : 'failed') as 'pending' | 'failed',
      sketchImageUrl: null,
    };
  },
};

async function buildTripAnchorImageContent(request: GenerateTripOutfitsRequest): Promise<InputContent[]> {
  const anchors = request.anchors ?? [];
  if (anchors.length === 0) return [];

  const content: InputContent[] = [];

  for (const anchor of anchors) {
    if (anchor.uploadedImageId) {
      const uploadedImage = await uploadsRepository.findById(anchor.uploadedImageId);
      if (uploadedImage) {
        content.push({ type: 'input_text', text: `Anchor image reference: [${anchor.category}] ${anchor.label}` });
        content.push(await buildModelImageInput(uploadedImage));
        continue;
      }
    }

    if (anchor.imageUrl) {
      const imageInput = await resolveImageUrlForAI(anchor.imageUrl);
      if (imageInput) {
        content.push({ type: 'input_text', text: `Anchor image reference: [${anchor.category}] ${anchor.label}` });
        content.push(imageInput);
      }
    }
  }

  return content;
}

// ── Background sketch generation ──────────────────────────────────────────────

async function generateDaySketch(
  jobId: string,
  params: {
    destination: string;
    dayTitle: string;
    climateLabel: string;
    pieces: string[];
    shoes: string;
    accessories: string[];
    profileId?: string;
    supabaseUserId: string;
  },
): Promise<void> {
  try {
    const profile = params.profileId
      ? await profileRepository.findById(params.profileId)
      : await profileRepository.findByUserId(params.supabaseUserId);

    const subjectBrief = profile
      ? buildSubjectRenderingBrief({
          gender: profile.gender,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          bodyType: (profile as any).bodyType ?? null,
          weightDistribution: (profile as any).weightDistribution ?? null,
          fitTendency: (profile as any).fitTendency ?? null,
        }).block
      : 'slim neutral fashion figure';

    const prompt = buildTripDaySketchPrompt({
      destination: params.destination,
      dayTitle: params.dayTitle,
      climateLabel: params.climateLabel,
      pieces: params.pieces,
      shoes: params.shoes,
      accessories: params.accessories,
      subjectBrief,
    });

    const generatedImage = await openAiClient.generateImage({
      prompt,
      model: env.OPENAI_OUTFIT_SKETCH_MODEL,
      size: '1024x1536',
      quality: (env.OPENAI_OUTFIT_SKETCH_QUALITY as 'low' | 'medium' | 'high' | 'auto') ?? 'low',
      outputFormat: 'jpeg',
      supabaseUserId: params.supabaseUserId,
      feature: 'trip-sketch',
      costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
    });

    const storageKey = `closet-sketch/trip-${jobId}.jpg`;
    const imageBuffer = generatedImage.data;

    await closetRepository.updateSketchJob(jobId, {
      status: 'ready',
      sketchStorageKey: storageKey,
      sketchMimeType: 'image/jpeg',
      sketchImageData: imageBuffer,
    });

    logger.info({ jobId }, '[trip-sketch] Sketch generated successfully');
  } catch (err) {
    logger.error({ jobId, err }, '[trip-sketch] Sketch generation failed');
    await closetRepository.updateSketchJob(jobId, { status: 'failed' }).catch(() => {});
  }
}
