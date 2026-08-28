import type { LookTierSlug } from '@/types/look-request';

export function buildGenerateOutfitsHref(formality: LookTierSlug) {
  return { pathname: '/generate-outfits' as const, params: { formality } };
}
