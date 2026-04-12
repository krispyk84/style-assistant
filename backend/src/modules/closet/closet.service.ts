import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { closetRepository } from './closet.repository.js';
import { closetSketchService } from './closet-sketch.service.js';
import { mapClosetItem } from './closet-response-mapper.js';
import { analyzeClosetItem, matchClosetItems } from './closet-analysis.service.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildHelpMePickSystemPrompt, buildHelpMePickUserPrompt } from '../../ai/prompts/help-me-pick.prompts.js';
import type {
  AnalyzeClosetItemPayload,
  ClosetMatchPayload,
  GenerateClosetSketchOptions,
  GenerateClosetSketchPayload,
  HelpMePickPayload,
  SaveClosetItemPayload,
  UpdateClosetItemPayload,
} from './closet.validation.js';

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

    // Build rejected set — include most recently anchored item as a same-item-twice guard
    const rejectedSet = new Set(payload.rejectedIds ?? []);
    const mostRecentlyAnchored = eligible
      .filter((item) => item.lastAnchoredAt !== null)
      .sort((a, b) => (b.lastAnchoredAt!.getTime()) - (a.lastAnchoredAt!.getTime()))[0];
    if (mostRecentlyAnchored && rejectedSet.size === 0) {
      rejectedSet.add(mostRecentlyAnchored.id);
    }

    const index = eligible
      .filter((item) => !rejectedSet.has(item.id))
      .map((item) => ({
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
        userContent: [{ type: 'input_text' as const, text: buildHelpMePickUserPrompt({ index, dayType: payload.dayType, vibe: payload.vibe, risk: payload.risk }) }],
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
      // Fallback: pick the least-anchored item
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
};
