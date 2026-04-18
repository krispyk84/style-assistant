import { openAiClient } from '../../ai/openai-client.js';
import { buildTripOutfitsPrompt, buildTripDaySketchPrompt } from '../../ai/prompts/trips.prompts.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { profileRepository } from '../profile/profile.repository.js';
import { closetRepository } from '../closet/closet.repository.js';
import { tripOutfitsResponseSchema } from './trips.schemas.js';
import type { GenerateTripOutfitsRequest, GenerateTripOutfitsResponse, TripOutfitDayDto } from '../../contracts/trips.contracts.js';

export const tripsService = {
  async generateTripOutfits(
    request: GenerateTripOutfitsRequest,
    supabaseUserId: string,
  ): Promise<GenerateTripOutfitsResponse> {
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const { instructions, userContent, jsonSchema } = buildTripOutfitsPrompt(request, profile);

    const result = await openAiClient.createStructuredResponse({
      schema: tripOutfitsResponseSchema,
      jsonSchema,
      instructions,
      userContent,
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
