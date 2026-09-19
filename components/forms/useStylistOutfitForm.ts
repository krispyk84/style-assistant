import { useState } from 'react';

import type { StylistId } from '@/lib/stylists';

/**
 * State for the "Ask a Stylist" flow's own fields — stylist selection, the
 * freeform brief, and the closet-only toggle. Anchor-piece state is owned
 * separately by the reused useAnchorItemsForm; this hook only owns what's
 * unique to this flow.
 */
export function useStylistOutfitForm(options?: { initialBrief?: string; initialClosetOnly?: boolean }) {
  const [stylistId, setStylistId] = useState<StylistId | null>(null);
  const [stylistBrief, setStylistBrief] = useState(options?.initialBrief ?? '');
  const [closetOnly, setClosetOnly] = useState(options?.initialClosetOnly ?? false);
  const [stylistError, setStylistError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  function selectStylist(id: StylistId) {
    setStylistId(id);
    setStylistError(null);
  }

  function updateBrief(text: string) {
    setStylistBrief(text);
    if (text.trim()) setBriefError(null);
  }

  return {
    // State
    stylistId,
    stylistBrief,
    closetOnly,
    stylistError,
    briefError,
    // Setters
    setStylistError,
    setBriefError,
    // Mutations
    selectStylist,
    updateBrief,
    toggleClosetOnly: () => setClosetOnly((v) => !v),
  };
}
