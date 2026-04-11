import { useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import { buildSavedOutfitId, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { removeWeekPlan } from '@/lib/week-plan-storage';
import type { WeekPlannedOutfit } from '@/types/style';

// ── Hook ───────────────────────────────────────────────────────────────────────

type Params = {
  savedOutfitIds: string[];
  setItems: React.Dispatch<React.SetStateAction<WeekPlannedOutfit[]>>;
  setSavedOutfitIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function useWeekPlanActions({ savedOutfitIds, setItems, setSavedOutfitIds }: Params) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleSave(assignment: WeekPlannedOutfit) {
    const savedId = buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier);
    if (savedOutfitIds.includes(savedId)) {
      return;
    }

    setSavingId(savedId);

    try {
      await saveSavedOutfit(assignment.input, assignment.recommendation, assignment.requestId);
      setSavedOutfitIds((current) => [...current, savedId]);
      showToast('Outfit saved to favorites.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }

    setSavingId(null);
  }

  async function handleRemove(dayKey: string) {
    setItems(await removeWeekPlan(dayKey));
  }

  return { savingId, handleSave, handleRemove };
}
