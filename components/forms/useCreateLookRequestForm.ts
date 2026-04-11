import { useState } from 'react';

import type { CreateLookInput, LookTierSlug } from '@/types/look-request';

export function useCreateLookRequestForm(initialValue: CreateLookInput) {
  const [vibeKeywords, setVibeKeywords] = useState(initialValue.vibeKeywords ?? '');
  const [selectedTiers, setSelectedTiers] = useState<LookTierSlug[]>(initialValue.selectedTiers);
  // Auto-expand if the form was initialised with pre-filled keywords (e.g. anchor flows)
  const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(() => !!(initialValue.vibeKeywords?.trim()));
  const [tierError, setTierError] = useState<string | null>(null);

  function toggleTier(tier: LookTierSlug) {
    setSelectedTiers((current) => {
      const next = current.includes(tier) ? current.filter((item) => item !== tier) : [...current, tier];
      return next;
    });
    setTierError(null);
  }

  function toggleVibeKeyword(keyword: string) {
    setVibeKeywords((current) => {
      const parts = current
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const idx = parts.findIndex((k) => k.toLowerCase() === keyword.toLowerCase());
      if (idx >= 0) {
        parts.splice(idx, 1);
      } else {
        parts.push(keyword);
      }
      return parts.join(', ');
    });
  }

  return {
    // State
    vibeKeywords,
    selectedTiers,
    isKeywordsExpanded,
    tierError,
    // Setters
    setVibeKeywords,
    setIsKeywordsExpanded,
    setTierError,
    // Mutations
    toggleTier,
    toggleVibeKeyword,
  };
}
