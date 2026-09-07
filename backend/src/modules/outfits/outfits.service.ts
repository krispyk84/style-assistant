import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError, HttpError } from '../../lib/http-error.js';
import type { GenerateOutfitsRequest, OutfitResponse, OutfitTierSlug } from '../../contracts/outfits.contracts.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildAnchorImageContent } from '../../ai/image-input.js';
import type { SubjectRenderingInput } from '../../ai/body-type-severity.js';
import {
  buildSingleTierRegenerationJsonSchema,
  singleTierRegenerationSchema,
  buildTieredOutfitGenerationJsonSchema,
  tieredOutfitGenerationSchema,
  buildClosetOnlyTieredOutfitGenerationJsonSchema,
  buildClosetOnlySingleTierRegenerationJsonSchema,
  closetOnlyTieredOutfitGenerationSchema,
  closetOnlySingleTierRegenerationSchema,
  type ClosetOnlyOutfitRecommendation,
  type ClosetOnlyRoleIds,
  type TieredOutfitGeneration,
} from './outfits.schemas.js';
import { buildClosetIndex } from '../closet/closet-index.js';
import {
  buildAccessoryShortlist,
  buildFrameworkBreakdown,
  buildOutfitSlotShortlists,
  fillMissingRequiredSlots,
  normalizeSuitDualRole,
} from '../closet/closet-outfit-builder.js';
import {
  ACCESSORY_GROUPS,
  FORMALITY_RANK,
  resolveGarmentGroup,
  GROUP_TO_SLOTS,
  requiredSlotsForTier,
  TIER_FORMALITY_TARGET,
  type OutfitSlot,
  type TierSlug,
} from '../closet/closet-taxonomy.js';
import { closetRepository } from '../closet/closet.repository.js';
import type { ClosetOutfitIndexItem, ClosetOutfitSlotShortlists } from '../../ai/prompts/closet-outfits.prompts.js';
import { buildGenerateOutfitsInstructions, buildGenerateOutfitsUserPrompt, buildRegenerateTierInstructions, buildRegenerateTierUserPrompt } from '../../ai/prompts/outfits.prompts.js';
import {
  buildOutfitGenerationStyleGuideQuery,
  buildOutfitRegenerationStyleGuideQuery,
  getCanonicalAnchorDescription,
  getNormalizedAnchorItems,
} from './outfits-prompt-builders.js';
import { buildStableSketchUrl, mapOutfitRecommendation } from './outfits-response-mapper.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { outfitsRepository } from './outfits.repository.js';
import { profileRepository } from '../profile/profile.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import { tierSketchService } from './tier-sketch.service.js';
import { seasonalTrendsService } from '../seasonal-trends/seasonal-trends.service.js';
import { trendFeedbackService } from '../seasonal-trends/trend-feedback.service.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';

const CANONICAL_TIERS: OutfitTierSlug[] = ['business', 'smart-casual', 'casual'];

// Outfit sketches are stored as DB blobs (TierResult.sketchImageData), so
// unbounded history growth is unbounded Postgres storage growth. Keep the
// most recent N generations per user; anything older gets pruned, except a
// request that's currently favourited or assigned to a week day — those stay
// forever regardless of age, since Favourites/Week always resolve their
// sketch image live from this same TierResult row by requestId+tier.
export const HISTORY_RETENTION_LIMIT = 50;


async function findProfile(supabaseUserId: string, profileId?: string) {
  if (profileId) {
    return profileRepository.findById(profileId);
  }
  return profileRepository.findByUserId(supabaseUserId);
}

type ProfileLike = Awaited<ReturnType<typeof findProfile>>;

function fashionGenderForProfile(profile: ProfileLike): FashionGender {
  return profile?.gender === 'woman' ? 'womenswear' : 'menswear';
}

async function loadSeasonalTrends(profile: ProfileLike, hemisphere: Hemisphere | undefined, supabaseUserId: string) {
  if (!hemisphere) return null;
  const fashionGender = fashionGenderForProfile(profile);
  const [result, feedbackMap] = await Promise.all([
    seasonalTrendsService.getCurrentTrendProfile(fashionGender, hemisphere),
    trendFeedbackService.getFeedbackMap(supabaseUserId, fashionGender),
  ]);
  if (!result) return null;
  return { ...result, feedbackMap };
}

function profileToSubject(profile: ProfileLike): SubjectRenderingInput {
  return {
    gender: profile?.gender ?? null,
    bodyType: profile?.bodyType ?? null,
    fitTendency: profile?.fitTendency ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    weightDistribution: profile?.weightDistribution ?? null,
    skinTone: profile?.skinTone ?? null,
  };
}

// ── closetOnly helpers ─────────────────────────────────────────────────────────
// Item selection for closetOnly is shortlist-constrained, not free-invented:
// per-tier, per-slot shortlists (closet-outfit-builder.ts) are injected into
// the SAME rich generation prompt (female framework, trendiness, seasonal
// trends, vibe keywords, business-tier defaults all stay exactly as they are
// for the freeform path) — only the source of real items changes. The model
// still makes every styling judgment; it just picks ids from a pre-vetted,
// formality-correct pool instead of describing invented pieces.

export type BuilderItem = Awaited<ReturnType<typeof closetRepository.getItems>>[number];

// Exported for characterization tests only (see __tests__/closet-only-accessories.characterization.test.ts) —
// no behavior change, just visibility into the closet-only accessory resolution this module already performs.
export function weatherGates(temperatureC: number | null, tier: TierSlug): { includeThermalLayer: boolean; includeOuterwear: boolean } {
  const gates =
    temperatureC == null
      ? { includeThermalLayer: true, includeOuterwear: true }
      : temperatureC >= 24
        ? { includeThermalLayer: false, includeOuterwear: false }
        : temperatureC >= 18
          ? { includeThermalLayer: false, includeOuterwear: true }
          : { includeThermalLayer: true, includeOuterwear: true };

  // Business always has a structured secondary top (blazer or suit jacket)
  // already providing warmth/structure — a genuine overcoat only belongs
  // over that when it's actually cold, not just "mild-cool" like the base
  // gate above allows for casual/smart-casual's optional secondary top.
  if (tier === 'business' && gates.includeOuterwear && temperatureC != null) {
    gates.includeOuterwear = temperatureC < 10;
  }
  return gates;
}

function toIndexItem(item: BuilderItem): ClosetOutfitIndexItem {
  return {
    id: item.id,
    name: item.title,
    category: item.category,
    color_family: item.colorFamily ?? null,
    formality: item.formality ?? null,
    silhouette: item.silhouette ?? null,
    season: item.season ?? null,
    material: item.material ?? null,
    brand: item.brand || null,
  };
}

const TIER_DEFAULT_FORMALITY: Record<string, string> = {
  business: 'Formal',
  'smart-casual': 'Refined Casual',
  casual: 'Casual',
};

// Synthesizes an outfitPieceSchema-shaped object from a real closet item —
// this (not the model) is what determines display_name/metadata for
// closetOnly recommendations, which is what makes phantom pieces (narrated
// text with no backing real item) structurally impossible.
function synthesizePiece(item: BuilderItem, tier: OutfitTierSlug) {
  return {
    display_name: item.title,
    metadata: {
      category: item.category as any,
      color: item.colorFamily || 'Neutral',
      material: item.material ?? null,
      formality: (item.formality ?? TIER_DEFAULT_FORMALITY[tier] ?? 'Smart Casual') as any,
    },
  };
}

export type TierRoleIdSets = { keyPieces: Set<string>; shoes: Set<string>; accessories: Set<string> };

/**
 * Builds this tier's per-slot shortlists, grouped into the three roles the
 * closetOnly schema exposes (keyPieces/shoes/accessories), plus the prompt-
 * ready shortlist block. hat/bag are only offered when the user opted in via
 * includeHat/includeBag (pre-generation checkboxes on Create a Look, not a
 * post-generation toggle).
 */
export function buildTierRoleShortlists(params: {
  closetItems: BuilderItem[];
  tier: OutfitTierSlug;
  includeThermalLayer: boolean;
  includeOuterwear: boolean;
  includeHat: boolean;
  includeBag: boolean;
}): { forPrompt: ClosetOutfitSlotShortlists; idSets: TierRoleIdSets } {
  const targetFormalityRank = TIER_FORMALITY_TARGET[params.tier] ?? FORMALITY_RANK['Refined Casual'];
  const shortlists = buildOutfitSlotShortlists({
    closetItems: params.closetItems,
    targetFormalityRank,
    tier: params.tier,
    includeThermalLayer: params.includeThermalLayer,
    includeOuterwear: params.includeOuterwear,
    includeHat: params.includeHat,
    includeBag: params.includeBag,
  });

  const forPrompt: ClosetOutfitSlotShortlists = {};
  const idSets: TierRoleIdSets = { keyPieces: new Set(), shoes: new Set(), accessories: new Set() };
  const accessorySlots = new Set<OutfitSlot>(['watch', 'sunglasses', 'hat', 'bag']);

  for (const slot of Object.keys(shortlists) as OutfitSlot[]) {
    const items = shortlists[slot];
    if (!items?.length) continue;
    forPrompt[slot] = items.map(toIndexItem);
    const ids = items.map((item) => item.id);
    if (slot === 'footwear') ids.forEach((id) => idSets.shoes.add(id));
    else if (accessorySlots.has(slot)) ids.forEach((id) => idSets.accessories.add(id));
    else ids.forEach((id) => idSets.keyPieces.add(id)); // bottoms/primaryTop/secondaryTop/thermalLayer/outerwear
  }

  // "Additional Accessories" — belt/scarf/tie/socks — folded into the same
  // accessories role as watch/sunglasses/hat/bag (the closetOnly schema
  // doesn't split this out into its own field the way trips/closet-outfits do).
  const additionalAccessories = buildAccessoryShortlist(params.closetItems, targetFormalityRank);
  if (additionalAccessories.length) {
    forPrompt.accessory = additionalAccessories.map(toIndexItem);
    additionalAccessories.forEach((item) => idSets.accessories.add(item.id));
  }

  return { forPrompt, idSets };
}

function isSuit(item: BuilderItem | undefined): boolean {
  return !!item && resolveGarmentGroup(item) === 'suit';
}

// Classifies a flat resolved item-id list back into slots (plus any multi-
// pick "Additional Accessories" items) for the framework breakdown — mirrors
// closet-outfits.service.ts's/trips.service.ts's equivalent.
function classifyItemsBySlot(
  itemIds: string[],
  itemsById: Map<string, BuilderItem>,
): { bySlot: Partial<Record<OutfitSlot, BuilderItem>>; accessoryItems: BuilderItem[] } {
  const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = {};
  const accessoryItems: BuilderItem[] = [];
  for (const id of itemIds) {
    const item = itemsById.get(id);
    if (!item) continue;
    const group = resolveGarmentGroup(item);
    const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
    if (slot) {
      bySlot[slot] = item;
    } else if (group && ACCESSORY_GROUPS.includes(group)) {
      accessoryItems.push(item);
    }
  }
  normalizeSuitDualRole(bySlot);
  return { bySlot, accessoryItems };
}

const KEY_PIECE_SLOTS: OutfitSlot[] = ['bottoms', 'primaryTop', 'secondaryTop', 'thermalLayer', 'outerwear'];

/**
 * Enforces the outfit framework on the flat keyPieces bucket (which has no
 * per-role schema keys the way trips/closet-outfits' chosenIds map does):
 * classifies each chosen id by the slot its garment group fills, keeps at
 * most one item per slot (a suit wins over an already-placed separate
 * trousers/blazer for bottoms/secondaryTop — one physical piece fills both
 * at once; any other second pick for an already-filled slot is a real model
 * error, not a suit, and is dropped), then force-fills bottoms/primaryTop
 * always and secondaryTop additionally for business if still missing.
 * thermalLayer/outerwear stay independent of the suit and of each other.
 */
function normalizeKeyPieceRoles(
  keyPieceIds: string[],
  itemsById: Map<string, BuilderItem>,
  tier: OutfitTierSlug,
  targetFormalityRank: number,
  closetItems: BuilderItem[],
): string[] {
  const items = keyPieceIds.map((id) => itemsById.get(id)).filter((item): item is BuilderItem => Boolean(item));
  const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = {};

  for (const item of items) {
    const group = resolveGarmentGroup(item);
    const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
    if (!slot || !KEY_PIECE_SLOTS.includes(slot)) continue;
    if (!bySlot[slot] || (isSuit(item) && !isSuit(bySlot[slot]))) {
      bySlot[slot] = item;
    }
  }
  normalizeSuitDualRole(bySlot);

  // Derived from the same canonical requiredSlotsForTier() trips/closet-outfits
  // use, filtered to the slots this function is scoped to (KEY_PIECE_SLOTS) —
  // footwear/watch/sunglasses are guaranteed separately (see resolveRole calls
  // below), and hat/bag stay strictly opt-in, matching the other two engines.
  const requiredSlots = requiredSlotsForTier(tier as TierSlug).filter((slot) => KEY_PIECE_SLOTS.includes(slot));
  fillMissingRequiredSlots({ bySlot, closetItems, requiredSlots, tier: tier as TierSlug, targetFormalityRank });
  normalizeSuitDualRole(bySlot);

  return [...new Set(Object.values(bySlot).map((item) => (item as BuilderItem).id))];
}

// watch/sunglasses are TIER_SLOT_RULES' only `required: true` slots that live
// inside the closet-only schema's merged accessoryIds bucket (alongside the
// genuinely-optional hat/bag/belt/scarf/tie/socks) rather than as their own
// schema fields the way trips.service.ts/closet-outfits.service.ts expose
// them — so, unlike those two engines, the model here can return an empty
// accessoryIds array and silently omit a watch or sunglasses item even when
// one is eligible in the closet. fillRequiredAccessorySlots closes that gap
// using the SAME canonical primitives (requiredSlotsForTier +
// fillMissingRequiredSlots) already used to guarantee keyPieces slots above —
// not a new special-cased rule, just applying the existing shared "required
// slot, only if an eligible item exists, never fail generation otherwise"
// contract to the two accessory slots that were incorrectly left out of it.
// hat/bag/belt/scarf/tie/socks are untouched — they were never in
// requiredSlotsForTier's output and stay exactly as optional as before.
const ACCESSORY_REQUIRED_SLOTS: OutfitSlot[] = ['watch', 'sunglasses'];

function fillRequiredAccessorySlots(
  accessoryIds: string[],
  idSets: TierRoleIdSets,
  itemsById: Map<string, BuilderItem>,
  tier: OutfitTierSlug,
  targetFormalityRank: number,
): string[] {
  const requiredAccessorySlots = requiredSlotsForTier(tier as TierSlug).filter((slot): slot is OutfitSlot =>
    ACCESSORY_REQUIRED_SLOTS.includes(slot),
  );
  if (requiredAccessorySlots.length === 0) return accessoryIds;

  // Classify the model's own accessory picks by slot first, so an
  // already-chosen watch/sunglasses item is recognized and never
  // second-guessed or duplicated by the fallback below.
  const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = {};
  for (const id of accessoryIds) {
    const item = itemsById.get(id);
    if (!item) continue;
    const group = resolveGarmentGroup(item);
    const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
    if (slot && ACCESSORY_REQUIRED_SLOTS.includes(slot)) bySlot[slot] = item;
  }

  // Scoped to idSets.accessories (this tier's already-shortlisted, formality-
  // filtered candidates) — fillMissingRequiredSlots only ever fills a slot
  // when a candidate actually exists in that pool; if the closet has no
  // eligible watch/sunglasses at all, this is a no-op and generation still
  // succeeds with that slot left empty, exactly like every other slot.
  const eligibleClosetItems = [...idSets.accessories]
    .map((id) => itemsById.get(id))
    .filter((item): item is BuilderItem => Boolean(item));
  fillMissingRequiredSlots({
    bySlot,
    closetItems: eligibleClosetItems,
    requiredSlots: requiredAccessorySlots,
    tier: tier as TierSlug,
    targetFormalityRank,
  });

  const filledIds = Object.values(bySlot).map((item) => (item as BuilderItem).id);
  return [...new Set([...accessoryIds, ...filledIds])];
}

/**
 * Resolves the model's chosen ids back into real items and synthesizes
 * outfitPieceSchema-shaped pieces — the result converges with the freeform
 * path's shape so mapOutfitRecommendation/downstream code needs no changes.
 * Falls back to this tier's own first available id per required role if the
 * model's picks don't validate (never leaves keyPieces/shoes empty), and
 * normalizeKeyPieceRoles enforces one-per-slot + the tier's required roles.
 * fillRequiredAccessorySlots gives watch/sunglasses the same guarantee
 * whenever the closet has an eligible item, without making hat/bag/belt/
 * scarf/tie/socks required (they stay purely optional).
 */
export function resolveClosetOnlyRecommendation(
  recommendation: ClosetOnlyOutfitRecommendation,
  idSets: TierRoleIdSets,
  itemsById: Map<string, BuilderItem>,
  closetItems: BuilderItem[],
): TieredOutfitGeneration['recommendations'][number] {
  const resolveRole = (ids: string[], validIds: Set<string>, required: boolean): string[] => {
    const valid = ids.filter((id) => validIds.has(id) && itemsById.has(id));
    if (valid.length > 0) return valid;
    if (required && validIds.size > 0) return [[...validIds][0]!];
    return [];
  };

  const targetFormalityRank = TIER_FORMALITY_TARGET[recommendation.tier] ?? FORMALITY_RANK['Refined Casual'];
  const keyPieceIds = normalizeKeyPieceRoles(
    resolveRole(recommendation.keyPieceIds, idSets.keyPieces, true),
    itemsById,
    recommendation.tier,
    targetFormalityRank,
    closetItems,
  );
  const shoeIds = resolveRole(recommendation.shoeIds, idSets.shoes, true);
  const rawAccessoryIds = resolveRole(recommendation.accessoryIds, idSets.accessories, false);
  const accessoryIds = fillRequiredAccessorySlots(rawAccessoryIds, idSets, itemsById, recommendation.tier, targetFormalityRank);
  const closetItemIds = [...keyPieceIds, ...shoeIds, ...accessoryIds];
  const { bySlot: framedBySlot, accessoryItems: framedAccessoryItems } = classifyItemsBySlot(closetItemIds, itemsById);

  return {
    tier: recommendation.tier,
    title: recommendation.title,
    anchorItem: recommendation.anchorItem,
    anchorPiece: recommendation.anchorPiece,
    keyPieces: keyPieceIds.map((id) => synthesizePiece(itemsById.get(id)!, recommendation.tier)),
    shoes: shoeIds.map((id) => synthesizePiece(itemsById.get(id)!, recommendation.tier)),
    accessories: accessoryIds.map((id) => synthesizePiece(itemsById.get(id)!, recommendation.tier)),
    fitNotes: recommendation.fitNotes,
    whyItWorks: recommendation.whyItWorks,
    stylingDirection: recommendation.stylingDirection,
    detailNotes: recommendation.detailNotes,
    closetItemIds,
    framework: buildFrameworkBreakdown({ tier: recommendation.tier, bySlot: framedBySlot, accessoryItems: framedAccessoryItems }),
  };
}

export const outfitsService = {
  async getOutfitResult(requestId: string) {
    const existing = await outfitsRepository.findGeneratedOutfit(requestId);

    if (!existing) {
      throw new HttpError(404, 'OUTFIT_REQUEST_NOT_FOUND', 'No outfit request exists for the provided id.');
    }

    return {
      ...existing,
      recommendations: existing.recommendations.map((recommendation) => ({
        ...recommendation,
        sketchImageUrl:
          recommendation.sketchStatus === 'ready'
            ? buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, requestId, recommendation.tier, `${existing.generatedAt}-${recommendation.variantIndex}`)
            : null,
      })),
    };
  },

  async getTierSketch(requestId: string, tier: OutfitTierSlug) {
    const sketch = await outfitsRepository.findTierSketch(requestId, tier);

    if (!sketch || sketch.sketchStatus !== 'ready') {
      throw new HttpError(404, 'OUTFIT_SKETCH_NOT_FOUND', 'No sketch exists for the provided outfit tier.');
    }

    if (sketch.sketchImageData) {
      return {
        mimeType: sketch.sketchMimeType ?? 'image/jpeg',
        data: sketch.sketchImageData,
      };
    }

    if (sketch.sketchStorageKey) {
      return {
        redirectUrl: `${env.STORAGE_PUBLIC_BASE_URL}/media/${sketch.sketchStorageKey}`,
      };
    }

    throw new HttpError(404, 'OUTFIT_SKETCH_NOT_FOUND', 'No sketch exists for the provided outfit tier.');
  },

  async generateOutfits(input: GenerateOutfitsRequest, supabaseUserId: string, variantMap?: Partial<Record<OutfitTierSlug, number>>) {
    const selectedTiers = CANONICAL_TIERS.filter((tier) => input.selectedTiers.includes(tier));
    // generateOnlyTier: limit what OpenAI generates to one tier while DB stores the full selection.
    const tiersToGenerate = input.generateOnlyTier
      ? selectedTiers.filter((t) => t === input.generateOnlyTier)
      : selectedTiers;
    const anchorItems = getNormalizedAnchorItems(input);
    const profile = await findProfile(supabaseUserId, input.profileId);
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );
    const primaryUploadedAnchorImage = uploadedAnchorImages.find(Boolean) ?? null;

    // When vibe keywords are provided they take precedence over the profile's saved
    // fitPreference and stylePreference for this request. This affects both the
    // style-guide retrieval query (so the fetched guidance reflects the vibe) and
    // the prompt (via formatProfileContext — see outfits.prompts.ts).
    const vibeKeywords = input.vibeKeywords?.trim() || null;

    // closetOnly: item selection is shortlist-constrained (real, formality-
    // appropriate closet items only, per tier) instead of free-invented —
    // mirrors closet-outfits.service.ts/trips.service.ts's same fix.
    const itemsById = input.closetOnly ? (await buildClosetIndex(supabaseUserId)).itemsById : new Map<string, BuilderItem>();
    const closetItems = [...itemsById.values()];
    const temperatureC = input.weatherContext?.apparentTemperatureC ?? input.weatherContext?.temperatureC ?? null;

    const shortlistsByTier: Record<string, ClosetOutfitSlotShortlists> = {};
    const idSetsByTier: Record<string, TierRoleIdSets> = {};
    if (input.closetOnly) {
      for (const tier of tiersToGenerate) {
        const { includeThermalLayer, includeOuterwear } = weatherGates(temperatureC, tier);
        const { forPrompt, idSets } = buildTierRoleShortlists({
          closetItems,
          tier,
          includeThermalLayer,
          includeOuterwear,
          includeHat: !!input.includeHat,
          includeBag: !!input.includeBag,
        });
        shortlistsByTier[tier] = forPrompt;
        idSetsByTier[tier] = idSets;
      }
    }

    const [styleGuideContext, seasonalTrends] = await Promise.all([
      styleGuideService.retrieveGuidance({
        task: 'outfit-generation',
        query: buildOutfitGenerationStyleGuideQuery({
          profile,
          anchorItems,
          tiersToGenerate,
          manualSeason: input.manualSeason,
          weatherSeason: input.weatherContext?.season,
          vibeKeywords,
        }),
      }),
      loadSeasonalTrends(profile, input.hemisphere, supabaseUserId),
    ]);
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildGenerateOutfitsUserPrompt(
          {
            ...input,
            anchorItems,
            selectedTiers: tiersToGenerate,
            anchorItemDescription: getCanonicalAnchorDescription(input),
          },
          profile,
          styleGuideContext?.promptContext,
          seasonalTrends,
          input.closetOnly ? shortlistsByTier : undefined,
        ),
      },
    ];

    userContent.push(...await buildAnchorImageContent(uploadedAnchorImages, anchorItems));

    const instructions = buildGenerateOutfitsInstructions(tiersToGenerate, profile?.gender, input.closetOnly);
    const description = profile?.gender === 'woman' ? 'Three womenswear outfit tiers for one anchor item.' : 'Three menswear outfit tiers for one anchor item.';

    let recommendationMap: Map<string, TieredOutfitGeneration['recommendations'][number]>;

    if (input.closetOnly) {
      const unionRoleIds: ClosetOnlyRoleIds = { keyPieces: [], shoes: [], accessories: [] };
      for (const idSets of Object.values(idSetsByTier)) {
        unionRoleIds.keyPieces.push(...idSets.keyPieces);
        unionRoleIds.shoes.push(...idSets.shoes);
        unionRoleIds.accessories.push(...idSets.accessories);
      }

      const aiOutput = await openAiClient.createStructuredResponse({
        schema: closetOnlyTieredOutfitGenerationSchema,
        jsonSchema: { name: 'tiered_outfit_generation_closet_only', description, schema: buildClosetOnlyTieredOutfitGenerationJsonSchema(unionRoleIds, tiersToGenerate.length) },
        instructions,
        userContent,
        supabaseUserId,
        feature: 'outfit-generation',
      });

      recommendationMap = new Map(
        aiOutput.recommendations.map((recommendation) => [
          recommendation.tier,
          resolveClosetOnlyRecommendation(recommendation, idSetsByTier[recommendation.tier]!, itemsById, closetItems),
        ]),
      );
    } else {
      const aiOutput = await openAiClient.createStructuredResponse({
        schema: tieredOutfitGenerationSchema,
        jsonSchema: { name: 'tiered_outfit_generation', description, schema: buildTieredOutfitGenerationJsonSchema() },
        instructions,
        userContent,
        supabaseUserId,
        feature: 'outfit-generation',
      });
      recommendationMap = new Map(aiOutput.recommendations.map((recommendation) => [recommendation.tier, recommendation]));
    }

    const response: OutfitResponse = {
      requestId: input.requestId,
      status: 'completed' as const,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      input: {
        anchorItems,
        anchorItemDescription: getCanonicalAnchorDescription(input),
        vibeKeywords: input.vibeKeywords?.trim() || undefined,
        anchorImageId: input.anchorImageId ?? primaryUploadedAnchorImage?.id ?? null,
        anchorImageUrl: input.anchorImageUrl ?? primaryUploadedAnchorImage?.publicUrl ?? anchorItems[0]?.imageUrl ?? null,
        photoPending: input.photoPending,
        selectedTiers,
        weatherContext: input.weatherContext ?? null,
        manualSeason: input.manualSeason ?? null,
        hemisphere: input.hemisphere,
        region: input.region,
        includeBag: input.includeBag ?? false,
        includeHat: input.includeHat ?? false,
        closetOnly: input.closetOnly ?? false,
        additionalDetails: input.additionalDetails?.trim() || undefined,
        trendiness: input.trendiness,
      },
      recommendations: tiersToGenerate.map((tier) => {
        const recommendation = recommendationMap.get(tier);

        if (!recommendation) {
          throw new HttpError(502, 'OPENAI_MISSING_TIER', `The AI provider did not return the ${tier} recommendation.`);
        }

        return mapOutfitRecommendation(
          recommendation,
          tier,
          buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, input.requestId, tier, variantMap?.[tier] ?? 0),
          variantMap?.[tier] ?? 0,
          getCanonicalAnchorDescription(input),
        );
      }),
    };

    await outfitsRepository.upsertGeneratedOutfit(input.profileId, response, supabaseUserId);
    tierSketchService.queueSketchesForOutfit(response, profileToSubject(profile), supabaseUserId).catch((error) => {
      logger.error({ requestId: input.requestId, supabaseUserId, error }, 'Outfit sketch batch generation failed');
    });
    outfitsService.pruneOutfitHistory(supabaseUserId).catch((error) => {
      logger.error({ supabaseUserId, error }, 'Outfit history prune failed');
    });
    return response;
  },

  async regenerateTier(requestId: string, tier: OutfitTierSlug, supabaseUserId: string) {
    const existing = await outfitsRepository.findGeneratedOutfit(requestId);

    if (!existing) {
      throw new HttpError(404, 'OUTFIT_REQUEST_NOT_FOUND', 'No outfit request exists for the provided id.');
    }

    const currentRecommendation = existing.recommendations.find((item) => item.tier === tier);
    const currentVariantIndex = currentRecommendation?.variantIndex ?? 0;
    const nextVariantIndex = currentVariantIndex + 1;
    const profile = await findProfile(supabaseUserId);
    const anchorItems = getNormalizedAnchorItems(existing.input);
    const itemsById = existing.input.closetOnly ? (await buildClosetIndex(supabaseUserId)).itemsById : new Map<string, BuilderItem>();
    const closetItems = [...itemsById.values()];
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );

    let shortlists: ClosetOutfitSlotShortlists | undefined;
    let idSets: TierRoleIdSets | undefined;
    if (existing.input.closetOnly) {
      const temperatureC = existing.input.weatherContext?.apparentTemperatureC ?? existing.input.weatherContext?.temperatureC ?? null;
      const { includeThermalLayer, includeOuterwear } = weatherGates(temperatureC, tier);
      const built = buildTierRoleShortlists({
        closetItems,
        tier,
        includeThermalLayer,
        includeOuterwear,
        includeHat: !!existing.input.includeHat,
        includeBag: !!existing.input.includeBag,
      });
      shortlists = built.forPrompt;
      idSets = built.idSets;
    }

    const [styleGuideContext, seasonalTrends] = await Promise.all([
      styleGuideService.retrieveGuidance({
        task: 'tier-regeneration',
        query: buildOutfitRegenerationStyleGuideQuery({
          profile,
          tier,
          anchorItems,
          manualSeason: existing.input.manualSeason,
          weatherSeason: existing.input.weatherContext?.season,
          currentStylingDirection: currentRecommendation?.stylingDirection,
        }),
      }),
      loadSeasonalTrends(profile, existing.input.hemisphere, supabaseUserId),
    ]);
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildRegenerateTierUserPrompt({
          profile,
          existing,
          tier,
          styleGuideContext: styleGuideContext?.promptContext,
          seasonalTrends,
          shortlists,
        }),
      },
    ];

    userContent.push(...await buildAnchorImageContent(uploadedAnchorImages, anchorItems));

    const description = profile?.gender === 'woman' ? 'A single regenerated womenswear tier recommendation.' : 'A single regenerated menswear tier recommendation.';
    const instructions = buildRegenerateTierInstructions(profile?.gender, existing.input.closetOnly);

    let regeneratedRecommendation: TieredOutfitGeneration['recommendations'][number];

    if (existing.input.closetOnly && idSets) {
      const aiOutput = await openAiClient.createStructuredResponse({
        schema: closetOnlySingleTierRegenerationSchema,
        jsonSchema: { name: 'single_tier_regeneration_closet_only', description, schema: buildClosetOnlySingleTierRegenerationJsonSchema({ keyPieces: [...idSets.keyPieces], shoes: [...idSets.shoes], accessories: [...idSets.accessories] }) },
        instructions,
        userContent,
        supabaseUserId,
        feature: 'tier-regeneration',
      });
      regeneratedRecommendation = resolveClosetOnlyRecommendation(aiOutput.recommendation, idSets, itemsById, closetItems);
    } else {
      const aiOutput = await openAiClient.createStructuredResponse({
        schema: singleTierRegenerationSchema,
        jsonSchema: { name: 'single_tier_regeneration', description, schema: buildSingleTierRegenerationJsonSchema() },
        instructions,
        userContent,
        supabaseUserId,
        feature: 'tier-regeneration',
      });
      regeneratedRecommendation = aiOutput.recommendation;
    }

    const mergedResponse: OutfitResponse = {
      ...existing,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      recommendations: existing.recommendations.map((recommendation) =>
        recommendation.tier === tier
          ? mapOutfitRecommendation(
              regeneratedRecommendation,
              tier,
              buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, existing.requestId, tier, nextVariantIndex),
              nextVariantIndex,
              existing.input.anchorItemDescription,
            )
          : recommendation
      ),
    };

    await outfitsRepository.upsertGeneratedOutfit(undefined, mergedResponse);
    tierSketchService.queueSketchForTier(mergedResponse, tier, profileToSubject(profile), supabaseUserId).catch((error) => {
      logger.error({ requestId: existing.requestId, tier, error }, 'Tier sketch regeneration failed');
    });
    return mergedResponse;
  },

  /**
   * Deletes this user's outfit history beyond the most recent HISTORY_RETENTION_LIMIT,
   * skipping anything currently favourited or assigned to a week day. Safe to call
   * repeatedly/concurrently — a delete of an already-deleted id is a no-op.
   *
   * findProtectedRequestIds queries Supabase-managed tables (saved_outfits/week_plan)
   * that turned out NOT to be reachable from this Postgres connection ("relation
   * does not exist") — that error was thrown from an un-awaited, uncaught fire-and-forget
   * call, which crashed the whole Node process (Render: "exited with status 1") on every
   * History-tab open. If we can't positively verify what's protected, do NOT delete
   * anything this round — better to skip a cleanup pass than risk deleting something
   * that's actually favourited/planned.
   */
  async pruneOutfitHistory(supabaseUserId: string, keep: number = HISTORY_RETENTION_LIMIT) {
    const beyondLimit = await outfitsRepository.findHistoryRequestIdsBeyondLimit(supabaseUserId, keep);
    if (beyondLimit.length === 0) return 0;

    let protectedIds: Set<string>;
    try {
      protectedIds = await outfitsRepository.findProtectedRequestIds(beyondLimit);
    } catch (error) {
      logger.error({ supabaseUserId, error }, 'Could not verify saved/planned outfits — skipping history prune this round');
      return 0;
    }

    const toDelete = beyondLimit.filter((id) => !protectedIds.has(id));
    if (toDelete.length === 0) return 0;

    return outfitsRepository.deleteOutfitsByRequestIds(toDelete);
  },

  async getOutfitHistory(supabaseUserId: string, { page, limit }: { page: number; limit: number }) {
    // Page 1 doubles as the cleanup trigger — items beyond HISTORY_RETENTION_LIMIT
    // are never on page 1 (limit is always far below the retention count), so this
    // can't race with or affect what's actually returned below. .catch() is load-bearing:
    // an unawaited rejection here is an unhandled rejection, which crashes the process.
    if (page === 1) {
      outfitsService.pruneOutfitHistory(supabaseUserId).catch((error) => {
        logger.error({ supabaseUserId, error }, 'Outfit history prune failed');
      });
    }

    const { items, total } = await outfitsRepository.findOutfitHistory(supabaseUserId, { page, limit });
    return {
      items: items.map((outfit) => ({
        ...outfit,
        recommendations: outfit.recommendations.map((rec) => ({
          ...rec,
          sketchImageUrl:
            rec.sketchStatus === 'ready'
              ? buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, outfit.requestId, rec.tier, `${outfit.generatedAt}-${rec.variantIndex}`)
              : null,
        })),
      })),
      total,
      page,
      hasMore: page * limit < total,
    };
  },

  async deleteOutfit(requestId: string, supabaseUserId: string) {
    let protectedIds: Set<string>;
    try {
      protectedIds = await outfitsRepository.findProtectedRequestIds([requestId]);
    } catch (error) {
      logger.error({ requestId, error }, 'Could not verify saved/planned outfits — refusing delete to be safe');
      throw new HttpError(503, 'PROTECTION_CHECK_FAILED', 'Could not verify this look is safe to delete. Please try again.');
    }
    if (protectedIds.has(requestId)) {
      throw new HttpError(409, 'OUTFIT_SAVED', 'This look is saved to Favourites or your Week planner — remove it there first.');
    }

    const deleted = await outfitsRepository.deleteOutfit(requestId, supabaseUserId);
    if (!deleted) {
      throw new HttpError(404, 'OUTFIT_NOT_FOUND', 'No outfit exists for the provided id or you do not have permission to delete it.');
    }
  },
};
