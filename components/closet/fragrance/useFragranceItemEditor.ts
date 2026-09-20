import { useEffect, useState } from 'react';

import { dimensionDictToSelected, accordsToNames, type FragranceFormFields } from '@/lib/fragrance-form-mappers';
import type { UserFragrance } from '@/types/fragrance';

const SEASON_KEYS = ['spring', 'summer', 'fall', 'winter'] as const;
const DAY_NIGHT_KEYS = ['day', 'night'] as const;
const FORMALITY_KEYS = ['casual', 'smartCasual', 'business', 'formalEvening'] as const;

/** getFields() snapshot pattern (see closet's useClosetItemEditor) — seeds every editable field from the item's effective profile (override-over-catalog, same as the backend's applyOverrides). */
export function useFragranceItemEditor(item: UserFragrance) {
  const overrides = (item.profileOverrides ?? {}) as Partial<{
    concentration: string | null;
    mainAccords: { name: string; weight: number }[];
    primaryVibe: string | null;
    secondaryVibes: string[];
    seasonality: Record<string, number>;
    dayNight: Record<string, number>;
    formality: Record<string, number>;
  }>;

  const effectiveConcentration = overrides.concentration !== undefined ? overrides.concentration : item.fragrance.concentration;
  const effectiveAccords = overrides.mainAccords ?? item.fragrance.mainAccords ?? [];
  const effectivePrimaryVibe = overrides.primaryVibe !== undefined ? overrides.primaryVibe : item.fragrance.primaryVibe;
  const effectiveSecondaryVibes = overrides.secondaryVibes ?? item.fragrance.secondaryVibes ?? [];
  const effectiveSeasonality = overrides.seasonality ?? item.fragrance.seasonality;
  const effectiveDayNight = overrides.dayNight ?? item.fragrance.dayNight;
  const effectiveFormality = overrides.formality ?? item.fragrance.formality;

  const [concentration, setConcentration] = useState<string | undefined>(effectiveConcentration ?? undefined);
  const [accordNames, setAccordNames] = useState<string[]>(accordsToNames(effectiveAccords));
  const [primaryVibe, setPrimaryVibe] = useState<string | undefined>(effectivePrimaryVibe ?? undefined);
  const [secondaryVibes, setSecondaryVibes] = useState<string[]>(effectiveSecondaryVibes);
  const [seasons, setSeasons] = useState<string[]>(dimensionDictToSelected(effectiveSeasonality, SEASON_KEYS));
  const [dayNight, setDayNight] = useState<string[]>(dimensionDictToSelected(effectiveDayNight, DAY_NIGHT_KEYS));
  const [formalityTags, setFormalityTags] = useState<string[]>(dimensionDictToSelected(effectiveFormality, FORMALITY_KEYS));
  const [isSignature, setIsSignature] = useState(item.isSignature);
  const [currentVolumeMl, setCurrentVolumeMl] = useState(item.currentVolumeMl != null ? String(item.currentVolumeMl) : '');
  const [userNotes, setUserNotes] = useState(item.userNotes ?? '');

  // Re-seed whenever a different item is opened.
  useEffect(() => {
    setConcentration(effectiveConcentration ?? undefined);
    setAccordNames(accordsToNames(effectiveAccords));
    setPrimaryVibe(effectivePrimaryVibe ?? undefined);
    setSecondaryVibes(effectiveSecondaryVibes);
    setSeasons(dimensionDictToSelected(effectiveSeasonality, SEASON_KEYS));
    setDayNight(dimensionDictToSelected(effectiveDayNight, DAY_NIGHT_KEYS));
    setFormalityTags(dimensionDictToSelected(effectiveFormality, FORMALITY_KEYS));
    setIsSignature(item.isSignature);
    setCurrentVolumeMl(item.currentVolumeMl != null ? String(item.currentVolumeMl) : '');
    setUserNotes(item.userNotes ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  function getFields(): FragranceFormFields {
    return {
      brand: item.fragrance.brand,
      name: item.fragrance.name,
      concentration,
      accordNames,
      primaryVibe,
      secondaryVibes,
      seasons,
      dayNight,
      formalityTags,
      isSignature,
      currentVolumeMl,
      userNotes,
      topNotes: item.fragrance.topNotes,
      middleNotes: item.fragrance.middleNotes,
      baseNotes: item.fragrance.baseNotes,
    };
  }

  return {
    fields: { concentration, accordNames, primaryVibe, secondaryVibes, seasons, dayNight, formalityTags, isSignature, currentVolumeMl, userNotes },
    setters: { setConcentration, setAccordNames, setPrimaryVibe, setSecondaryVibes, setSeasons, setDayNight, setFormalityTags, setIsSignature, setCurrentVolumeMl, setUserNotes },
    getFields,
  };
}
