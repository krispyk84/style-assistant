// Notification permission helpers.
//
// We use local notifications as the share-handoff signal — when the iOS share
// extension drops an image into the App Group, it schedules a notification
// the user can tap to bring Vesture forward. iOS only displays the
// notification if the host app has been granted notification permission, so
// we ask the user the first time they interact with closet-fit-check (a
// feature that directly benefits from the permission).
//
// One-shot: we never re-ask within a session, and `canAskAgain === false`
// means we leave the user alone permanently.

import * as Notifications from 'expo-notifications';

import { log, recordError } from '@/lib/crashlytics';

let didAttempt = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (didAttempt) {
    try {
      const current = await Notifications.getPermissionsAsync();
      return current.granted;
    } catch {
      return false;
    }
  }
  didAttempt = true;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    log(`[notifications] permission ${result.granted ? 'granted' : 'denied'}`);
    return result.granted;
  } catch (err) {
    recordError(err instanceof Error ? err : new Error(String(err)), 'notification_permission');
    return false;
  }
}
