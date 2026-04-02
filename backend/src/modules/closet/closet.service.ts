import { z } from 'zod';

import { openAiClient } from '../../ai/openai-client.js';
import { HttpError } from '../../lib/http-error.js';
import { closetRepository } from './closet.repository.js';
import { closetSketchService } from './closet-sketch.service.js';
import type {
  AnalyzeClosetItemPayload,
  ClosetMatchPayload,
  GenerateClosetSketchPayload,
  SaveClosetItemPayload,
  UpdateClosetItemPayload,
} from './closet.validation.js';

const analyzeResponseSchema = z.object({
  title: z.string(),
  category: z.string(),
});

const matchResponseSchema = z.object({
  matches: z.array(
    z.object({
      suggestionIndex: z.number(),
      matchedItemId: z.string().nullable(),
    })
  ),
});

function mapItem(item: {
  id: string;
  title: string;
  brand: string;
  size: string;
  category: string;
  uploadedImageUrl: string | null;
  sketchImageUrl: string | null;
  sketchStatus: string;
  savedAt: Date;
}) {
  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    size: item.size,
    category: item.category,
    uploadedImageUrl: item.uploadedImageUrl,
    sketchImageUrl: item.sketchImageUrl,
    sketchStatus: item.sketchStatus,
    savedAt: item.savedAt.toISOString(),
  };
}

export const closetService = {
  async analyzeItem(payload: AnalyzeClosetItemPayload) {
    const userContent: Array<{ type: 'input_image'; image_url: string; detail?: 'high' } | { type: 'input_text'; text: string }> = [];

    if (payload.uploadedImageUrl) {
      userContent.push({ type: 'input_image', image_url: payload.uploadedImageUrl, detail: 'high' });
    }

    userContent.push({
      type: 'input_text',
      text: payload.uploadedImageUrl
        ? 'Identify this garment. Return a concise product-style title (e.g. "Chocolate Brown Corduroy Blazer") and the most specific category from: Suit, Blazer, Sports Jacket, Coat, Shirt, Polo, Knitwear, Cardigan, Hoodie, Trousers, Denim, Shorts, Shoes, Sneakers, Loafers, Boots, Belt, Bag, Watch, Scarf, Hat, Tie, Socks, Clothing.'
        : `Identify this garment from the description: "${payload.description ?? ''}". Return a concise product-style title and a specific category.`,
    });

    const result = await openAiClient.createStructuredResponse({
      schema: analyzeResponseSchema,
      jsonSchema: {
        name: 'closet_item_analysis',
        description: 'Identifies a garment title and category',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Concise product-style title, e.g. "Chocolate Brown Corduroy Blazer"' },
            category: { type: 'string', description: 'Single category name from the standard list' },
          },
          required: ['title', 'category'],
          additionalProperties: false,
        },
      },
      instructions: 'You are a menswear expert cataloguing a wardrobe. Identify garments accurately and concisely.',
      userContent,
    });

    return result;
  },

  async saveItem(payload: SaveClosetItemPayload) {
    const item = await closetRepository.createItem({
      title: payload.title,
      brand: payload.brand,
      size: payload.size,
      category: payload.category,
      uploadedImageUrl: payload.uploadedImageUrl,
      sketchImageUrl: payload.sketchImageUrl,
      sketchStatus: payload.sketchImageUrl ? 'ready' : 'failed',
    });
    return mapItem(item);
  },

  async getItems() {
    const items = await closetRepository.getItems();
    return { items: items.map(mapItem) };
  },

  async getItem(id: string) {
    const item = await closetRepository.getItem(id);
    if (!item) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    return mapItem(item);
  },

  async updateItem(id: string, payload: UpdateClosetItemPayload) {
    const existing = await closetRepository.getItem(id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    const updated = await closetRepository.updateItem(id, {
      title: payload.title,
      brand: payload.brand,
      size: payload.size,
      category: payload.category,
    });
    return mapItem(updated);
  },

  async deleteItem(id: string) {
    const existing = await closetRepository.getItem(id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    await closetRepository.deleteItem(id);
    return { deleted: true };
  },

  async generateItemSketch(payload: GenerateClosetSketchPayload) {
    const jobId = await closetSketchService.startSketchJob(payload.uploadedImageUrl);
    return { jobId };
  },

  async getItemSketch(jobId: string) {
    const result = await closetSketchService.getSketchJobStatus(jobId);
    if (!result) throw new HttpError(404, 'NOT_FOUND', 'Sketch job not found.');
    return result;
  },

  async matchItems(payload: ClosetMatchPayload) {
    if (!payload.items.length) {
      return { matches: payload.suggestions.map((suggestion, i) => ({ suggestionIndex: i, suggestion, matchedItemId: null })) };
    }

    const itemList = payload.items
      .map((item) => `  - id: "${item.id}", title: "${item.title}", category: "${item.category}"${item.brand ? `, brand: "${item.brand}"` : ''}`)
      .join('\n');

    const suggestionList = payload.suggestions
      .map((s, i) => `  ${i}: "${s}"`)
      .join('\n');

    const result = await openAiClient.createStructuredResponse({
      schema: matchResponseSchema,
      jsonSchema: {
        name: 'closet_match_result',
        description: 'Matches outfit suggestions to the user\'s owned closet items',
        schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  suggestionIndex: { type: 'number', description: 'Index of the suggestion (0-based)' },
                  matchedItemId: { type: ['string', 'null'], description: 'The id of the matching closet item, or null if no good match' },
                },
                required: ['suggestionIndex', 'matchedItemId'],
                additionalProperties: false,
              },
            },
          },
          required: ['matches'],
          additionalProperties: false,
        },
      },
      instructions: `You are a menswear stylist helping a user identify which items they already own that closely match outfit recommendations.

For each outfit suggestion, determine whether any of the user's closet items is a CLOSE match. A close match means:
1. SAME garment type (e.g., both are crewneck t-shirts, or both are chino trousers — not just the same broad category)
2. SIMILAR or COMPATIBLE color (white and black are NOT a match; white and off-white are)
3. COMPATIBLE formality level (a dress shirt is NOT a match for a casual t-shirt)

Be strict. Only return a matchedItemId when you are confident the user could actually substitute their item for the suggestion. Return null when:
- The garment types differ (even if in the same category)
- The colors are clearly different
- The formality levels are mismatched
- No item exists in their closet for that garment type at all`,
      userContent: [
        {
          type: 'input_text',
          text: `OUTFIT SUGGESTIONS (by index):\n${suggestionList}\n\nUSER'S CLOSET ITEMS:\n${itemList}\n\nReturn one match entry per suggestion index (0 through ${payload.suggestions.length - 1}).`,
        },
      ],
    });

    return {
      matches: result.matches.map((m) => ({
        suggestionIndex: m.suggestionIndex,
        suggestion: payload.suggestions[m.suggestionIndex] ?? '',
        matchedItemId: m.matchedItemId,
      })),
    };
  },
};
