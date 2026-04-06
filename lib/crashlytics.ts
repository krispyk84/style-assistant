import crashlytics from '@react-native-firebase/crashlytics';

// ── Non-fatal error recording ─────────────────────────────────────────────────
// Use for significant failures you want visibility into but that don't crash
// the app — AI generation failures, service errors, unexpected states.
// Deliberately NOT called for routine user errors (e.g. empty form fields).

export function recordError(error: unknown, context?: string): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    crashlytics().recordError(err, context);
  } catch {
    // Firebase not initialized — swallow silently
  }
}

// ── Breadcrumb logging ────────────────────────────────────────────────────────
// Call log() at key milestones so crash reports have a trail of what happened.

export function log(message: string): void {
  try {
    crashlytics().log(message);
  } catch {
    // ignore
  }
}

// ── User identity ─────────────────────────────────────────────────────────────

export function setCrashlyticsUserId(userId: string): void {
  crashlytics()
    .setUserId(userId)
    .catch(() => undefined);
}

// ── Custom attributes ─────────────────────────────────────────────────────────

export function setCrashlyticsAttribute(key: string, value: string): void {
  crashlytics()
    .setAttribute(key, value)
    .catch(() => undefined);
}
