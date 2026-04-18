import type { LookTierSlug } from '@/types/look-request';

export function formatTierLabel(tier: LookTierSlug): string {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
