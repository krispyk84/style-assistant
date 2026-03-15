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
};

export type AnalysisResponse = {
  id: string;
  verdict: AnalysisVerdict;
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
