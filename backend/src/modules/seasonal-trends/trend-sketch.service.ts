import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildTrendSketchPrompt, type TrendSketchInput } from '../../ai/prompts/trend-sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { trendSketchRepository } from './trend-sketch.repository.js';

// Staggered like closet-outfit and haircut-option sketch generation — firing
// 20 image-generation calls simultaneously risks tripping OpenAI's rate
// limits and forcing retries, which makes the whole batch slower overall
// than spacing them out would.
const STAGGER_MS = 1000;

async function generateSketch(id: string, trend: TrendSketchInput) {
  try {
    const prompt = buildTrendSketchPrompt(trend);
    const generatedImage = await openAiClient.generateImage({
      prompt,
      model: env.OPENAI_OUTFIT_SKETCH_MODEL,
      size: '1024x1536',
      quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
      outputFormat: 'jpeg',
      feature: 'trend-sketch',
      costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
      logContext: { trendSketchId: id, name: trend.name },
    });

    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'trend-sketch',
      fileExtension: '.jpg',
      mimeType: generatedImage.mimeType,
      data: generatedImage.data,
    });

    await trendSketchRepository.updateSketch(id, {
      status: 'ready',
      sketchStorageKey: storedFile.storageKey,
      sketchMimeType: generatedImage.mimeType,
      sketchImageData: generatedImage.data,
    });
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error({ trendSketchId: id, name: trend.name, errorCode: code, error }, 'Trend sketch generation failed');
    await trendSketchRepository.updateSketch(id, { status: 'failed', errorCode: code, errorMessage: message });
  }
}

export const trendSketchService = {
  /**
   * Called once per fresh profile generation (not per report view) — for
   * each of the newly-ranked trends, reuses an existing sketch matched by
   * normalized name (refreshing lastSeenAt so it survives the season
   * boundary) or kicks off generation for a trend seen for the first time.
   * Fire-and-forget: never blocks profile persistence on image generation.
   */
  ensureSketchesForFreshProfile(fashionGender: string, trends: TrendSketchInput[]) {
    trends.forEach((trend, index) => {
      void (async () => {
        try {
          const existing = await trendSketchRepository.findByKey(fashionGender, trend.name);
          if (existing) {
            await trendSketchRepository.touchLastSeen(existing.id);
            return;
          }
          const created = await trendSketchRepository.createPending(fashionGender, trend.name, trend.formality);
          await new Promise<void>((resolve) => setTimeout(resolve, index * STAGGER_MS));
          await generateSketch(created.id, trend);
        } catch (error) {
          logger.error({ error, fashionGender, name: trend.name }, 'Trend sketch ensure failed');
        }
      })();
    });
  },

  /** Pure read — looks up each trend's current sketch status/url without writing anything. */
  async getSketchStatuses(fashionGender: string, trendNames: string[]) {
    const entries = await Promise.all(
      trendNames.map(async (name) => {
        const record = await trendSketchRepository.findByKey(fashionGender, name);
        return [
          name,
          {
            sketchStatus: (record?.status as 'pending' | 'ready' | 'failed' | undefined) ?? null,
            sketchImageUrl: record?.sketchStorageKey ? `${env.STORAGE_PUBLIC_BASE_URL}/media/${record.sketchStorageKey}` : null,
          },
        ] as const;
      }),
    );
    return new Map(entries);
  },
};
