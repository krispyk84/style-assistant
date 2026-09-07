import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { tripDraftStorage, type TripDraft } from '@/lib/trip-draft-storage';

// Trip drafts have no cloud backing (see lib/user-data-sync.ts's
// clearAllLocalUserData, which wipes 'style-assistant/trip-draft' on sign-out
// with no warning) — so an in-progress trip a user hasn't finished generating
// yet is silently and permanently lost on sign-out. useTravelPlannerForm's
// saveDraft() only ever persists a draft once destination + both dates are
// set (never on the blank/just-opened form), so the presence of those real
// content fields — not just the storage key existing — is what "meaningful"
// means here.
function isMeaningfulTripDraft(draft: TripDraft | null): draft is TripDraft {
  return Boolean(draft?.destinationLabel?.trim() && draft?.departureDate && draft?.returnDate);
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useLogout() {
  const { signOut } = useAuth();

  const handleLogout = useCallback(async () => {
    const draft = await tripDraftStorage.load().catch(() => null);

    if (!isMeaningfulTripDraft(draft)) {
      void signOut();
      return;
    }

    Alert.alert(
      'Unsaved Trip in Progress',
      `Signing out will permanently delete your in-progress trip to ${draft.destinationLabel} — it hasn't been saved yet.`,
      [
        { text: 'Keep Planning', style: 'cancel' },
        { text: 'Sign Out Anyway', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }, [signOut]);

  return { handleLogout };
}
