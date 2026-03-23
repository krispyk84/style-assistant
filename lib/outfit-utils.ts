import type { Ionicons } from '@expo/vector-icons';

import type { LookTierSlug } from '@/types/look-request';

export function formatTierLabel(tier: LookTierSlug): string {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function weatherIconName(code: number): React.ComponentProps<typeof Ionicons>['name'] {
  if (code === 0) return 'sunny-outline';
  if ([1, 2, 3].includes(code)) return 'partly-sunny-outline';
  if ([45, 48].includes(code)) return 'cloud-outline';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy-outline';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow-outline';
  if ([95, 96, 99].includes(code)) return 'thunderstorm-outline';
  return 'cloud-outline';
}
