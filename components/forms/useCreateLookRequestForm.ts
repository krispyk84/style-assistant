import { useEffect, useState } from 'react';

import type { CreateLookInput, LookTierSlug } from '@/types/look-request';
import type { WeatherSeason } from '@/types/weather';

export type LookCount = 1 | 2 | 3;

export function useCreateLookRequestForm(initialValue: CreateLookInput) {
  const [vibeKeywords, setVibeKeywords] = useState(initialValue.vibeKeywords ?? '');
  const [selectedTiers, setSelectedTiers] = useState<LookTierSlug[]>(initialValue.selectedTiers);
  // Auto-expand if the form was initialised with pre-filled keywords (e.g. anchor flows)
  const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(() => !!(initialValue.vibeKeywords?.trim()));
  const [tierError, setTierError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<WeatherSeason | null>(null);
  const [isSeasonExpanded, setIsSeasonExpanded] = useState(false);
  const [includeBag, setIncludeBag] = useState<boolean>(initialValue.includeBag ?? false);
  const [includeHat, setIncludeHat] = useState<boolean>(initialValue.includeHat ?? false);
  const [additionalDetails, setAdditionalDetails] = useState<string>(initialValue.additionalDetails ?? '');
  // Auto-expand if the form was pre-filled with details (e.g. retry / edit flows)
  const [isAdditionalDetailsExpanded, setIsAdditionalDetailsExpanded] = useState(() =>
    !!(initialValue.additionalDetails?.trim()),
  );
  // Same-tier variation count — only meaningful when exactly one tier is selected.
  const [lookCount, setLookCount] = useState<LookCount>(1);

  // When the user selects more than one tier, force back to a single look — the
  // multi-look option is only valid for a single-tier brief.
  useEffect(() => {
    if (selectedTiers.length !== 1 && lookCount !== 1) {
      setLookCount(1);
    }
  }, [selectedTiers.length, lookCount]);

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
    selectedSeason,
    isSeasonExpanded,
    includeBag,
    includeHat,
    additionalDetails,
    isAdditionalDetailsExpanded,
    lookCount,
    // Setters
    setVibeKeywords,
    setIsKeywordsExpanded,
    setIsSeasonExpanded,
    setTierError,
    setSelectedSeason,
    setAdditionalDetails,
    setIsAdditionalDetailsExpanded,
    setLookCount,
    // Mutations
    toggleTier,
    toggleVibeKeyword,
    toggleIncludeBag: () => setIncludeBag((v) => !v),
    toggleIncludeHat: () => setIncludeHat((v) => !v),
  };
}
