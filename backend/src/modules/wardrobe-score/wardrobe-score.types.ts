// ── Shared closet item shape used by all scoring services ─────────────────────

export type ScoringClosetItem = {
  id: string;
  title: string;
  category: string;
  subcategory?: string | null;
  brand?: string | null;
  primaryColor?: string | null;
  colorFamily?: string | null;
  material?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  pattern?: string | null;
  weight?: string | null;
};

// ── Essentials Coverage ───────────────────────────────────────────────────────

export type EssentialMatchResult = {
  essentialId: string;
  label: string;
  tier: 1 | 2 | 3;
  matchType: 'exact' | 'strong' | 'partial' | 'none';
  matchedItemId?: string;
  matchedItemTitle?: string;
};

export type EssentialsCoverageScore = {
  score: number;                     // 0–100
  tier1Coverage: number;             // 0–100 within tier
  tier2Coverage: number;
  tier3Coverage: number;
  tier1MatchRate: number;            // 0–1 fraction matched
  tier2MatchRate: number;
  tier3MatchRate: number;
  matchedCount: number;
  totalEssentials: number;
  matches: EssentialMatchResult[];
  missingTier1: string[];            // labels of unmatched tier-1 essentials
  missingTier2: string[];
  missingTier3: string[];
  gapCallouts: string[];             // human-readable gap descriptions
  strengthHighlights: string[];
};

// ── Versatility and Functionality ─────────────────────────────────────────────

export type OccasionSpreadScore = {
  score: number;
  casualCount: number;
  smartCasualCount: number;
  businessCount: number;
  formalCount: number;
  missingOccasions: string[];
  weakOccasions: string[];
};

export type ColorDistributionScore = {
  score: number;
  uniqueColorFamilies: number;
  neutralCount: number;
  accentCount: number;
  gapCallout?: string;
};

export type CategoryGapsScore = {
  score: number;
  presentCategories: string[];
  missingCategories: string[];
  gapCallouts: string[];
};

export type MixAndMatchScore = {
  score: number;
  estimatedCombinations: number;
  topCount: number;
  bottomCount: number;
  shoeCount: number;
  gapCallout?: string;
};

export type VersatilityFunctionalityScore = {
  score: number;                     // 0–100 composite
  occasionSpread: OccasionSpreadScore;
  colorDistribution: ColorDistributionScore;
  categoryGaps: CategoryGapsScore;
  mixAndMatch: MixAndMatchScore;
  gapCallouts: string[];
  strengthHighlights: string[];
};

// ── Trend Relevance ───────────────────────────────────────────────────────────

export type TrendItemAnnotation = {
  itemId: string;
  itemTitle: string;
  label: 'on-trend' | 'neutral' | 'dated';
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
};

export type TrendRelevanceScore = {
  score: number | null;              // null when no style guides available
  hasFallback: boolean;
  fallbackReason?: string;
  annotations: TrendItemAnnotation[];
  onTrendCount: number;
  neutralCount: number;
  datedCount: number;
  styleGuidesSummary?: string;
  gapCallouts: string[];
  strengthHighlights: string[];
};

// ── Composite Score ───────────────────────────────────────────────────────────

export type DimensionContribution = {
  rawScore: number;
  weight: number;
  weightedContribution: number;
};

export type WardrobeScore = {
  compositeScore: number;            // 0–100
  scoreBand: string;                 // "Exceptional" | "Strong" | "Solid" | "Developing" | "Needs Work"
  scoreBandDescription: string;
  dimensions: {
    essentialsCoverage: EssentialsCoverageScore;
    versatilityFunctionality: VersatilityFunctionalityScore;
    trendRelevance: TrendRelevanceScore;
  };
  contributions: {
    essentialsCoverage: DimensionContribution;
    versatilityFunctionality: DimensionContribution;
    trendRelevance: DimensionContribution;
  };
  gapCallouts: string[];             // aggregated and deduplicated across all dimensions
  strengthHighlights: string[];      // aggregated strengths
  trendAnnotations: TrendItemAnnotation[];
  summary: string;                   // human-readable one-paragraph summary
  metadata: {
    scoringVersion: string;
    generatedAt: string;             // ISO timestamp
    closetItemCount: number;
    styleGuidesUsed: boolean;
    fallbackFlags: {
      trendRelevance: boolean;
    };
  };
};
