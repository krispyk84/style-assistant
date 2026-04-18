import type { ScoringConfig } from './scoring-config.js';
import type {
  ScoringClosetItem,
  OccasionSpreadScore,
  ColorDistributionScore,
  CategoryGapsScore,
  MixAndMatchScore,
  VersatilityFunctionalityScore,
} from './wardrobe-score.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

// ── Formality mapping ─────────────────────────────────────────────────────────

const CASUAL_TERMS = ['casual', 'streetwear', 'leisurewear', 'relaxed', 'everyday'];
const SMART_CASUAL_TERMS = ['smart-casual', 'smart casual', 'smart_casual', 'semi-casual', 'weekend'];
const BUSINESS_TERMS = ['business', 'business casual', 'work', 'office', 'professional', 'smart'];
const FORMAL_TERMS = ['formal', 'black tie', 'black-tie', 'evening', 'business-formal', 'cocktail', 'gala'];

function classifyFormality(item: ScoringClosetItem): 'casual' | 'smart-casual' | 'business' | 'formal' | null {
  const f = norm(item.formality);
  if (!f) return null;
  if (FORMAL_TERMS.some((t) => f.includes(t))) return 'formal';
  if (BUSINESS_TERMS.some((t) => f.includes(t))) return 'business';
  if (SMART_CASUAL_TERMS.some((t) => f.includes(t))) return 'smart-casual';
  if (CASUAL_TERMS.some((t) => f.includes(t))) return 'casual';
  return null;
}

// ── 1. Occasion Spread ────────────────────────────────────────────────────────

/**
 * Score occasion spread (0–100).
 * Rewards balanced coverage across casual, smart-casual, business, formal.
 * Penalizes missing occasion types, especially business and formal.
 */
export function scoreOccasionSpread(items: ScoringClosetItem[]): OccasionSpreadScore {
  const counts = { casual: 0, 'smart-casual': 0, business: 0, formal: 0 };
  const unclassified: ScoringClosetItem[] = [];

  for (const item of items) {
    const occ = classifyFormality(item);
    if (occ) counts[occ]++;
    else unclassified.push(item);
  }

  // Infer formality from category/subcategory for unclassified items
  for (const item of unclassified) {
    const cat = norm(item.category);
    const sub = norm(item.subcategory);
    const haystack = `${cat} ${sub}`;

    if (haystack.match(/suit|tuxedo|blazer|dress trouser|dress shirt/)) counts['business']++;
    else if (haystack.match(/smart|chino|polo|loafer|oxford|derby/)) counts['smart-casual']++;
    else if (haystack.match(/jeans|t-shirt|tee|sneaker|hoodie|sweatshirt/)) counts['casual']++;
    else if (haystack.match(/tuxedo|evening|gala|dinner suit/)) counts['formal']++;
  }

  const { casual, 'smart-casual': smartCasual, business, formal } = counts;

  // Score per occasion: 0 = absent (0 pts), 1-2 = weak (3 pts), 3-5 = adequate (7 pts), 6+ = strong (10 pts)
  function scoreOccasionCount(n: number): number {
    if (n === 0) return 0;
    if (n <= 2) return 3;
    if (n <= 5) return 7;
    return 10;
  }

  const casualScore = scoreOccasionCount(casual);
  const smartCasualScore = scoreOccasionCount(smartCasual);
  const businessScore = scoreOccasionCount(business);
  const formalScore = scoreOccasionCount(formal);

  // Maximum is 40 points (10 per occasion), scale to 100
  const rawScore = casualScore + smartCasualScore + businessScore + formalScore;

  // Apply penalty if critical occasions are completely absent
  let penalty = 0;
  if (business === 0) penalty += 15; // Business coverage is important
  if (casual === 0) penalty += 10;

  const score = Math.max(0, Math.min(100, Math.round((rawScore / 40) * 100) - penalty));

  const missingOccasions: string[] = [];
  const weakOccasions: string[] = [];

  if (casual === 0) missingOccasions.push('Casual');
  else if (casual <= 2) weakOccasions.push('Casual');

  if (smartCasual === 0) missingOccasions.push('Smart casual');
  else if (smartCasual <= 2) weakOccasions.push('Smart casual');

  if (business === 0) missingOccasions.push('Business / office');
  else if (business <= 2) weakOccasions.push('Business / office');

  if (formal === 0) missingOccasions.push('Formal / evening');
  // formal being absent is less penalizing — don't add to weak if just low

  return {
    score,
    casualCount: casual,
    smartCasualCount: smartCasual,
    businessCount: business,
    formalCount: formal,
    missingOccasions,
    weakOccasions,
  };
}

// ── 2. Color Distribution ─────────────────────────────────────────────────────

const NEUTRAL_FAMILIES = new Set(['white', 'grey', 'gray', 'navy', 'black', 'stone', 'brown', 'camel', 'beige', 'cream', 'charcoal', 'olive']);
const ACCENT_FAMILIES = new Set(['red', 'burgundy', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple', 'rust', 'teal', 'cobalt', 'mustard']);

/**
 * Score color distribution (0–100).
 * Rewards a versatile base palette (2-5 neutral families + some accent range).
 * Penalizes extremely narrow palette or random chromatic chaos.
 */
export function scoreColorDistribution(items: ScoringClosetItem[]): ColorDistributionScore {
  const colorFamiliesUsed = new Set<string>();
  let neutralCount = 0;
  let accentCount = 0;

  for (const item of items) {
    const cf = norm(item.colorFamily);
    if (!cf) continue;
    colorFamiliesUsed.add(cf);
    if (NEUTRAL_FAMILIES.has(cf)) neutralCount++;
    else if (ACCENT_FAMILIES.has(cf)) accentCount++;
  }

  const uniqueColorFamilies = colorFamiliesUsed.size;
  const total = neutralCount + accentCount;

  if (total === 0) {
    return {
      score: 30, // Can't assess — give base score
      uniqueColorFamilies: 0,
      neutralCount: 0,
      accentCount: 0,
      gapCallout: 'Add color family metadata to items for accurate color scoring',
    };
  }

  // Ideal palette: 3-6 color families, 65-80% neutral, some accent range
  let score = 50; // baseline

  // Reward diversity (up to +30)
  if (uniqueColorFamilies >= 3) score += 10;
  if (uniqueColorFamilies >= 5) score += 10;
  if (uniqueColorFamilies >= 7) score += 10;

  // Reward balanced neutral/accent ratio (up to +20)
  const neutralRatio = total > 0 ? neutralCount / total : 0;
  if (neutralRatio >= 0.55 && neutralRatio <= 0.85) score += 20;
  else if (neutralRatio >= 0.45 && neutralRatio <= 0.90) score += 10;

  // Penalize very narrow palette
  if (uniqueColorFamilies <= 1) score -= 25;
  else if (uniqueColorFamilies <= 2) score -= 10;

  // Penalize no neutrals at all
  if (neutralCount === 0) score -= 20;

  // Cap at 100
  score = Math.max(0, Math.min(100, score));

  let gapCallout: string | undefined;
  if (uniqueColorFamilies <= 2) {
    gapCallout = 'Very narrow color palette — adding neutral variety would increase outfit options';
  } else if (neutralRatio < 0.4 && total > 5) {
    gapCallout = 'Heavy on accent colors; a stronger neutral base (navy, white, grey) would improve mix-ability';
  } else if (neutralRatio > 0.95 && total > 5) {
    gapCallout = 'Very monochromatic — a few accent pieces would add visual interest';
  }

  return {
    score,
    uniqueColorFamilies,
    neutralCount,
    accentCount,
    gapCallout,
  };
}

// ── 3. Category Gaps ──────────────────────────────────────────────────────────

// Essential categories for a functional wardrobe
const ESSENTIAL_CATEGORIES = [
  { label: 'Footwear',   keywords: ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'loafer', 'oxford', 'derby', 'sandal', 'trainer', 'footwear'] },
  { label: 'Outerwear',  keywords: ['coat', 'jacket', 'outerwear', 'parka', 'trench', 'blazer', 'overcoat', 'anorak', 'puffer'] },
  { label: 'Tops',       keywords: ['shirt', 't-shirt', 'tee', 'polo', 'sweater', 'knitwear', 'jumper', 'blouse', 'sweatshirt', 'hoodie', 'pullover'] },
  { label: 'Bottoms',    keywords: ['trouser', 'trousers', 'jeans', 'denim', 'chino', 'chinos', 'shorts', 'pant', 'pants'] },
  { label: 'Knitwear',   keywords: ['sweater', 'knitwear', 'jumper', 'cardigan', 'pullover', 'rollneck', 'turtleneck'] },
];

function hasCategory(items: ScoringClosetItem[], keywords: string[]): boolean {
  return items.some((item) => {
    const haystack = `${norm(item.category)} ${norm(item.subcategory)} ${norm(item.title)}`;
    return keywords.some((kw) => haystack.includes(kw));
  });
}

/**
 * Score category gaps (0–100).
 * Penalizes missing essential wardrobe categories.
 */
export function scoreCategoryGaps(items: ScoringClosetItem[]): CategoryGapsScore {
  const presentCategories: string[] = [];
  const missingCategories: string[] = [];

  for (const cat of ESSENTIAL_CATEGORIES) {
    if (hasCategory(items, cat.keywords)) {
      presentCategories.push(cat.label);
    } else {
      missingCategories.push(cat.label);
    }
  }

  // Score: each present category contributes equally
  const score = Math.round((presentCategories.length / ESSENTIAL_CATEGORIES.length) * 100);

  // Gap callouts — footwear and outerwear missing are highest severity
  const gapCallouts: string[] = [];
  if (missingCategories.includes('Footwear')) {
    gapCallouts.push('No footwear detected — add your shoes to the closet');
  }
  if (missingCategories.includes('Outerwear')) {
    gapCallouts.push('No outerwear detected — a coat or jacket would add significant versatility');
  }
  if (missingCategories.includes('Tops')) {
    gapCallouts.push('Tops category appears empty');
  }
  if (missingCategories.includes('Bottoms')) {
    gapCallouts.push('Bottoms category appears empty');
  }
  if (missingCategories.includes('Knitwear')) {
    gapCallouts.push('No knitwear — a quality sweater adds layering versatility');
  }

  return {
    score,
    presentCategories,
    missingCategories,
    gapCallouts,
  };
}

// ── 4. Mix and Match Potential ────────────────────────────────────────────────

const TOP_KEYWORDS = ['shirt', 't-shirt', 'tee', 'polo', 'sweater', 'knitwear', 'jumper', 'sweatshirt', 'hoodie', 'pullover', 'blouse'];
const BOTTOM_KEYWORDS = ['trouser', 'trousers', 'jeans', 'denim', 'chino', 'chinos', 'shorts', 'skirt', 'pant', 'pants'];
const SHOE_KEYWORDS = ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'loafer', 'oxford', 'derby', 'trainer', 'sandal'];
const OUTERWEAR_KEYWORDS = ['blazer', 'jacket', 'coat', 'outerwear', 'overshirt', 'cardigan'];

function countCategory(items: ScoringClosetItem[], keywords: string[]): number {
  return items.filter((item) => {
    const haystack = `${norm(item.category)} ${norm(item.subcategory)} ${norm(item.title)}`;
    return keywords.some((kw) => haystack.includes(kw));
  }).length;
}

/**
 * Estimate outfit combinations and score mix-and-match potential (0–100).
 *
 * Simplified model: outfits = tops × bottoms, limited by minimum of tops/bottoms.
 * Multiplied by a layering factor if outerwear exists.
 * Then capped with diminishing returns.
 */
export function scoreMixAndMatch(items: ScoringClosetItem[]): MixAndMatchScore {
  const topCount = countCategory(items, TOP_KEYWORDS);
  const bottomCount = countCategory(items, BOTTOM_KEYWORDS);
  const shoeCount = countCategory(items, SHOE_KEYWORDS);
  const outerwearCount = countCategory(items, OUTERWEAR_KEYWORDS);

  // Base combinations: tops × bottoms (limited to 50 to prevent wild inflation)
  const baseCombinations = Math.min(topCount * bottomCount, 50);

  // Layering multiplier: each outerwear piece effectively extends combinations
  const layeringBonus = outerwearCount > 0 ? Math.min(outerwearCount, 4) * 0.15 : 0;
  const estimatedCombinations = Math.round(baseCombinations * (1 + layeringBonus));

  // Score: diminishing returns after ~15 combinations
  let score: number;
  if (topCount === 0 || bottomCount === 0) {
    score = 0;
  } else if (estimatedCombinations <= 2) {
    score = 15;
  } else if (estimatedCombinations <= 6) {
    score = 35;
  } else if (estimatedCombinations <= 12) {
    score = 55;
  } else if (estimatedCombinations <= 20) {
    score = 75;
  } else if (estimatedCombinations <= 30) {
    score = 88;
  } else {
    score = 100;
  }

  // Penalty if no footwear
  if (shoeCount === 0) score = Math.max(0, score - 15);

  let gapCallout: string | undefined;
  if (topCount === 0) {
    gapCallout = 'No tops detected — add shirts and sweaters to enable outfit pairing';
  } else if (bottomCount === 0) {
    gapCallout = 'No bottoms detected — add trousers or jeans to enable outfit combinations';
  } else if (topCount === 1 || bottomCount === 1) {
    gapCallout = 'Very limited outfit combinations — adding more tops or bottoms would multiply options significantly';
  } else if (estimatedCombinations < 6) {
    gapCallout = 'Few outfit combinations available — building out tops and bottoms will increase versatility';
  }

  return {
    score,
    estimatedCombinations,
    topCount,
    bottomCount,
    shoeCount,
    gapCallout,
  };
}

// ── Composite versatility score ───────────────────────────────────────────────

export function scoreVersatilityFunctionality(
  items: ScoringClosetItem[],
  config: ScoringConfig,
): VersatilityFunctionalityScore {
  if (items.length === 0) {
    return {
      score: 0,
      occasionSpread: { score: 0, casualCount: 0, smartCasualCount: 0, businessCount: 0, formalCount: 0, missingOccasions: ['Casual', 'Smart casual', 'Business / office', 'Formal / evening'], weakOccasions: [] },
      colorDistribution: { score: 0, uniqueColorFamilies: 0, neutralCount: 0, accentCount: 0, gapCallout: 'Closet is empty' },
      categoryGaps: { score: 0, presentCategories: [], missingCategories: ESSENTIAL_CATEGORIES.map((c) => c.label), gapCallouts: ['Closet is empty'] },
      mixAndMatch: { score: 0, estimatedCombinations: 0, topCount: 0, bottomCount: 0, shoeCount: 0, gapCallout: 'Closet is empty' },
      gapCallouts: ['Closet is empty'],
      strengthHighlights: [],
    };
  }

  const { versatilityWeights: w } = config;
  const occasion = scoreOccasionSpread(items);
  const color = scoreColorDistribution(items);
  const categories = scoreCategoryGaps(items);
  const mixMatch = scoreMixAndMatch(items);

  const composite =
    occasion.score * w.occasionSpread +
    color.score * w.colorDistribution +
    categories.score * w.categoryGaps +
    mixMatch.score * w.mixAndMatchPotential;

  const score = Math.min(100, Math.max(0, Math.round(composite)));

  // Aggregate gap callouts
  const gapCallouts: string[] = [
    ...occasion.missingOccasions.map((o) => `Weak coverage for ${o.toLowerCase()} occasions`),
    ...occasion.weakOccasions.map((o) => `Limited pieces for ${o.toLowerCase()} occasions`),
    ...(color.gapCallout ? [color.gapCallout] : []),
    ...categories.gapCallouts,
    ...(mixMatch.gapCallout ? [mixMatch.gapCallout] : []),
  ].filter(Boolean);

  // Strength highlights
  const strengthHighlights: string[] = [];
  if (occasion.score >= 75) strengthHighlights.push('Strong occasion coverage across all formality levels');
  else if (occasion.score >= 55) strengthHighlights.push('Good casual-to-smart range');

  if (color.score >= 75) strengthHighlights.push('Well-balanced, versatile color palette');
  if (categories.score >= 80) strengthHighlights.push('All essential wardrobe categories represented');
  if (mixMatch.score >= 75) strengthHighlights.push(`High outfit potential — ~${mixMatch.estimatedCombinations} viable combinations`);

  return {
    score,
    occasionSpread: occasion,
    colorDistribution: color,
    categoryGaps: categories,
    mixAndMatch: mixMatch,
    gapCallouts,
    strengthHighlights,
  };
}
