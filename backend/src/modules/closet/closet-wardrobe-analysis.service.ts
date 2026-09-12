import { createHash } from 'node:crypto';

import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { closetRepository } from './closet.repository.js';
import { closetAnalysisRepository } from './closet-analysis.repository.js';
import { openAiClient } from '../../ai/openai-client.js';
import {
  buildClosetAdvisoryOnlySystemPrompt,
  buildClosetAdvisoryOnlyUserPrompt,
  buildClosetAnalyseSystemPrompt,
  buildClosetAnalyseUserPrompt,
  type ClosetAnalyseIndexItem,
} from '../../ai/prompts/closet-analyse.prompts.js';
import { CLOSET_ANALYSIS_JSON_SCHEMA, closetAnalysisSchema } from './closet.schemas.js';

// ── Closet Analyser ───────────────────────────────────────────────────────────

// Same exclusion set as HELP_ME_PICK_EXCLUDED on the client — accessories and shoes
// don't count toward the 10-item threshold for analysis.
const ANALYSE_EXCLUDED_CATEGORIES = new Set([
  'Shoes', 'Sneakers', 'Loafers', 'Boots',
  'Belt', 'Bag', 'Watch', 'Scarf', 'Hat', 'Tie', 'Socks', 'Sunglasses',
]);

export async function analyseCloset(supabaseUserId: string) {
  const allItems = await closetRepository.getItems(supabaseUserId);

  // Threshold check uses only non-accessory/non-shoe items
  const nonAccessoryCount = allItems.filter(
    (item) => !ANALYSE_EXCLUDED_CATEGORIES.has(item.category)
  ).length;

  if (nonAccessoryCount < 10) {
    throw new HttpError(422, 'INSUFFICIENT_ITEMS', 'Add at least 10 clothing items to unlock closet analysis.');
  }

  // Pass the full inventory to the LLM — accessories and shoes contribute to occasion/seasonal coverage
  const index: ClosetAnalyseIndexItem[] = allItems.map((item) => ({
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

  // ── Stable score path ────────────────────────────────────────────────
  // Compute a hash from the closet composition (sorted, id-free). If the
  // latest snapshot for this user matches the hash, the wardrobe hasn't
  // changed; reuse the cached scores and run a fresh-advisory-only LLM call.
  const closetHash = computeClosetHash(allItems);
  const itemSignatures = buildItemSignatures(allItems);
  const latest = await closetAnalysisRepository.findLatest(supabaseUserId);

  let aiOutput: z.infer<typeof closetAnalysisSchema>;
  let snapshotForResponse: { totalScore: number; subScores: typeof aiOutput.sub_scores; summary: string; deficientCategory: string; excessCategory: string };
  let usedCache = false;

  if (latest && latest.closetHash === closetHash) {
    // Hash match — reuse scores. Run advisory-only LLM call.
    usedCache = true;
    aiOutput = await runAdvisoryOnly(supabaseUserId, index, latest);
    snapshotForResponse = {
      totalScore: latest.totalScore,
      subScores: latest.subScores,
      summary: latest.summary,
      deficientCategory: latest.deficientCategory,
      excessCategory: latest.excessCategory,
    };
  } else {
    // Hash differs (or first run) — full analysis.
    aiOutput = await runFullAnalysis(supabaseUserId, index);
    const persisted = await closetAnalysisRepository.create({
      supabaseUserId,
      closetHash,
      itemCount: allItems.length,
      totalScore: Math.round(aiOutput.total_score),
      subScores: {
        formality_range:    Math.round(aiOutput.sub_scores.formality_range),
        color_versatility:  Math.round(aiOutput.sub_scores.color_versatility),
        seasonal_coverage:  Math.round(aiOutput.sub_scores.seasonal_coverage),
        layering_options:   Math.round(aiOutput.sub_scores.layering_options),
        occasion_coverage:  Math.round(aiOutput.sub_scores.occasion_coverage),
      },
      summary: aiOutput.summary,
      deficientCategory: aiOutput.deficient_category,
      excessCategory: aiOutput.excess_category,
      itemSignatures,
    });
    snapshotForResponse = {
      totalScore: persisted.totalScore,
      subScores: persisted.subScores,
      summary: persisted.summary,
      deficientCategory: persisted.deficientCategory,
      excessCategory: persisted.excessCategory,
    };
  }

  // ── Delta vs previous snapshot ────────────────────────────────────────
  const delta = buildDelta({
    previous: latest,
    currentTotalScore: snapshotForResponse.totalScore,
    currentItemSignatures: itemSignatures,
    currentItemCount: allItems.length,
    usedCache,
  });

  return {
    total_score: snapshotForResponse.totalScore,
    summary: snapshotForResponse.summary,
    sub_scores: snapshotForResponse.subScores,
    deficient_category: snapshotForResponse.deficientCategory,
    excess_category: snapshotForResponse.excessCategory,
    vittorio: aiOutput.vittorio,
    alessandra: aiOutput.alessandra,
    delta,
    closet_hash: closetHash,
  };
}

type ClosetItemForHash = Awaited<ReturnType<typeof closetRepository.getItems>>[number];

/**
 * Stable hash of the closet composition. Two runs against the same set of
 * items produce the same hash regardless of order. Includes fields that
 * meaningfully change the analysis (category, color family, formality, etc.);
 * excludes ids and timestamps so they don't perturb the hash.
 */
export function computeClosetHash(items: ClosetItemForHash[]): string {
  const projection = items.map((item) => ({
    t: item.title.trim().toLowerCase(),
    c: item.category,
    s: item.subcategory ?? null,
    cf: item.colorFamily ?? null,
    f: item.formality ?? null,
    sil: item.silhouette ?? null,
    se: item.season ?? null,
    m: item.material ?? null,
    p: item.pattern ?? null,
  }));
  projection.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex').slice(0, 24);
}

/**
 * Sorted "category|name" strings used for the delta summary — diffing two
 * arrays of these tells us which items were added or removed since the last
 * analysis without re-fetching old item rows.
 */
export function buildItemSignatures(items: ClosetItemForHash[]): string[] {
  const sigs = items.map((item) => `${item.category}|${item.title.trim()}`);
  sigs.sort((a, b) => a.localeCompare(b));
  return sigs;
}

export type DeltaBuilderInput = {
  previous: Awaited<ReturnType<typeof closetAnalysisRepository.findLatest>>;
  currentTotalScore: number;
  currentItemSignatures: string[];
  currentItemCount: number;
  usedCache: boolean;
};

type DeltaSummary = {
  direction: 'first' | 'same' | 'up' | 'down';
  points: number;
  previous_score: number | null;
  summary: string;
};

export function buildDelta(input: DeltaBuilderInput): DeltaSummary {
  const { previous, currentTotalScore, currentItemSignatures, currentItemCount, usedCache } = input;

  if (!previous) {
    return {
      direction: 'first',
      points: 0,
      previous_score: null,
      summary: 'First closet analysis — this becomes the baseline for future comparisons.',
    };
  }

  const diff = currentTotalScore - previous.totalScore;

  if (usedCache && diff === 0) {
    return {
      direction: 'same',
      points: 0,
      previous_score: previous.totalScore,
      summary: 'Your score is unchanged because your closet has not changed since the last analysis.',
    };
  }

  // Compute added / removed items from the signature diff.
  const prevSet = new Set(previous.itemSignatures);
  const currSet = new Set(currentItemSignatures);
  const added: string[] = [];
  const removed: string[] = [];
  for (const sig of currentItemSignatures) {
    if (!prevSet.has(sig)) added.push(sig);
  }
  for (const sig of previous.itemSignatures) {
    if (!currSet.has(sig)) removed.push(sig);
  }

  const addedNames = added.map((sig) => sig.split('|', 2)[1] ?? sig).slice(0, 3);
  const removedNames = removed.map((sig) => sig.split('|', 2)[1] ?? sig).slice(0, 3);

  const direction: DeltaSummary['direction'] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  const verb = diff > 0 ? 'improved' : diff < 0 ? 'dropped' : 'is unchanged';
  const points = Math.abs(diff);
  const pointsClause = diff === 0 ? '' : ` by ${points} point${points === 1 ? '' : 's'}`;

  let reason: string;
  if (added.length > 0 && removed.length === 0) {
    const addedSummary = addedNames.join(', ');
    const more = added.length > addedNames.length ? ` and ${added.length - addedNames.length} more` : '';
    reason = `after adding ${added.length} item${added.length === 1 ? '' : 's'} (${addedSummary}${more}).`;
  } else if (removed.length > 0 && added.length === 0) {
    const removedSummary = removedNames.join(', ');
    const more = removed.length > removedNames.length ? ` and ${removed.length - removedNames.length} more` : '';
    reason = `after removing ${removed.length} item${removed.length === 1 ? '' : 's'} (${removedSummary}${more}).`;
  } else if (added.length > 0 && removed.length > 0) {
    reason = `after ${added.length} addition${added.length === 1 ? '' : 's'} and ${removed.length} removal${removed.length === 1 ? '' : 's'}.`;
  } else {
    // No item-level diff but score moved (or didn't) — usually unreachable when
    // usedCache is true, but reachable if metadata on existing items changed.
    reason = 'after updates to existing items.';
  }

  const summary = diff === 0
    ? `Your score is unchanged (${currentTotalScore}/100) ${reason}`
    : `Your score ${verb}${pointsClause} (${previous.totalScore} → ${currentTotalScore}) ${reason}`;

  return {
    direction,
    points,
    previous_score: previous.totalScore,
    summary,
  };
}

async function runFullAnalysis(supabaseUserId: string, index: ClosetAnalyseIndexItem[]) {
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
}

async function runAdvisoryOnly(
  supabaseUserId: string,
  index: ClosetAnalyseIndexItem[],
  cached: NonNullable<Awaited<ReturnType<typeof closetAnalysisRepository.findLatest>>>,
) {
  const cachedScoresPayload = {
    total_score: cached.totalScore,
    summary: cached.summary,
    sub_scores: cached.subScores,
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await openAiClient.createStructuredResponse({
        schema: closetAnalysisSchema,
        jsonSchema: CLOSET_ANALYSIS_JSON_SCHEMA,
        instructions: buildClosetAdvisoryOnlySystemPrompt(),
        userContent: [{
          type: 'input_text' as const,
          text: buildClosetAdvisoryOnlyUserPrompt({ items: index, cachedScores: cachedScoresPayload }),
        }],
        supabaseUserId,
        feature: 'closet-analyse',
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
