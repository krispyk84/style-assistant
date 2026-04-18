import type { EssentialItem, ScoringConfig } from './scoring-config.js';
import type { ScoringClosetItem, EssentialMatchResult, EssentialsCoverageScore } from './wardrobe-score.types.js';

// ── Matching logic ────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison: lowercase, remove extra spaces.
 */
function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

/**
 * Check whether two strings overlap (one contains the other after normalization).
 */
function overlaps(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na.includes(nb) || nb.includes(na);
}

/**
 * Category match: essential's categories list vs item's category field.
 * Returns true if any essential category overlaps with the item category.
 */
function categoryMatches(item: ScoringClosetItem, essential: EssentialItem): boolean {
  const itemCat = norm(item.category);
  return essential.categories.some((ec) => {
    const nec = norm(ec);
    return itemCat.includes(nec) || nec.includes(itemCat);
  });
}

/**
 * Subcategory match: essential's subcategory list vs item's subcategory field.
 * Returns true if the essential has NO subcategory constraint, or if there IS a match.
 */
function subcategoryMatches(item: ScoringClosetItem, essential: EssentialItem): boolean {
  if (!essential.subcategories.length) return true;
  const itemSub = norm(item.subcategory);
  if (!itemSub) return false;
  return essential.subcategories.some((es) => {
    const nes = norm(es);
    return itemSub.includes(nes) || nes.includes(itemSub);
  });
}

/**
 * Color family match: essential's colorFamilies vs item's colorFamily.
 * Returns true if the essential has NO color constraint, or if there IS a match.
 */
function colorFamilyMatches(item: ScoringClosetItem, essential: EssentialItem): boolean {
  if (!essential.colorFamilies.length) return true;
  const itemColor = norm(item.colorFamily);
  const itemPrimary = norm(item.primaryColor);
  return essential.colorFamilies.some((cf) => {
    const ncf = norm(cf);
    return itemColor.includes(ncf) || ncf.includes(itemColor) ||
           itemPrimary.includes(ncf) || ncf.includes(itemPrimary);
  });
}

/**
 * Formality match: essential's formality list vs item's formality field.
 * Returns true if the essential has NO formality constraint, or if there IS a match.
 */
function formalityMatches(item: ScoringClosetItem, essential: EssentialItem): boolean {
  if (!essential.formality?.length) return true;
  const itemFormality = norm(item.formality);
  if (!itemFormality) return false;
  return essential.formality.some((f) => overlaps(itemFormality, f));
}

/**
 * Keyword match: check if the item's title contains any essential keyword.
 * Used as a secondary fallback for partial matching.
 */
function keywordMatches(item: ScoringClosetItem, essential: EssentialItem): boolean {
  if (!essential.keywords.length) return false;
  const titleLower = norm(item.title);
  return essential.keywords.some((kw) => titleLower.includes(norm(kw)));
}

/**
 * Determine match type and matched item for a single essential against the full closet.
 *
 * Match tiers:
 *   exact   — category + subcategory + color + formality all match
 *   strong  — category + color match (subcategory may be absent/mismatched, no hard constraint broken)
 *   partial — category matches, some keyword overlap; subcategory/color mismatch tolerated
 *   none    — no match found
 */
function matchEssential(
  essential: EssentialItem,
  items: ScoringClosetItem[],
): { matchType: EssentialMatchResult['matchType']; matchedItem?: ScoringClosetItem } {
  let strongMatch: ScoringClosetItem | undefined;
  let partialMatch: ScoringClosetItem | undefined;

  for (const item of items) {
    const catOk = categoryMatches(item, essential);
    if (!catOk) continue;

    const subOk = subcategoryMatches(item, essential);
    const colorOk = colorFamilyMatches(item, essential);
    const formalityOk = formalityMatches(item, essential);

    if (subOk && colorOk && formalityOk) {
      // Perfect match — treat as exact
      return { matchType: 'exact', matchedItem: item };
    }

    if (colorOk && formalityOk) {
      // Category + color + formality match (subcategory missing or wrong) → strong
      strongMatch ??= item;
    } else if (colorOk || keywordMatches(item, essential)) {
      // Category + keyword/color partial → partial
      partialMatch ??= item;
    }
  }

  if (strongMatch) return { matchType: 'strong', matchedItem: strongMatch };
  if (partialMatch) return { matchType: 'partial', matchedItem: partialMatch };
  return { matchType: 'none' };
}

// ── Coverage computation ──────────────────────────────────────────────────────

/**
 * Score a tier's matches into a 0–100 coverage number.
 * exact → 1.0 weight, strong → 0.75, partial → 0.4, none → 0.
 * Capped at 100.
 */
function scoreTierCoverage(matches: EssentialMatchResult[]): number {
  if (!matches.length) return 0;
  const weights = { exact: 1.0, strong: 0.75, partial: 0.4, none: 0 };
  const total = matches.reduce((sum, m) => sum + weights[m.matchType], 0);
  return Math.min(100, Math.round((total / matches.length) * 100));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function scoreEssentialsCoverage(
  items: ScoringClosetItem[],
  config: ScoringConfig,
): EssentialsCoverageScore {
  const { essentialsMasterList, essentialsTierWeights } = config;

  // Run matching per tier
  const tier1Matches: EssentialMatchResult[] = essentialsMasterList.tier1.map((e) => {
    const { matchType, matchedItem } = matchEssential(e, items);
    return { essentialId: e.id, label: e.label, tier: 1, matchType, matchedItemId: matchedItem?.id, matchedItemTitle: matchedItem?.title };
  });

  const tier2Matches: EssentialMatchResult[] = essentialsMasterList.tier2.map((e) => {
    const { matchType, matchedItem } = matchEssential(e, items);
    return { essentialId: e.id, label: e.label, tier: 2, matchType, matchedItemId: matchedItem?.id, matchedItemTitle: matchedItem?.title };
  });

  const tier3Matches: EssentialMatchResult[] = essentialsMasterList.tier3.map((e) => {
    const { matchType, matchedItem } = matchEssential(e, items);
    return { essentialId: e.id, label: e.label, tier: 3, matchType, matchedItemId: matchedItem?.id, matchedItemTitle: matchedItem?.title };
  });

  // Coverage per tier (0–100)
  const tier1Coverage = scoreTierCoverage(tier1Matches);
  const tier2Coverage = scoreTierCoverage(tier2Matches);
  const tier3Coverage = scoreTierCoverage(tier3Matches);

  // Match rate fractions
  const matchedFraction = (matches: EssentialMatchResult[]) =>
    matches.length === 0 ? 0 : matches.filter((m) => m.matchType !== 'none').length / matches.length;

  const tier1MatchRate = matchedFraction(tier1Matches);
  const tier2MatchRate = matchedFraction(tier2Matches);
  const tier3MatchRate = matchedFraction(tier3Matches);

  // Composite score — weighted average of tier coverages
  const { tier1: w1, tier2: w2, tier3: w3 } = essentialsTierWeights;
  const totalWeight = w1 + w2 + w3;
  const rawScore = (tier1Coverage * w1 + tier2Coverage * w2 + tier3Coverage * w3) / totalWeight;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Missing essentials per tier (none matches only)
  const missingTier1 = tier1Matches.filter((m) => m.matchType === 'none').map((m) => m.label);
  const missingTier2 = tier2Matches.filter((m) => m.matchType === 'none').map((m) => m.label);
  const missingTier3 = tier3Matches.filter((m) => m.matchType === 'none').map((m) => m.label);

  const matchedCount = [...tier1Matches, ...tier2Matches, ...tier3Matches]
    .filter((m) => m.matchType !== 'none').length;
  const totalEssentials = tier1Matches.length + tier2Matches.length + tier3Matches.length;

  // Gap callouts — prioritize tier-1 gaps
  const gapCallouts: string[] = [];
  missingTier1.forEach((label) => gapCallouts.push(`Missing a ${label.toLowerCase()}`));
  if (missingTier2.length > 0 && missingTier2.length <= 3) {
    missingTier2.forEach((label) => gapCallouts.push(`Consider adding ${label.toLowerCase()}`));
  } else if (missingTier2.length > 3) {
    gapCallouts.push(`Several supporting pieces missing: ${missingTier2.slice(0, 3).join(', ')}…`);
  }

  // Strength highlights
  const strengthHighlights: string[] = [];
  if (tier1MatchRate >= 0.9) strengthHighlights.push('Excellent coverage of core wardrobe essentials');
  else if (tier1MatchRate >= 0.7) strengthHighlights.push('Strong foundation of essential pieces');
  if (tier2MatchRate >= 0.75) strengthHighlights.push('Good range of supporting wardrobe pieces');
  if (tier3Coverage >= 60) strengthHighlights.push('Well-rounded with optional specialty items');
  if (score >= 80 && missingTier1.length === 0) strengthHighlights.push('All tier-1 essentials accounted for');

  return {
    score,
    tier1Coverage,
    tier2Coverage,
    tier3Coverage,
    tier1MatchRate,
    tier2MatchRate,
    tier3MatchRate,
    matchedCount,
    totalEssentials,
    matches: [...tier1Matches, ...tier2Matches, ...tier3Matches],
    missingTier1,
    missingTier2,
    missingTier3,
    gapCallouts,
    strengthHighlights,
  };
}
