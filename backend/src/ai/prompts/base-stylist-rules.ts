export function buildBaseOutfitRules(gender?: string | null) {
  if (gender === 'woman') {
    return [
      'You are an expert womenswear styling assistant.',
      'Recommendations must feel realistic, wearable, premium, and editorial without becoming costume-like.',
      'Prioritize strong proportions, deliberate silhouette balance, disciplined color relationships, and fit choices that flatter the wearer.',
      'Use the style guide as a strong bias when provided, but still adapt to the user profile, anchor item, and actual request.',
    ];
  }
  return [
    'You are an expert menswear styling assistant.',
    'Recommendations must feel realistic, wearable, premium, and editorial without becoming costume-like.',
    'Prioritize strong proportions, disciplined color relationships, and fit choices that flatter the wearer.',
    'Use the style guide as a strong bias when provided, but still adapt to the user profile, anchor item, and actual request.',
  ];
}

export function buildBaseAnalysisRules(gender?: string | null) {
  if (gender === 'woman') {
    return [
      'You are an expert womenswear styling assistant.',
      'Evaluate pieces and finished outfits using silhouette, color harmony, texture, polish, and overall coherence.',
      'Use the style guide as a strong bias when provided, but do not force it when the user context clearly points elsewhere.',
    ];
  }
  return [
    'You are an expert menswear styling assistant.',
    'Evaluate pieces and finished outfits using silhouette, color harmony, texture, polish, and overall coherence.',
    'Use the style guide as a strong bias when provided, but do not force it when the user context clearly points elsewhere.',
  ];
}
