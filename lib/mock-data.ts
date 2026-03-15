import type { AnchorItem, OutfitResult, OutfitTier, OutfitTierKey } from '@/types/style';

export const anchorItem: AnchorItem = {
  id: 'anchor-001',
  name: 'Dark olive chore jacket',
  category: 'Outerwear',
  color: 'Dark olive',
  occasion: 'Smart casual dinners',
  description: 'Structured enough to feel intentional, relaxed enough to replace a blazer.',
};

export const outfitTiers: OutfitTier[] = [
  {
    key: 'essential',
    name: 'Essential',
    priceBand: '$',
    description: 'Fast, efficient direction built around the pieces you already own.',
    benefits: ['1 lead outfit direction', 'Simple swap suggestions', 'Clear styling rationale'],
    bestFor: 'Daily dressing decisions and fast confidence checks.',
  },
  {
    key: 'refined',
    name: 'Refined',
    priceBand: '$$',
    description: 'Deeper outfit guidance with stronger shopping and upgrade cues.',
    benefits: ['3 outfit options', 'Anchor piece strategy', 'Tiered upgrade recommendations'],
    bestFor: 'Men refining a consistent personal uniform with fewer misses.',
  },
  {
    key: 'editorial',
    name: 'Editorial',
    priceBand: '$$$',
    description: 'High-touch styling direction designed to feel premium and image-aware.',
    benefits: ['Occasion-first styling concepts', 'Visual polish notes', 'Priority wardrobe upgrade plan'],
    bestFor: 'Events, travel, content moments, and image-sensitive settings.',
  },
];

export const outfitResults: OutfitResult[] = [
  {
    requestId: 'request-001',
    title: 'Olive jacket dinner look',
    headline: 'Quietly sharp with texture, dark neutrals, and one warm accent.',
    summary: 'Use the chore jacket as the relaxed tailored layer, then keep the base dark and clean.',
    occasion: 'Client dinner',
    tier: 'refined',
    tierLabel: 'Refined',
    confidence: 'High confidence for early evening and indoor settings.',
    stylistNote: 'The goal is composed rather than trend-driven: trim knitwear, dark trousers, and a loafer or minimal derby.',
    pieces: [
      { name: 'Cream merino polo', note: 'Soft contrast under the jacket' },
      { name: 'Charcoal pleated trousers', note: 'Adds drape and polish' },
      { name: 'Black leather loafers', note: 'Keeps the finish elevated' },
    ],
  },
  {
    requestId: 'request-002',
    title: 'Travel day uniform',
    headline: 'Comfort first, but visually tightened through tone and proportion.',
    summary: 'Build around soft tailoring pieces that can survive airport transitions without looking athletic.',
    occasion: 'Short-haul travel',
    tier: 'essential',
    tierLabel: 'Essential',
    confidence: 'Strong for airport, coffee stop, and straight-to-meeting use.',
    stylistNote: 'This formula keeps movement easy while avoiding overt sportswear cues.',
    pieces: [
      { name: 'Navy knit overshirt', note: 'Flexible outer layer' },
      { name: 'Stone drawstring trouser', note: 'Comfort without sloppiness' },
      { name: 'White leather sneakers', note: 'Simple and versatile' },
    ],
  },
  {
    requestId: 'request-003',
    title: 'Weekend gallery fit',
    headline: 'Slightly directional, monochrome, and intentionally understated.',
    summary: 'Lean into silhouette and material contrast instead of loud color.',
    occasion: 'Weekend social',
    tier: 'editorial',
    tierLabel: 'Editorial',
    confidence: 'Best for city daytime through evening drinks.',
    stylistNote: 'A fuller trouser and sharp outer layer make the look feel considered without looking over-styled.',
    pieces: [
      { name: 'Black zip cardigan', note: 'Acts as a refined mid-layer' },
      { name: 'Wide charcoal trouser', note: 'Creates shape and intent' },
      { name: 'Dark espresso boot', note: 'Grounds the palette with depth' },
    ],
  },
];

export function getOutfitResultByRequestId(requestId: string) {
  return outfitResults.find((result) => result.requestId === requestId);
}

export function getTierByKey(tierKey: string) {
  return outfitTiers.find((tier) => tier.key === (tierKey as OutfitTierKey));
}
