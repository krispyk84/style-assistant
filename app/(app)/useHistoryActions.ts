import { useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import type { SavedOutfit } from '@/types/style';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useHistoryActions() {
  const [weekPickerItem, setWeekPickerItem] = useState<SavedOutfit | null>(null);

  const { showToast } = useToast();

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!weekPickerItem) return;
    try {
      await assignOutfitToWeekDay(
        dayKey,
        dayLabel,
        weekPickerItem.input,
        weekPickerItem.recommendation,
        weekPickerItem.requestId,
      );
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }
    setWeekPickerItem(null);
  }

  return { weekPickerItem, setWeekPickerItem, handleAssignToWeek };
}
