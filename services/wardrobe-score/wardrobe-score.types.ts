// Mirror of backend wardrobe-score.types.ts — kept in sync manually.

export type TrendItemAnnotation = {
  itemId: string;
  itemTitle: string;
  label: 'on-trend' | 'neutral' | 'dated';
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
};

export type EssentialMatchResult = {
  essentialId: string;
  label: string;
  tier: 1 | 2 | 3;
  matchType: 'exact' | 'strong' | 'partial' | 'none';
  matchedItemId?: string;
  matchedItemTitle?: string;
};

export type EssentialsCoverageScore = {
  score: number;
  tier1Coverage: number;
  tier2Coverage: number;
  tier3Coverage: number;
  tier1MatchRate: number;
  tier2MatchRate: number;
  tier3MatchRate: number;
  matchedCount: number;
  totalEssentials: number;
  matches: EssentialMatchResult[];
  missingTier1: string[];
  missingTier2: string[];
  missingTier3: string[];
  gapCallouts: string[];
  strengthHighlights: string[];
};

export type OccasionSpreadScore = {
  score: number;
  casualCount: number;
  smartCasualCount: number;
  businessCount: number;
  formalCount: number;
  missingOccasions: string[];
  weakOccasions: string[];
};

export type VersatilityFunctionalityScore = {
  score: number;
  occasionSpread: OccasionSpreadScore;
  colorDistribution: { score: number; uniqueColorFamilies: number; neutralCount: number; accentCount: number; gapCallout?: string };
  categoryGaps: { score: number; presentCategories: string[]; missingCategories: string[]; gapCallouts: string[] };
  mixAndMatch: { score: number; estimatedCombinations: number; topCount: number; bottomCount: number; shoeCount: number; gapCallout?: string };
  gapCallouts: string[];
  strengthHighlights: string[];
};

export type TrendRelevanceScore = {
  score: number | null;
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

export type DimensionContribution = {
  rawScore: number;
  weight: number;
  weightedContribution: number;
};

export type WardrobeScore = {
  compositeScore: number;
  scoreBand: string;
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
  gapCallouts: string[];
  strengthHighlights: string[];
  trendAnnotations: TrendItemAnnotation[];
  summary: string;
  metadata: {
    scoringVersion: string;
    generatedAt: string;
    closetItemCount: number;
    styleGuidesUsed: boolean;
    fallbackFlags: {
      trendRelevance: boolean;
    };
  };
};
