import { useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import { useUndoableRemove } from '@/hooks/use-undoable-remove';
import { removeClosetWeekPlanDay, saveClosetOutfitToFavourites, type ClosetWeekPlanItem } from '@/lib/closet-outfit-storage';
import { buildSavedOutfitId, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { removeWeekPlan } from '@/lib/week-plan-storage';
import type { WeekPlannedOutfit } from '@/types/style';

// ── Hook ───────────────────────────────────────────────────────────────────────

type Params = {
  savedOutfitIds: string[];
  setItems: React.Dispatch<React.SetStateAction<WeekPlannedOutfit[]>>;
  setSavedOutfitIds: React.Dispatch<React.SetStateAction<string[]>>;
  closetSavedOutfitIds: string[];
  setClosetItems: React.Dispatch<React.SetStateAction<ClosetWeekPlanItem[]>>;
  setClosetSavedOutfitIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function useWeekPlanActions({
  savedOutfitIds, setItems, setSavedOutfitIds,
  closetSavedOutfitIds, setClosetItems, setClosetSavedOutfitIds,
}: Params) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { performRemove } = useUndoableRemove();

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

  function handleRemove(assignment: WeekPlannedOutfit) {
    const { dayKey } = assignment;
    setItems((prev) => prev.filter((item) => item.dayKey !== dayKey));
    performRemove({
      message: 'Removed from your week.',
      optimisticRemove: () => {},
      commitDelete: () => removeWeekPlan(dayKey),
      restore: () => setItems((prev) => [assignment, ...prev]),
    });
  }

  async function handleSaveClosetOutfit(assignment: ClosetWeekPlanItem) {
    if (closetSavedOutfitIds.includes(assignment.outfit.id)) return;

    setSavingId(assignment.outfit.id);
    try {
      await saveClosetOutfitToFavourites(assignment.formality, assignment.outfit);
      setClosetSavedOutfitIds((current) => [...current, assignment.outfit.id]);
      showToast('Outfit saved to favorites.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }
    setSavingId(null);
  }

  function handleRemoveClosetDay(assignment: ClosetWeekPlanItem) {
    const { dayKey } = assignment;
    setClosetItems((prev) => prev.filter((item) => item.dayKey !== dayKey));
    performRemove({
      message: 'Removed from your week.',
      optimisticRemove: () => {},
      commitDelete: () => removeClosetWeekPlanDay(dayKey),
      restore: () => setClosetItems((prev) => [assignment, ...prev]),
    });
  }

  return { savingId, handleSave, handleRemove, handleSaveClosetOutfit, handleRemoveClosetDay };
}
