import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';

import { setApiAuthToken } from '@/lib/api/api-client';
import { logAuthEvent } from '@/lib/auth-event-log';
import { clearAllLocalUserData, syncUserDataOnSignIn } from '@/lib/user-data-sync';
import { reconcileSavedOutfits } from '@/lib/saved-outfits-reconciliation';
import { reconcileWeekPlan } from '@/lib/week-plan-reconciliation';
import { reconcileClosetOutfitFavourites } from '@/lib/closet-outfit-favourites-reconciliation';
import { reconcileClosetOutfitWeekPlan } from '@/lib/closet-outfit-week-plan-reconciliation';
import { setAnalyticsUserId } from '@/lib/analytics';
import { recordError, setCrashlyticsUserId } from '@/lib/crashlytics';

// Synthetic event emitted by useSupabaseAuth during getSession() hydration.
// Supabase's onAuthStateChange does not fire for the restored session on launch,
// so we need a distinct event name to trigger the same ID-setting side effects.
export const AUTH_EVENT_HYDRATED = 'HYDRATED' as const;

export type AuthEventCallback = (event: string, session: Session | null) => void;

/**
 * Returns a stable callback that fires all auth-driven side effects.
 * Called by useSupabaseAuth from within getSession() and onAuthStateChange —
 * both fire synchronously in the same execution context as the state updates,
 * preserving the original effect order.
 *
 * Effect matrix:
 *   setApiAuthToken        — every event (token sync + sign-out clear)
 *   setAnalyticsUserId     — HYDRATED and SIGNED_IN only
 *   setCrashlyticsUserId   — HYDRATED and SIGNED_IN only
 *   syncUserDataOnSignIn   — SIGNED_IN only (not on hydration); no longer
 *                            covers saved-outfits (see below)
 *   reconcileSavedOutfits  — HYDRATED and SIGNED_IN (Phase 3A1's one chosen
 *                            lifecycle trigger — see saved-outfits note)
 *   reconcileWeekPlan      — HYDRATED and SIGNED_IN (Phase 3A2, same
 *                            checkpoint, independent run — see week-plan note)
 *   reconcileClosetOutfitFavourites — HYDRATED and SIGNED_IN (Phase 3A3,
 *                            same checkpoint, independent run — see
 *                            closet-outfit-favourites note)
 *   reconcileClosetOutfitWeekPlan — HYDRATED and SIGNED_IN (Phase 3A4, same
 *                            checkpoint, independent run — the fourth and
 *                            final migrated domain)
 *   clearAllLocalUserData  — SIGNED_OUT only
 *
 * Phase 3A1 (sync redesign): saved-outfits is the first domain pulled off
 * this legacy sync entirely. syncUserDataOnSignIn's saved-outfits branch
 * used to run a bulk pull-or-push against the direct-Supabase table with no
 * CAS at all — leaving it running here alongside the new version-aware
 * reconciliation path would be exactly the uncoordinated dual write Phase
 * 3A1's cutover invariant forbids (see lib/user-data-sync.ts, which now
 * omits 'saved-outfits' from its own domain list). reconcileSavedOutfits is
 * fired on the SAME checkpoint already used for setAnalyticsUserId/
 * setCrashlyticsUserId (HYDRATED + SIGNED_IN) rather than only SIGNED_IN,
 * since that checkpoint is this codebase's existing definition of "an
 * authenticated session just became available" — covering both a fresh
 * sign-in and an already-authenticated cold launch, which previously had no
 * saved-outfits sync of any kind (a real, previously-flagged gap).
 *
 * Phase 3A2: week-plan is migrated the same way, for the same reason —
 * lib/user-data-sync.ts also no longer bulk pull-or-pushes week-plan.
 * reconcileWeekPlan is fired as an entirely independent call (its own
 * try/catch, its own single-flight instance in
 * lib/week-plan-reconciliation.ts) — deliberately NOT awaited in sequence
 * after reconcileSavedOutfits, so a hang or failure in one domain's
 * reconciliation can never delay or block the other's.
 *
 * Phase 3A3: closet-outfit-favourites is migrated the same way — the first
 * backend-mediated (authenticated HTTP -> service -> Prisma) domain to go
 * through this path rather than direct Supabase. Same independent-call
 * pattern, same single-flight instance
 * (lib/closet-outfit-favourites-reconciliation.ts).
 *
 * Phase 3A4: closet-outfit-week-plan is migrated the same way — the fourth
 * and final approved sync domain, completing the migration. Same
 * independent-call pattern, same single-flight instance
 * (lib/closet-outfit-week-plan-reconciliation.ts). All four domains'
 * reconciliation calls here are independent of one another: a hang or
 * failure in any one of them can never delay or block the others.
 */
export function useAuthSideEffects(): AuthEventCallback {
  return useCallback((event: string, session: Session | null) => {
    void logAuthEvent(event, session?.user?.id ?? null);

    // Keep the API client bearer token in sync with the current session.
    // Covers sign-in, sign-out, and automatic token refreshes.
    setApiAuthToken(session?.access_token ?? null);

    if (session?.user) {
      if (event === AUTH_EVENT_HYDRATED || event === 'SIGNED_IN') {
        setAnalyticsUserId(session.user.id);
        setCrashlyticsUserId(session.user.id);
        void reconcileSavedOutfits().catch((error) =>
          logAuthEvent(`saved-outfits-reconcile: unexpected top-level error — ${error instanceof Error ? error.message : String(error)}`, session.user.id),
        );
        void reconcileWeekPlan().catch((error) =>
          logAuthEvent(`week-plan-reconcile: unexpected top-level error — ${error instanceof Error ? error.message : String(error)}`, session.user.id),
        );
        void reconcileClosetOutfitFavourites().catch((error) =>
          logAuthEvent(`closet-outfit-favourites-reconcile: unexpected top-level error — ${error instanceof Error ? error.message : String(error)}`, session.user.id),
        );
        void reconcileClosetOutfitWeekPlan().catch((error) =>
          logAuthEvent(`closet-outfit-week-plan-reconcile: unexpected top-level error — ${error instanceof Error ? error.message : String(error)}`, session.user.id),
        );
      }
      if (event === 'SIGNED_IN') {
        // syncUserDataOnSignIn logs each entity's own result as it settles
        // (lib/user-data-sync.ts) — this catch is only a backstop in case
        // something throws before any per-entity logging happens.
        void syncUserDataOnSignIn(session.user.id).catch((error) =>
          logAuthEvent(`sync: unexpected top-level error — ${error instanceof Error ? error.message : String(error)}`, session.user.id),
        );
      }
    } else {
      if (event === 'SIGNED_OUT') {
        void clearAllLocalUserData().catch((error) => recordError(error, 'clear_all_local_user_data'));
      }
    }
  }, []);
}
