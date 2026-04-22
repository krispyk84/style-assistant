import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { closetRepository } from './closet.repository.js';
import { closetSketchService } from './closet-sketch.service.js';
import { mapClosetItem } from './closet-response-mapper.js';
import { analyzeClosetItem, matchClosetItems } from './closet-analysis.service.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildHelpMePickSystemPrompt, buildHelpMePickUserPrompt } from '../../ai/prompts/help-me-pick.prompts.js';
import { buildClosetAnalyseSystemPrompt, buildClosetAnalyseUserPrompt } from '../../ai/prompts/closet-analyse.prompts.js';
import type {
  AnalyzeClosetItemPayload,
  ClosetMatchPayload,
  GenerateClosetSketchOptions,
  GenerateClosetSketchPayload,
  HelpMePickPayload,
  SaveClosetItemPayload,
  UpdateClosetItemPayload,
} from './closet.validation.js';

// ── Closet Analyser ───────────────────────────────────────────────────────────

// Same exclusion set as HELP_ME_PICK_EXCLUDED on the client — accessories and shoes
// don't count toward the 10-item threshold for analysis.
const ANALYSE_EXCLUDED_CATEGORIES = new Set([
  'Shoes', 'Sneakers', 'Loafers', 'Boots',
  'Belt', 'Bag', 'Watch', 'Scarf', 'Hat', 'Tie', 'Socks', 'Sunglasses',
]);

const recommendationItemSchema = z.object({
  piece_name: z.string(),
  reason: z.string(),
  versatility_tags: z.array(z.string()),
  impact_score: z.number(),
});

const stylistResultSchema = z.object({
  has_recommendations: z.boolean(),
  no_gap_message: z.string(),
  recommendations: z.array(recommendationItemSchema).max(2),
});

const closetAnalysisSchema = z.object({
  total_score: z.number(),
  summary: z.string(),
  sub_scores: z.object({
    formality_range: z.number(),
    color_versatility: z.number(),
    seasonal_coverage: z.number(),
    layering_options: z.number(),
    occasion_coverage: z.number(),
  }),
  vittorio: stylistResultSchema,
  alessandra: stylistResultSchema,
});

const CLOSET_ANALYSIS_JSON_SCHEMA = {
  name: 'closet_analysis_response',
  schema: {
    type: 'object' as const,
    properties: {
      total_score: { type: 'number', description: 'Overall closet versatility score 0-100' },
      summary: { type: 'string', description: '2-3 sentence plain-English summary specific to this closet' },
      sub_scores: {
        type: 'object',
        properties: {
          formality_range: { type: 'number', description: 'Score 0-10' },
          color_versatility: { type: 'number', description: 'Score 0-10' },
          seasonal_coverage: { type: 'number', description: 'Score 0-10' },
          layering_options: { type: 'number', description: 'Score 0-10' },
          occasion_coverage: { type: 'number', description: 'Score 0-10' },
        },
        required: ['formality_range', 'color_versatility', 'seasonal_coverage', 'layering_options', 'occasion_coverage'],
        additionalProperties: false,
      },
      vittorio: {
        type: 'object',
        properties: {
          has_recommendations: { type: 'boolean' },
          no_gap_message: { type: 'string', description: 'One sentence in Vittorio\'s voice when has_recommendations is false. Empty string otherwise.' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                piece_name: { type: 'string' },
                reason: { type: 'string', description: 'Sharp, precise, European — Vittorio\'s voice' },
                versatility_tags: { type: 'array', items: { type: 'string' } },
                impact_score: { type: 'number', description: '1-10: how much this piece improves the wardrobe' },
              },
              required: ['piece_name', 'reason', 'versatility_tags', 'impact_score'],
              additionalProperties: false,
            },
          },
        },
        required: ['has_recommendations', 'no_gap_message', 'recommendations'],
        additionalProperties: false,
      },
      alessandra: {
        type: 'object',
        properties: {
          has_recommendations: { type: 'boolean' },
          no_gap_message: { type: 'string', description: 'One sentence in Alessandra\'s voice when has_recommendations is false. Empty string otherwise.' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                piece_name: { type: 'string' },
                reason: { type: 'string', description: 'Culturally fluent, warm, expressive — Alessandra\'s voice' },
                versatility_tags: { type: 'array', items: { type: 'string' } },
                impact_score: { type: 'number', description: '1-10: how much this piece improves the wardrobe' },
              },
              required: ['piece_name', 'reason', 'versatility_tags', 'impact_score'],
              additionalProperties: false,
            },
          },
        },
        required: ['has_recommendations', 'no_gap_message', 'recommendations'],
        additionalProperties: false,
      },
    },
    required: ['total_score', 'summary', 'sub_scores', 'vittorio', 'alessandra'],
    additionalProperties: false,
  },
  strict: true,
};

// ── Help Me Pick ──────────────────────────────────────────────────────────────

const helpMePickResponseSchema = z.object({
  itemId: z.string(),
  reason: z.string(),
});

const HELP_ME_PICK_JSON_SCHEMA = {
  name: 'help_me_pick_response',
  schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'The id of the selected closet item' },
      reason: { type: 'string', description: 'One sentence explaining why this piece is the right anchor today' },
    },
    required: ['itemId', 'reason'],
    additionalProperties: false,
  },
  strict: true,
};

export const closetService = {
  async analyzeItem(payload: AnalyzeClosetItemPayload, supabaseUserId?: string) {
    return analyzeClosetItem(payload, supabaseUserId);
  },

  async saveItem(payload: SaveClosetItemPayload, supabaseUserId: string) {
    const item = await closetRepository.createItem({
      supabaseUserId,
      title: payload.title,
      brand: payload.brand,
      size: payload.size,
      category: payload.category,
      uploadedImageUrl: payload.uploadedImageUrl,
      sketchImageUrl: payload.sketchImageUrl,
      sketchStatus: payload.sketchImageUrl ? 'ready' : 'failed',
      subcategory: payload.subcategory,
      primaryColor: payload.primaryColor,
      colorFamily: payload.colorFamily,
      material: payload.material,
      formality: payload.formality,
      silhouette: payload.silhouette,
      season: payload.season,
      weight: payload.weight,
      pattern: payload.pattern,
      notes: payload.notes,
      fitStatus: payload.fitStatus,
      lensShape: payload.lensShape,
      frameColor: payload.frameColor,
    });
    return mapClosetItem(item);
  },

  async getItems(supabaseUserId: string) {
    const items = await closetRepository.getItems(supabaseUserId);
    return { items: items.map(mapClosetItem) };
  },

  async getItem(id: string, supabaseUserId: string) {
    const item = await closetRepository.getItem(id, supabaseUserId);
    if (!item) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    return mapClosetItem(item);
  },

  async updateItem(id: string, supabaseUserId: string, payload: UpdateClosetItemPayload) {
    const existing = await closetRepository.getItem(id, supabaseUserId);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    await closetRepository.updateItem(id, supabaseUserId, {
      title: payload.title,
      brand: payload.brand,
      size: payload.size,
      category: payload.category,
      subcategory: payload.subcategory,
      primaryColor: payload.primaryColor,
      colorFamily: payload.colorFamily,
      material: payload.material,
      formality: payload.formality,
      silhouette: payload.silhouette,
      season: payload.season,
      weight: payload.weight,
      pattern: payload.pattern,
      notes: payload.notes,
      fitStatus: payload.fitStatus,
      lensShape: payload.lensShape,
      frameColor: payload.frameColor,
    });
    // Re-fetch to return the updated row (updateMany doesn't return records)
    const updated = await closetRepository.getItem(id, supabaseUserId);
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Item not found after update.');
    return mapClosetItem(updated);
  },

  async deleteItem(id: string, supabaseUserId: string) {
    const existing = await closetRepository.getItem(id, supabaseUserId);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    await closetRepository.deleteItem(id, supabaseUserId);
    return { deleted: true };
  },

  async generateItemSketch(payload: GenerateClosetSketchPayload, supabaseUserId?: string) {
    const options: GenerateClosetSketchOptions = {
      title: payload.title,
      category: payload.category,
      lensShape: payload.lensShape,
      frameColor: payload.frameColor,
    };
    const jobId = await closetSketchService.startSketchJob(payload.uploadedImageUrl, supabaseUserId, options);
    return { jobId };
  },

  async getItemSketch(jobId: string) {
    const result = await closetSketchService.getSketchJobStatus(jobId);
    if (!result) throw new HttpError(404, 'NOT_FOUND', 'Sketch job not found.');
    return result;
  },

  async matchItems(payload: ClosetMatchPayload, supabaseUserId?: string) {
    return matchClosetItems(payload, supabaseUserId);
  },

  async helpMePick(payload: HelpMePickPayload, supabaseUserId: string) {
    const eligible = await closetRepository.getEligibleItems(supabaseUserId);
    if (eligible.length < 3) {
      throw new HttpError(422, 'INSUFFICIENT_ITEMS', 'Add at least 3 eligible pieces (tops, outerwear, or bottoms) to use Help Me Pick.');
    }

    // Build rejected set from explicit client-side rejections (in-session "Pick Again" history)
    const rejectedSet = new Set(payload.rejectedIds ?? []);

    // Cross-session exclusion: last 5 most recently anchored items act as soft "recently chosen" hints.
    // These are passed to the LLM prompt as context, not hard-excluded, so the LLM can still
    // fall back to them if the closet is small.
    const recentlyPickedIds = eligible
      .filter((item) => item.lastAnchoredAt !== null)
      .sort((a, b) => b.lastAnchoredAt!.getTime() - a.lastAnchoredAt!.getTime())
      .slice(0, 5)
      .map((item) => item.id)
      .filter((id) => !rejectedSet.has(id));

    // Weighted shuffle — ensures the LLM sees a different ordering on every call:
    //   Group A: never anchored (timesAnchored === 0) — shuffled → front
    //   Group B: anchored but last anchor > 7 days ago — shuffled → middle
    //   Group C: anchored within last 7 days — shuffled → back
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    function shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    }

    const available = eligible.filter((item) => !rejectedSet.has(item.id));
    const groupA = shuffle(available.filter((i) => i.timesAnchored === 0));
    const groupB = shuffle(available.filter((i) => i.timesAnchored > 0 && (!i.lastAnchoredAt || i.lastAnchoredAt < sevenDaysAgo)));
    const groupC = shuffle(available.filter((i) => i.timesAnchored > 0 && i.lastAnchoredAt !== null && i.lastAnchoredAt >= sevenDaysAgo));

    const sorted = [...groupA, ...groupB, ...groupC];

    const index = sorted.map((item) => ({
      id: item.id,
      name: item.title,
      category: item.category,
      color_family: item.colorFamily ?? null,
      formality: item.formality ?? null,
      silhouette: item.silhouette ?? null,
      season: item.season ?? null,
      material: item.material ?? null,
      brand: item.brand || null,
      times_anchored: item.timesAnchored,
    }));

    if (index.length === 0) {
      throw new HttpError(422, 'INSUFFICIENT_ITEMS', 'No eligible pieces remaining after exclusions.');
    }

    const indexById = new Map(eligible.map((item) => [item.id, item]));

    // Retry up to 2 times if LLM returns an invalid ID
    let lastResult: z.infer<typeof helpMePickResponseSchema> | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await openAiClient.createStructuredResponse({
        schema: helpMePickResponseSchema,
        jsonSchema: HELP_ME_PICK_JSON_SCHEMA,
        instructions: buildHelpMePickSystemPrompt(payload.stylistId),
        userContent: [{ type: 'input_text' as const, text: buildHelpMePickUserPrompt({ index, dayType: payload.dayType, vibe: payload.vibe, risk: payload.risk, season: payload.season, recentlyPickedIds }) }],
        supabaseUserId,
        feature: 'help-me-pick',
      });
      if (indexById.has(result.itemId)) {
        lastResult = result;
        break;
      }
      // Invalid ID — retry without modification (LLM will pick differently with same prompt)
    }

    if (!lastResult || !indexById.has(lastResult.itemId)) {
      // Fallback: pick the first item in the shuffled index (least recently anchored)
      const fallback = index[0]!;
      lastResult = { itemId: fallback.id, reason: 'A strong starting point for your look.' };
    }

    const chosen = indexById.get(lastResult.itemId)!;
    return {
      itemId: chosen.id,
      itemTitle: chosen.title,
      itemImageUrl: chosen.sketchImageUrl ?? chosen.uploadedImageUrl ?? null,
      itemFitStatus: chosen.fitStatus ?? null,
      reason: lastResult.reason,
      stylistId: payload.stylistId,
    };
  },

  async recordAnchorUsed(id: string, supabaseUserId: string) {
    await closetRepository.recordAnchorUsed(id, supabaseUserId);
    return { recorded: true };
  },

  async recordMatchUsed(id: string, supabaseUserId: string) {
    await closetRepository.recordMatchUsed(id, supabaseUserId);
    return { recorded: true };
  },

  async analyseCloset(supabaseUserId: string) {
    const allItems = await closetRepository.getItems(supabaseUserId);

    // Threshold check uses only non-accessory/non-shoe items
    const nonAccessoryCount = allItems.filter(
      (item) => !ANALYSE_EXCLUDED_CATEGORIES.has(item.category)
    ).length;

    if (nonAccessoryCount < 10) {
      throw new HttpError(422, 'INSUFFICIENT_ITEMS', 'Add at least 10 clothing items to unlock closet analysis.');
    }

    // Pass the full inventory to the LLM — accessories and shoes contribute to occasion/seasonal coverage
    const index = allItems.map((item) => ({
      id: item.id,
      name: item.title,
      category: item.category,
      subcategory: item.subcategory ?? null,
      color_family: item.colorFamily ?? null,
      formality: item.formality ?? null,
      silhouette: item.silhouette ?? null,
      season: item.season ?? null,
      material: item.material ?? null,
      brand: item.brand || null,
      personal_fit: item.fitStatus ?? null,
      anchor_count: (item as any).timesAnchored ?? 0,
      match_count: (item as any).matchCount ?? 0,
    }));

    // Retry once if the LLM returns an invalid response
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await openAiClient.createStructuredResponse({
          schema: closetAnalysisSchema,
          jsonSchema: CLOSET_ANALYSIS_JSON_SCHEMA,
          instructions: buildClosetAnalyseSystemPrompt(),
          userContent: [{ type: 'input_text' as const, text: buildClosetAnalyseUserPrompt(index) }],
          supabaseUserId,
          feature: 'closet-analyse',
        });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  },
};
