import type { SecondOpinionSubject } from '@/types/api';
import type { LookRecommendation, LookTierSlug } from '@/types/look-request';

export function formatTierLabel(tier: LookTierSlug): string {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function buildSecondOpinionSubject(recommendation: LookRecommendation): SecondOpinionSubject {
  return {
    outfitTitle: recommendation.title,
    tier: recommendation.tier,
    anchorItem: recommendation.anchorItem,
    keyPieces: recommendation.keyPieces.map((p) => (typeof p === 'string' ? p : p.display_name)),
    shoes: recommendation.shoes.map((p) => (typeof p === 'string' ? p : p.display_name)),
    accessories: recommendation.accessories.map((p) => (typeof p === 'string' ? p : p.display_name)),
    fitNotes: recommendation.fitNotes,
    whyItWorks: recommendation.whyItWorks,
    stylingDirection: recommendation.stylingDirection,
  };
}

const CLOSET_FOOTWEAR_CATEGORIES = new Set(['Shoes', 'Sneakers', 'Loafers', 'Boots']);
const CLOSET_ACCESSORY_CATEGORIES = new Set(['Belt', 'Bag', 'Watch', 'Scarf', 'Hat', 'Tie', 'Socks', 'Sunglasses']);

/** Same footwear/accessory split used by the closet-outfit sketch prompt — everything else counts as a "key piece". */
export function buildSecondOpinionSubjectFromClosetOutfit(outfit: {
  title: string;
  whyItWorks: string;
  items: { title: string; category: string }[];
}): SecondOpinionSubject {
  const shoes = outfit.items.filter((item) => CLOSET_FOOTWEAR_CATEGORIES.has(item.category)).map((item) => item.title);
  const accessories = outfit.items.filter((item) => CLOSET_ACCESSORY_CATEGORIES.has(item.category)).map((item) => item.title);
  const keyPieces = outfit.items
    .filter((item) => !CLOSET_FOOTWEAR_CATEGORIES.has(item.category) && !CLOSET_ACCESSORY_CATEGORIES.has(item.category))
    .map((item) => item.title);

  return {
    outfitTitle: outfit.title,
    keyPieces,
    shoes,
    accessories,
    whyItWorks: outfit.whyItWorks,
  };
}
