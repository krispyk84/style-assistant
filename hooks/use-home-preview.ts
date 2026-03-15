import { lookTierDefinitions } from '@/lib/look-mock-data';
import { anchorItem, outfitResults } from '@/lib/mock-data';

export function useHomePreview() {
  return {
    anchorItem,
    featuredResult: outfitResults[0],
    featuredTier: lookTierDefinitions[1],
  };
}
