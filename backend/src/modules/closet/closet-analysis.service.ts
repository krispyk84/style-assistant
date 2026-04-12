import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { openAiClient } from '../../ai/openai-client.js';
import { storageConfig } from '../../config/storage.js';
import { HttpError } from '../../lib/http-error.js';
import type { AnalyzeClosetItemPayload, ClosetMatchPayload } from './closet.validation.js';
import { filterCandidatesPerSuggestion, buildCandidateItemsForLlm } from './closet-matcher.js';
import {
  ANALYZE_INSTRUCTIONS,
  buildAnalyzeUserContent,
  buildAnalyzeJsonSchema,
  buildMatchJsonSchema,
  buildMatchUserContent,
  buildMatchInstructions,
} from './closet-prompt-builders.js';

const analyzeResponseSchema = z.object({
  title: z.string(),
  category: z.string(),
  brand: z.string(),
  subcategory: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  colorFamily: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  formality: z.string().nullable().optional(),
  silhouette: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
  lensShape: z.string().nullable().optional(),
  frameColor: z.string().nullable().optional(),
});

const matchResponseSchema = z.object({
  matches: z.array(
    z.object({
      suggestionIndex: z.number(),
      matchedItemId: z.string().nullable(),
    })
  ),
});

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  // Prefer reading directly from disk — faster and avoids self-HTTP requests on Render.
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
  if (!res.ok) throw new Error(`Image fetch failed with HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

export async function analyzeClosetItem(payload: AnalyzeClosetItemPayload, supabaseUserId?: string) {
  const candidateUrls = [payload.uploadedImageUrl, payload.sketchImageUrl].filter((u): u is string => Boolean(u));
  let resolvedDataUrl: string | null = null;
  for (const url of candidateUrls) {
    try {
      resolvedDataUrl = await imageUrlToDataUrl(url);
      break;
    } catch {
      // try next candidate
    }
  }
  if (candidateUrls.length > 0 && !resolvedDataUrl) {
    throw new HttpError(422, 'IMAGE_UNAVAILABLE', 'The item image is no longer available. Re-save the item to restore it.');
  }

  const result = await openAiClient.createStructuredResponse({
    schema: analyzeResponseSchema,
    jsonSchema: buildAnalyzeJsonSchema(),
    instructions: ANALYZE_INSTRUCTIONS,
    userContent: buildAnalyzeUserContent(payload, resolvedDataUrl),
    supabaseUserId,
    feature: 'closet-analyze',
  });

  return result;
}

export async function matchClosetItems(payload: ClosetMatchPayload, supabaseUserId?: string) {
  if (!payload.items.length) {
    return {
      matches: payload.suggestions.map((s, i) => ({
        suggestionIndex: i,
        suggestion: s.display_name,
        matchedItemId: null,
      })),
    };
  }

  const excludeSet = new Set(payload.excludeItemIds ?? []);
  const availableItems = excludeSet.size
    ? payload.items.filter((item) => !excludeSet.has(item.id))
    : payload.items;

  const candidatesPerSuggestion = filterCandidatesPerSuggestion(payload.suggestions, availableItems);
  const itemsForLlm = buildCandidateItemsForLlm(availableItems, candidatesPerSuggestion);

  if (!itemsForLlm.length) {
    return {
      matches: payload.suggestions.map((s, i) => ({
        suggestionIndex: i,
        suggestion: s.display_name,
        matchedItemId: null,
      })),
    };
  }

  const result = await openAiClient.createStructuredResponse({
    schema: matchResponseSchema,
    jsonSchema: buildMatchJsonSchema(),
    instructions: buildMatchInstructions(payload.sensitivity),
    userContent: buildMatchUserContent(itemsForLlm, payload.suggestions, candidatesPerSuggestion),
    supabaseUserId,
    feature: 'closet-match',
  });

  return {
    matches: result.matches.map((m) => ({
      suggestionIndex: m.suggestionIndex,
      suggestion: payload.suggestions[m.suggestionIndex]?.display_name ?? '',
      matchedItemId: m.matchedItemId,
    })),
  };
}
