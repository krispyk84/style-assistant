import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { runWithConcurrencyLimit } from '../../lib/concurrency-limit.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildColorSwatchSketchPrompt, type ColorSwatchSketchInput } from '../../ai/prompts/color-swatch-sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { colorSwatchSketchRepository } from './color-swatch-sketch.repository.js';

// Bounds actual concurrent generations (not just start times) — mirrors
// trend-sketch.service.ts's fix for the memory-limit incident caused by
// unbounded AI-image-generation concurrency.
const GENERATION_CONCURRENCY = 3;

// A pending/failed sketch older than this is treated as abandoned rather than
// still legitimately in flight — most commonly because a server restart
// killed an in-flight generation (that work only ever existed in memory).
const STALE_MS = 1000 * 60 * 10;

// A swatch not seen in the current top-N for longer than this is genuinely
// gone, not just temporarily out of favour.
const STALE_RETENTION_MS = 1000 * 60 * 60 * 24 * 200;

type ColorSwatchSketchRow = Awaited<ReturnType<typeof colorSwatchSketchRepository.findByKey>>;

function inputFromRow(row: NonNullable<ColorSwatchSketchRow>): ColorSwatchSketchInput {
  const data = (row.colorData as Record<string, unknown> | null) ?? {};
  return {
    name: row.colorName,
    hex: typeof data.hex === 'string' ? data.hex : '#808080',
    description: typeof data.description === 'string' ? data.description : row.colorName,
  };
}

async function generateSketch(id: string, color: ColorSwatchSketchInput) {
  // Always logged, unconditionally — so a search for "Color swatch generate"
  // definitively answers "did this row's generation ever actually start".
  logger.info({ colorSwatchSketchId: id, name: color.name }, 'Color swatch generate: starting');
  try {
    const prompt = buildColorSwatchSketchPrompt(color);
    const generatedImage = await openAiClient.generateImage({
      prompt,
      model: env.OPENAI_OUTFIT_SKETCH_MODEL,
      size: '1024x1536',
      quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
      outputFormat: 'jpeg',
      feature: 'color-swatch-sketch',
      costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
      logContext: { colorSwatchSketchId: id, name: color.name },
    });

    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'color-swatch-sketch',
      fileExtension: '.jpg',
      mimeType: generatedImage.mimeType,
      data: generatedImage.data,
    });

    await colorSwatchSketchRepository.updateSketch(id, {
      status: 'ready',
      sketchStorageKey: storedFile.storageKey,
      sketchMimeType: generatedImage.mimeType,
      sketchImageData: generatedImage.data,
    });
    logger.info({ colorSwatchSketchId: id, name: color.name }, 'Color swatch generate: succeeded');
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error({ colorSwatchSketchId: id, name: color.name, errorCode: code, error }, 'Color swatch generation failed');
    await colorSwatchSketchRepository.updateSketch(id, { status: 'failed', errorCode: code, errorMessage: message });
  }
}

export const colorSwatchSketchService = {
  /**
   * Called once per fresh palette generation (not per report view) — mirrors
   * trend-sketch.service.ts's ensureSketchesForFreshProfile exactly. Fire-and-
   * forget: never blocks palette persistence on image generation.
   */
  ensureSketchesForFreshPalette(fashionGender: string, colors: ColorSwatchSketchInput[]) {
    logger.info({ fashionGender, count: colors.length }, 'Color swatch ensure: called for fresh palette');
    void (async () => {
      const toGenerate: { id: string; color: ColorSwatchSketchInput }[] = [];
      for (const color of colors) {
        try {
          const existing = await colorSwatchSketchRepository.findByKey(fashionGender, color.name);
          if (existing) {
            if (existing.status === 'ready') await colorSwatchSketchRepository.touchLastSeen(existing.id);
            continue;
          }
          const created = await colorSwatchSketchRepository.createPending(fashionGender, color);
          toGenerate.push({ id: created.id, color });
        } catch (error) {
          logger.error({ error, fashionGender, name: color.name }, 'Color swatch ensure failed');
        }
      }
      await runWithConcurrencyLimit(toGenerate, GENERATION_CONCURRENCY, ({ id, color }) => generateSketch(id, color));
    })();
  },

  /**
   * Server-side self-healing sweep — retries any swatch stuck pending/failed
   * for longer than STALE_MS. Run periodically by the trend-refresh
   * scheduler, independent of report views.
   */
  async retryStuckSketches() {
    const stuck = await colorSwatchSketchRepository.findStuck(new Date(Date.now() - STALE_MS));
    logger.info({ stuckCount: stuck.length }, 'Color swatch retry sweep: ran');
    if (stuck.length === 0) return;
    await runWithConcurrencyLimit(stuck, GENERATION_CONCURRENCY, (row) => generateSketch(row.id, inputFromRow(row)));
  },

  /** Deletes swatches for colours that have fallen out of rotation for good. */
  async pruneStaleSketches() {
    const deleted = await colorSwatchSketchRepository.deleteStale(new Date(Date.now() - STALE_RETENTION_MS));
    if (deleted > 0) logger.info({ deleted }, 'Color swatch: pruned stale sketches');
    return deleted;
  },

  /** Pure read — looks up each colour's current sketch status/url without writing anything. */
  async getSketchStatuses(fashionGender: string, colorNames: string[]) {
    const entries = await Promise.all(
      colorNames.map(async (name) => {
        const record = await colorSwatchSketchRepository.findByKey(fashionGender, name);
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
