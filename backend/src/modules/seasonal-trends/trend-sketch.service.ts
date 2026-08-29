import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { runWithConcurrencyLimit } from '../../lib/concurrency-limit.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildTrendSketchPrompt, type TrendSketchInput } from '../../ai/prompts/trend-sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { trendSketchRepository } from './trend-sketch.repository.js';

// Bounds actual concurrent generations (not just start times) — a top-20
// profile can need up to 20 fresh sketches at once; each OpenAI image call
// holds a full image buffer in memory for its duration, and a simple stagger
// only spaces out *start* times, not overlap — if a call takes longer than
// the stagger interval (very likely), most of the batch ends up running
// concurrently anyway, which is exactly what tripped this server's memory
// limit and forced a restart (killing every sketch mid-generation).
const GENERATION_CONCURRENCY = 3;

// A pending/failed sketch older than this is treated as abandoned rather than
// still legitimately in flight — most commonly because a server restart
// killed an in-flight generation (that work only ever existed in memory) —
// and becomes eligible for retryStuckSketches() to pick up.
const STALE_MS = 1000 * 60 * 10;

// A sketch not seen in the current top-20 for longer than this is genuinely
// gone, not just temporarily out of favour — safely past two full season
// cycles (~90 days each) without recurring, so it's deleted to reclaim its
// image blob rather than kept "just in case" forever.
const STALE_RETENTION_MS = 1000 * 60 * 60 * 24 * 200;

type TrendSketchRow = Awaited<ReturnType<typeof trendSketchRepository.findByKey>>;

function inputFromRow(row: NonNullable<TrendSketchRow>): TrendSketchInput {
  const data = (row.trendData as Record<string, unknown> | null) ?? {};
  const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
  return {
    name: row.trendName,
    formality: row.formality as TrendSketchInput['formality'],
    summary: typeof data.summary === 'string' ? data.summary : row.trendName,
    garmentCategories: stringArray(data.garmentCategories),
    silhouettes: stringArray(data.silhouettes),
    colours: stringArray(data.colours),
    materialsOrTextures: stringArray(data.materialsOrTextures),
    footwear: stringArray(data.footwear),
    accessories: stringArray(data.accessories),
  };
}

async function generateSketch(id: string, trend: TrendSketchInput) {
  // Always logged, unconditionally — so a search for "Trend sketch generate"
  // definitively answers "did this row's generation ever actually start" even
  // when the call afterwards hangs with no error and no success line.
  logger.info({ trendSketchId: id, name: trend.name }, 'Trend sketch generate: starting');
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
    logger.info({ trendSketchId: id, name: trend.name }, 'Trend sketch generate: succeeded');
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error({ trendSketchId: id, name: trend.name, errorCode: code, error }, 'Trend sketch generation failed');
    await trendSketchRepository.updateSketch(id, { status: 'failed', errorCode: code, errorMessage: message });
  }
}

export const trendSketchService = {
  /**
   * Called once per fresh profile generation (not per report view) — for
   * each of the newly-ranked trends, reuses an existing READY sketch matched
   * by normalized name (refreshing lastSeenAt so it survives the season
   * boundary) or kicks off generation for a trend seen for the first time.
   * A row stuck pending/failed is deliberately left alone here — that's
   * retryStuckSketches()'s job, since it needs the staleness check to avoid
   * clobbering a generation that's still genuinely in flight elsewhere.
   * Fire-and-forget: never blocks profile persistence on image generation.
   */
  ensureSketchesForFreshProfile(fashionGender: string, trends: TrendSketchInput[]) {
    logger.info({ fashionGender, count: trends.length }, 'Trend sketch ensure: called for fresh profile');
    void (async () => {
      // Existence checks are cheap DB reads — fine to resolve all up front.
      // Only the expensive part (actual image generation) needs bounding.
      const toGenerate: { id: string; trend: TrendSketchInput }[] = [];
      for (const trend of trends) {
        try {
          const existing = await trendSketchRepository.findByKey(fashionGender, trend.name);
          if (existing) {
            if (existing.status === 'ready') await trendSketchRepository.touchLastSeen(existing.id);
            continue;
          }
          const created = await trendSketchRepository.createPending(fashionGender, trend);
          toGenerate.push({ id: created.id, trend });
        } catch (error) {
          logger.error({ error, fashionGender, name: trend.name }, 'Trend sketch ensure failed');
        }
      }
      await runWithConcurrencyLimit(toGenerate, GENERATION_CONCURRENCY, ({ id, trend }) => generateSketch(id, trend));
    })();
  },

  /**
   * Server-side self-healing sweep — retries any sketch stuck pending/failed
   * for longer than STALE_MS, reconstructing the generation input from the
   * row's own persisted trendData rather than depending on the original
   * in-memory trend list (which won't survive a restart). Run periodically
   * by the trend-refresh scheduler, independent of report views.
   */
  async retryStuckSketches() {
    const stuck = await trendSketchRepository.findStuck(new Date(Date.now() - STALE_MS));
    // Always logged, unconditionally — the only way to tell "the sweep ran
    // and found nothing" apart from "the sweep never ran at all" from logs.
    logger.info({ stuckCount: stuck.length }, 'Trend sketch retry sweep: ran');
    if (stuck.length === 0) return;
    await runWithConcurrencyLimit(stuck, GENERATION_CONCURRENCY, (row) => generateSketch(row.id, inputFromRow(row)));
  },

  /**
   * Deletes sketches for trends that have fallen out of rotation for good —
   * not seen in the current top-20 for STALE_RETENTION_MS. Run periodically
   * by the trend-refresh scheduler; cheap no-op on ticks with nothing stale.
   */
  async pruneStaleSketches() {
    const deleted = await trendSketchRepository.deleteStale(new Date(Date.now() - STALE_RETENTION_MS));
    if (deleted > 0) logger.info({ deleted }, 'Trend sketch: pruned stale sketches');
    return deleted;
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
