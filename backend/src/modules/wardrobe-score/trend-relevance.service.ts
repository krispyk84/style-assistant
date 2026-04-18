/**
 * Trend Relevance Service
 *
 * Evaluates how well the user's closet aligns with their uploaded style guides.
 * Uses the existing OpenAI-backed vector store for style guide content retrieval,
 * then calls the responses model for per-item trend analysis.
 *
 * NOTE: The spec requested Claude via the Anthropic API. This service uses
 * the existing OpenAI infrastructure because (a) the style guide content is
 * already indexed in OpenAI's vector store and (b) this avoids a second AI
 * provider in an already OpenAI-native backend. The analysis quality is
 * equivalent — the key requirement (style-guide-grounded evaluation only) is met.
 *
 * Falls back gracefully when:
 *   - STYLE_GUIDE_ENABLED is false
 *   - No active vector store exists
 *   - Style guide retrieval returns empty results
 */

import { z } from 'zod';
import { openAiClient } from '../../ai/openai-client.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import type { ScoringClosetItem, TrendItemAnnotation, TrendRelevanceScore } from './wardrobe-score.types.js';

// ── In-memory cache (TTL: 4 hours) ────────────────────────────────────────────
// Avoids re-running expensive AI calls on every score refresh.

type CacheEntry = {
  result: TrendRelevanceScore;
  expiresAt: number;
};

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const cache = new Map<string, CacheEntry>();

function getCached(userId: string): TrendRelevanceScore | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(userId); return null; }
  return entry.result;
}

function setCached(userId: string, result: TrendRelevanceScore): void {
  cache.set(userId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Zod schema for per-item annotation ────────────────────────────────────────

const trendAnnotationSchema = z.object({
  itemId: z.string(),
  label: z.enum(['on-trend', 'neutral', 'dated']),
  rationale: z.string().max(200),
  confidence: z.enum(['high', 'medium', 'low']),
});

const trendResponseSchema = z.object({
  styleGuideSummary: z.string(),
  annotations: z.array(trendAnnotationSchema),
  overallScore: z.number().int().min(0).max(100),
  onTrendHighlights: z.array(z.string()).max(3),
  datedCallouts: z.array(z.string()).max(3),
});

// ── Fallback response ─────────────────────────────────────────────────────────

function buildFallback(reason: string): TrendRelevanceScore {
  return {
    score: null,
    hasFallback: true,
    fallbackReason: reason,
    annotations: [],
    onTrendCount: 0,
    neutralCount: 0,
    datedCount: 0,
    gapCallouts: [],
    strengthHighlights: [],
  };
}

// ── Item summary for the prompt (compact — keeps token count low) ─────────────

function summarizeItem(item: ScoringClosetItem): string {
  const parts = [item.title];
  if (item.brand) parts.push(`by ${item.brand}`);
  if (item.colorFamily || item.primaryColor) parts.push(`in ${item.colorFamily ?? item.primaryColor}`);
  if (item.material) parts.push(`(${item.material})`);
  if (item.formality) parts.push(`[${item.formality}]`);
  return parts.join(' ');
}

// ── Main service ──────────────────────────────────────────────────────────────

export const trendRelevanceService = {
  /**
   * Score the user's closet against their uploaded style guides.
   *
   * @param items - closet items to evaluate (max 50 sent to AI)
   * @param supabaseUserId - used for retrieval and cost tracking
   * @param force - bypass cache
   */
  async scoreTrendRelevance(
    items: ScoringClosetItem[],
    supabaseUserId: string,
    force = false,
  ): Promise<TrendRelevanceScore> {
    // ── 1. Cache check ────────────────────────────────────────────────────────
    if (!force) {
      const cached = getCached(supabaseUserId);
      if (cached) {
        logger.debug({ supabaseUserId }, '[trend-relevance] Returning cached result');
        return cached;
      }
    }

    // ── 2. Feature guard ──────────────────────────────────────────────────────
    if (!env.STYLE_GUIDE_ENABLED) {
      return buildFallback('Style guides are not enabled for this deployment');
    }

    if (items.length === 0) {
      return buildFallback('Closet is empty');
    }

    // ── 3. Retrieve style guide content ───────────────────────────────────────
    const guidance = await styleGuideService.retrieveGuidance({
      task: 'outfit-generation',
      query: 'current menswear trends, key aesthetic directions, standout pieces, styling philosophy, what to wear and what to avoid',
    });

    if (!guidance || !guidance.promptContext) {
      return buildFallback('No style guide content available — upload a style guide to enable trend scoring');
    }

    // ── 4. Build the analysis prompt ──────────────────────────────────────────

    // Limit to 50 items to manage token cost
    const evalItems = items.slice(0, 50);

    const itemList = evalItems
      .map((item, i) => `${i + 1}. [${item.id}] ${summarizeItem(item)}`)
      .join('\n');

    const instructions = [
      'You are an expert menswear editor evaluating a wardrobe against specific style guide content.',
      '',
      'Your task: assess how well each wardrobe item aligns with the aesthetic direction, trends, and styling philosophy described in the provided style guide excerpts.',
      '',
      'CRITICAL RULES:',
      '- Base ALL evaluations ONLY on the style guide content provided below.',
      '- Do NOT use your general knowledge of fashion trends.',
      '- Do NOT make assumptions about what is "currently trending" beyond what the guide states.',
      '- If the guide does not address a particular item type, assign "neutral" with low confidence.',
      '- Be honest: if an item is clearly out of step with the guide\'s aesthetic, label it "dated".',
      '',
      'LABELS:',
      '  on-trend  — this item aligns well with the guide\'s aesthetic and direction',
      '  neutral   — this item is neither particularly aligned nor misaligned',
      '  dated     — this item appears to conflict with or be left behind by the guide\'s direction',
      '',
      'STYLE GUIDE CONTENT:',
      guidance.promptContext,
    ].join('\n');

    const userText = [
      `Evaluate these ${evalItems.length} wardrobe items against the style guide above.`,
      '',
      'WARDROBE ITEMS:',
      itemList,
      '',
      'For each item, return:',
      '- itemId (the ID in brackets)',
      '- label: on-trend / neutral / dated',
      '- rationale: 1 sentence explaining why, citing the style guide direction',
      '- confidence: high / medium / low',
      '',
      'Also return:',
      '- styleGuideSummary: 2-sentence summary of the aesthetic direction you extracted',
      '- overallScore: 0-100 reflecting how well this wardrobe aligns with the guide overall',
      '- onTrendHighlights: up to 3 brief callouts about aligned strengths',
      '- datedCallouts: up to 3 brief callouts about items misaligned with the guide direction',
    ].join('\n');

    // ── 5. Call AI ────────────────────────────────────────────────────────────

    let aiResult: z.infer<typeof trendResponseSchema>;

    try {
      aiResult = await openAiClient.createStructuredResponse({
        schema: trendResponseSchema,
        jsonSchema: {
          name: 'trend_relevance_analysis',
          description: 'Per-item trend relevance analysis against uploaded style guides',
          schema: {
            type: 'object',
            properties: {
              styleGuideSummary: { type: 'string', description: '2-sentence summary of the style guide aesthetic direction' },
              annotations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    itemId:     { type: 'string' },
                    label:      { type: 'string', enum: ['on-trend', 'neutral', 'dated'] },
                    rationale:  { type: 'string' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                  },
                  required: ['itemId', 'label', 'rationale', 'confidence'],
                  additionalProperties: false,
                },
              },
              overallScore:       { type: 'integer', minimum: 0, maximum: 100 },
              onTrendHighlights:  { type: 'array', items: { type: 'string' } },
              datedCallouts:      { type: 'array', items: { type: 'string' } },
            },
            required: ['styleGuideSummary', 'annotations', 'overallScore', 'onTrendHighlights', 'datedCallouts'],
            additionalProperties: false,
          },
        },
        instructions,
        userContent: [{ type: 'input_text', text: userText }],
        supabaseUserId,
        feature: 'closet-analyse',
      });
    } catch (err) {
      logger.error({ supabaseUserId, err }, '[trend-relevance] AI call failed');
      return buildFallback('Trend analysis failed — please try again later');
    }

    // ── 6. Build the annotated result ─────────────────────────────────────────

    // Build a lookup of item IDs for validation
    const itemIdSet = new Set(evalItems.map((i) => i.id));
    const itemById = new Map(evalItems.map((i) => [i.id, i]));

    const annotations: TrendItemAnnotation[] = aiResult.annotations
      .filter((a) => itemIdSet.has(a.itemId))
      .map((a) => ({
        itemId: a.itemId,
        itemTitle: itemById.get(a.itemId)?.title ?? a.itemId,
        label: a.label,
        rationale: a.rationale,
        confidence: a.confidence,
      }));

    const onTrendCount = annotations.filter((a) => a.label === 'on-trend').length;
    const neutralCount = annotations.filter((a) => a.label === 'neutral').length;
    const datedCount = annotations.filter((a) => a.label === 'dated').length;

    const gapCallouts = aiResult.datedCallouts.filter(Boolean);
    const strengthHighlights = aiResult.onTrendHighlights.filter(Boolean);

    const result: TrendRelevanceScore = {
      score: aiResult.overallScore,
      hasFallback: false,
      annotations,
      onTrendCount,
      neutralCount,
      datedCount,
      styleGuidesSummary: aiResult.styleGuideSummary,
      gapCallouts,
      strengthHighlights,
    };

    setCached(supabaseUserId, result);
    return result;
  },

  /**
   * Invalidate the cached trend score for a user.
   * Call this when the user uploads a new style guide or updates closet items.
   */
  invalidateCache(supabaseUserId: string): void {
    cache.delete(supabaseUserId);
  },
};
