import type { LookTierSlug } from '@/types/look-request';

export function buildGenerateOutfitsHref(formality: LookTierSlug, additionalDetails?: string) {
  return {
    pathname: '/generate-outfits' as const,
    params: {
      formality,
      additionalDetails: additionalDetails?.trim() || undefined,
    },
  };
}
