export type AnalysisVerdict = 'Works great' | 'Works okay' | "Doesn't work";

export type AnalysisRequest = {
  profileId?: string;
  imageId?: string;
  imageUrl?: string;
  imageFilename?: string;
  requestId?: string;
  tier?: string;
  outfitTitle?: string;
  anchorItemDescription?: string;
  pieceName?: string;
  candidateItemDescription?: string;
};

export type StrengthLabel = 'Strong' | 'Moderate' | 'Weak';
export type FidelityLabel = 'Close' | 'Adjusted' | 'Different';

export type AnalysisResponse = {
  id: string;
  verdict: AnalysisVerdict;
  // ── Compatibility (Check Outfit) ──────────────────────
  itemMatch?: StrengthLabel;
  outfitFit?: StrengthLabel;
  outfitImpact?: string[];
  // ── Selfie Review ─────────────────────────────────────
  lookFidelity?: FidelityLabel;
  overallLook?: StrengthLabel;
  substitutionImpact?: string[];
  // ── Shared ────────────────────────────────────────────
  summary?: string;
  // ── Legacy (kept for historical stored results) ───────
  explanation?: string;
  concerns?: string[];
  suggestedAlternatives?: string[];
  strengths?: string[];
  issues?: string[];
  recommendedAdjustments?: string[];
  stylistNotes: string[];
  suggestedChanges: string[];
  createdAt: string;
};
