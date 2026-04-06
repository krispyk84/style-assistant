import analytics from '@react-native-firebase/analytics';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

// ── Event name constants ───────────────────────────────────────────────────────
// Single source of truth. All screens and components import from here — no
// magic strings scattered across the codebase.

export const EVENTS = {
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  CREATE_LOOK_STARTED: 'create_look_started',
  CREATE_LOOK_COMPLETED: 'create_look_completed',
  CREATE_LOOK_FAILED: 'create_look_failed',
  CHECK_PIECE_STARTED: 'check_piece_started',
  CHECK_PIECE_COMPLETED: 'check_piece_completed',
  CHECK_PIECE_FAILED: 'check_piece_failed',
  SECOND_OPINION_REQUESTED: 'second_opinion_requested',
  CLOSET_MATCH_SHOWN: 'closet_match_shown',
  CLOSET_MATCH_THUMB_UP: 'closet_match_thumb_up',
  CLOSET_MATCH_THUMB_DOWN: 'closet_match_thumb_down',
  SAVE_OUTFIT: 'save_outfit',
  ADD_TO_WEEK: 'add_to_week',
  CLOSET_ITEM_ADDED: 'closet_item_added',
} as const;

type EventParams = Record<string, string | number | boolean>;

// ── Core helper ───────────────────────────────────────────────────────────────
// Wrapped in try/catch so a missing GoogleService-Info.plist or Firebase
// initialization failure never crashes the app.

function trackEvent(name: string, params?: EventParams): void {
  analytics()
    .logEvent(name, params)
    .catch(() => undefined);
}

// ── Typed event functions ─────────────────────────────────────────────────────

export function trackOnboardingStarted() {
  trackEvent(EVENTS.ONBOARDING_STARTED);
}

export function trackOnboardingCompleted() {
  trackEvent(EVENTS.ONBOARDING_COMPLETED);
}

export function trackCreateLookStarted() {
  trackEvent(EVENTS.CREATE_LOOK_STARTED);
}

export function trackCreateLookCompleted(params: { tier_count: number }) {
  trackEvent(EVENTS.CREATE_LOOK_COMPLETED, params);
}

export function trackCreateLookFailed(params?: { error?: string }) {
  trackEvent(EVENTS.CREATE_LOOK_FAILED, params);
}

export function trackCheckPieceStarted(params: { source: 'photo' | 'closet' }) {
  trackEvent(EVENTS.CHECK_PIECE_STARTED, params);
}

export function trackCheckPieceCompleted(params: { verdict: string }) {
  trackEvent(EVENTS.CHECK_PIECE_COMPLETED, params);
}

export function trackCheckPieceFailed() {
  trackEvent(EVENTS.CHECK_PIECE_FAILED);
}

export function trackSecondOpinionRequested(params: { stylist_id: string }) {
  trackEvent(EVENTS.SECOND_OPINION_REQUESTED, params);
}

export function trackClosetMatchShown(params: { match_count: number; tier: string }) {
  trackEvent(EVENTS.CLOSET_MATCH_SHOWN, params);
}

export function trackClosetMatchThumbUp(params: { tier: string }) {
  trackEvent(EVENTS.CLOSET_MATCH_THUMB_UP, params);
}

export function trackClosetMatchThumbDown(params: { tier: string }) {
  trackEvent(EVENTS.CLOSET_MATCH_THUMB_DOWN, params);
}

export function trackSaveOutfit(params: { tier: string }) {
  trackEvent(EVENTS.SAVE_OUTFIT, params);
}

export function trackAddToWeek(params: { tier: string; day_label: string }) {
  trackEvent(EVENTS.ADD_TO_WEEK, params);
}

export function trackClosetItemAdded(params: { category: string }) {
  trackEvent(EVENTS.CLOSET_ITEM_ADDED, params);
}

// ── User identity ─────────────────────────────────────────────────────────────

export function setAnalyticsUserId(userId: string | null) {
  analytics()
    .setUserId(userId)
    .catch(() => undefined);
}

// ── Screen tracking ───────────────────────────────────────────────────────────
// Drop this component anywhere inside the Expo Router navigation tree.

export function ScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    analytics()
      .logScreenView({ screen_name: pathname, screen_class: pathname })
      .catch(() => undefined);
  }, [pathname]);

  return null;
}
